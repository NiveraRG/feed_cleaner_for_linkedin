// Feed Cleaner for LinkedIn - options page logic
// Full management surface: filters, phrases, modules, author lists, stats,
// and file-based settings backup. All state lives in chrome.storage.sync
// (except lifetime stats, which are in storage.local).
// LFC_DEFAULTS / LFC_SENSITIVITY_LEVELS / $ / slider helpers come from shared.js.

const TOGGLE_IDS = [
  'filterPromoted',
  'filterKeywords',
  'filterNetworkOnly',
  'filterOccasions',
  'filterHooks',
  'filterHustle',
  'filterAI',
  'ghostMode',
];
const MODULE_IDS = { modSuggested: 'suggested', modPymk: 'pymk', modNews: 'news' };

$('version').textContent = 'v' + chrome.runtime.getManifest().version;

// --- Load current state ----------------------------------------------------

chrome.storage.sync.get(LFC_DEFAULTS, (s) => {
  for (const id of TOGGLE_IDS) $(id).checked = !!s[id];
  // Reflects the indefinite switch only; a timed session (deepFocusUntil)
  // is a popup affair and expires on its own.
  $('deepFocus').checked = !!s.deepFocus;
  const modules = { ...LFC_DEFAULTS.hideModules, ...(s.hideModules || {}) };
  for (const [id, key] of Object.entries(MODULE_IDS)) $(id).checked = !!modules[key];
  $('mutedPhrases').value = (s.mutedPhrases || []).join('\n');
  lfcSetSlider('hookSensitivity', 'sensitivityLabel', s.hookSensitivity);
  lfcSetSlider('aiSensitivity', 'aiSensitivityLabel', s.aiSensitivity);
  renderAuthors('mutedList', 'mutedAuthors', s.mutedAuthors || []);
  renderAuthors('allowedList', 'allowedAuthors', s.allowedAuthors || []);
  $('allowedPostCount').textContent = (s.allowedPosts || []).length;
});

// --- Toggles / sliders / modules -------------------------------------------

for (const id of TOGGLE_IDS) {
  $(id).addEventListener('change', (e) => {
    syncSet({ [id]: e.target.checked });
  });
}

// Not in TOGGLE_IDS: flipping Deep Focus here also clears any timed session
// (deepFocusUntil), so "off" actually brings the feed back.
$('deepFocus').addEventListener('change', (e) => {
  syncSet({ deepFocus: e.target.checked, deepFocusUntil: 0 });
});

for (const id of Object.keys(MODULE_IDS)) {
  $(id).addEventListener('change', () => {
    const hideModules = {};
    for (const [elId, key] of Object.entries(MODULE_IDS)) {
      hideModules[key] = $(elId).checked;
    }
    syncSet({ hideModules });
  });
}

lfcWireSlider('hookSensitivity', 'sensitivityLabel', 'hookSensitivity');
lfcWireSlider('aiSensitivity', 'aiSensitivityLabel', 'aiSensitivity');

// --- Muted phrases (debounced, flushed on tab close) -------------------------

let phraseTimer = null;
function savePhrases() {
  phraseTimer = null;
  const phrases = $('mutedPhrases').value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  syncSet({ mutedPhrases: phrases });
}
$('mutedPhrases').addEventListener('input', () => {
  clearTimeout(phraseTimer);
  phraseTimer = setTimeout(savePhrases, 400);
});
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && phraseTimer !== null) {
    clearTimeout(phraseTimer);
    savePhrases();
  }
});

// --- Author lists -------------------------------------------------------------

function renderAuthors(listId, storageKey, authors) {
  const list = $(listId);
  list.innerHTML = '';
  if (!authors.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No one yet.';
    list.appendChild(li);
    return;
  }
  authors.forEach((author, i) => {
    const li = document.createElement('li');
    const name = document.createElement('span');
    name.textContent = author.name || author.url;
    name.title = author.url || '';
    const remove = document.createElement('button');
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const updated = authors.filter((_, j) => j !== i);
      syncSet({ [storageKey]: updated });
      renderAuthors(listId, storageKey, updated);
    });
    li.append(name, remove);
    list.appendChild(li);
  });
}

$('clearAllowedPosts').addEventListener('click', () => {
  syncSet({ allowedPosts: [] });
  $('allowedPostCount').textContent = '0';
});

// Keep lists fresh if authors are (un)muted from the feed while this tab is open.
chrome.storage.sync.onChanged.addListener((changes) => {
  if (changes.mutedAuthors) {
    renderAuthors('mutedList', 'mutedAuthors', changes.mutedAuthors.newValue || []);
  }
  if (changes.allowedAuthors) {
    renderAuthors('allowedList', 'allowedAuthors', changes.allowedAuthors.newValue || []);
  }
  if (changes.allowedPosts) {
    $('allowedPostCount').textContent = (changes.allowedPosts.newValue || []).length;
  }
  if (changes.deepFocus) {
    $('deepFocus').checked = !!changes.deepFocus.newValue;
  }
});

// --- Statistics -----------------------------------------------------------------

const REASON_LABELS = {
  promoted: 'Promoted',
  'muted author': 'Muted authors',
  'muted phrase': 'Muted phrases',
  'outside network': 'Outside network',
  'hustle story': 'Hustle stories',
  'AI-generated': 'AI-generated',
  'hook format': 'Hook format',
  'occasion post': 'Occasion posts',
  module: 'Feed modules',
};

function renderStats(stats) {
  const grid = $('statsGrid');
  grid.innerHTML = '';
  const addStat = (num, lbl) => {
    const div = document.createElement('div');
    div.className = 'stat';
    const n = document.createElement('div');
    n.className = 'num';
    n.textContent = num;
    const l = document.createElement('div');
    l.className = 'lbl';
    l.textContent = lbl;
    div.append(n, l);
    grid.appendChild(div);
  };
  addStat(stats.total || 0, 'Total hidden');
  const byReason = stats.byReason || {};
  Object.entries(byReason)
    .sort((a, b) => b[1] - a[1])
    .forEach(([reason, count]) => addStat(count, REASON_LABELS[reason] || reason));
  $('statsSince').textContent = stats.since
    ? 'Counting since ' + new Date(stats.since).toLocaleDateString()
    : 'Nothing hidden yet.';
}

function loadStats() {
  chrome.storage.local.get({ lfcStats: { total: 0, byReason: {}, since: 0 } }, (s) =>
    renderStats(s.lfcStats)
  );
}
loadStats();
chrome.storage.local.onChanged.addListener((changes) => {
  if (changes.lfcStats) renderStats(changes.lfcStats.newValue || {});
});
$('resetStats').addEventListener('click', () => {
  chrome.storage.local.set(
    { lfcStats: { total: 0, byReason: {}, since: Date.now() } },
    () => void chrome.runtime.lastError
  );
});

// --- Backup: export / import ---------------------------------------------------

$('exportBtn').addEventListener('click', () => {
  chrome.storage.sync.get(LFC_DEFAULTS, (s) => {
    const payload = {
      app: 'linkedin-feed-cleaner',
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      settings: s,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-feed-cleaner-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  });
});

$('importBtn').addEventListener('click', () => $('importFile').click());

function importStatus(msg, ok) {
  const el = $('importStatus');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

// Validate an imported blob against the shape of LFC_DEFAULTS: only known
// keys, and each value must match the default's type. Anything else is
// dropped silently so a hand-edited file can't wedge the extension.
function sanitizeImport(raw) {
  const src = raw && typeof raw === 'object' ? raw.settings || raw : null;
  if (!src || typeof src !== 'object') return null;
  const out = {};
  for (const [key, def] of Object.entries(LFC_DEFAULTS)) {
    if (!(key in src)) continue;
    const val = src[key];
    if (Array.isArray(def)) {
      if (!Array.isArray(val)) continue;
      if (key === 'mutedAuthors' || key === 'allowedAuthors') {
        out[key] = val
          .filter((a) => a && typeof a === 'object')
          .map((a) => ({ name: String(a.name || ''), url: String(a.url || '') }))
          .filter((a) => a.name || a.url);
      } else {
        out[key] = val.filter((v) => typeof v === 'string').map(String);
      }
    } else if (typeof def === 'object') {
      if (val && typeof val === 'object' && !Array.isArray(val)) {
        out[key] = {};
        for (const k of Object.keys(def)) out[key][k] = !!val[k];
      }
    } else if (typeof val === typeof def) {
      out[key] = val;
    }
  }
  return Object.keys(out).length ? out : null;
}

$('importFile').addEventListener('change', (e) => {
  const file = e.target.files && e.target.files[0];
  e.target.value = ''; // allow re-importing the same file
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    let sanitized = null;
    try {
      sanitized = sanitizeImport(JSON.parse(reader.result));
    } catch {
      // fall through to the error message below
    }
    if (!sanitized) {
      importStatus('Not a valid settings file.', false);
      return;
    }
    chrome.storage.sync.set(sanitized, () => {
      if (chrome.runtime.lastError) {
        importStatus('Import failed: ' + chrome.runtime.lastError.message, false);
        return;
      }
      importStatus('Imported - settings applied.', true);
      location.reload();
    });
  };
  reader.onerror = () => importStatus('Could not read the file.', false);
  reader.readAsText(file);
});
