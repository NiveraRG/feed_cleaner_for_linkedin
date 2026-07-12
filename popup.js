// Feed Cleaner for LinkedIn — popup logic
// Quick controls only: master pause, snooze, filter toggles, sensitivity.
// Phrase/author management, modules, stats, and backup live in options.html.
// Reads/writes chrome.storage.sync so the content script picks changes up
// live via storage.onChanged (no page reload needed).
// LFC_DEFAULTS / LFC_SENSITIVITY_LEVELS come from shared.js.

const SENSITIVITY_LABELS = { loose: 'Loose', medium: 'Medium', strict: 'Strict' };
const SNOOZE_MINUTES = 30;

const $ = (id) => document.getElementById(id);

const TOGGLE_IDS = [
  'enabled',
  'filterPromoted',
  'filterKeywords',
  'filterOccasions',
  'filterHooks',
  'filterHustle',
  'filterAI',
  'ghostMode',
];

let snoozeTick = null;

// --- Load current state into the UI -----------------------------------

chrome.storage.sync.get(LFC_DEFAULTS, (s) => {
  for (const id of TOGGLE_IDS) $(id).checked = !!s[id];
  // Unknown stored value → fall back to medium for both slider and label,
  // so they can't disagree.
  const hookIdx = LFC_SENSITIVITY_LEVELS.indexOf(s.hookSensitivity);
  $('hookSensitivity').value = hookIdx >= 0 ? hookIdx : 1;
  $('sensitivityLabel').textContent =
    SENSITIVITY_LABELS[LFC_SENSITIVITY_LEVELS[hookIdx >= 0 ? hookIdx : 1]];
  const aiIdx = LFC_SENSITIVITY_LEVELS.indexOf(s.aiSensitivity);
  $('aiSensitivity').value = aiIdx >= 0 ? aiIdx : 1;
  $('aiSensitivityLabel').textContent =
    SENSITIVITY_LABELS[LFC_SENSITIVITY_LEVELS[aiIdx >= 0 ? aiIdx : 1]];
  renderPauseState(s.enabled, s.snoozeUntil);
});

// Per-tab hidden count comes straight from the content script (the old
// storage.local counter let multiple LinkedIn tabs clobber each other).
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs && tabs[0];
  if (!tab || !tab.id || !/^https:\/\/www\.linkedin\.com\//.test(tab.url || '')) {
    $('hiddenCount').textContent = '–';
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: 'lfc-get-count' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      $('hiddenCount').textContent = '–'; // content script not loaded (yet)
      return;
    }
    $('hiddenCount').textContent = res.hiddenCount;
  });
});

// --- Master pause / snooze ----------------------------------------------

function renderPauseState(enabled, snoozeUntil) {
  const snoozed = enabled && Date.now() < (snoozeUntil || 0);
  $('main').classList.toggle('paused', !enabled);
  $('snoozeBtn').classList.toggle('active', snoozed);
  $('snoozeBtn').textContent = snoozed ? 'Resume now' : `Snooze ${SNOOZE_MINUTES} min`;
  if (snoozeTick) {
    clearInterval(snoozeTick);
    snoozeTick = null;
  }
  if (snoozed) {
    const update = () => {
      const mins = Math.max(0, Math.ceil((snoozeUntil - Date.now()) / 60000));
      $('snoozeState').textContent = `Paused — resumes in ${mins} min`;
    };
    update();
    snoozeTick = setInterval(update, 15000);
  } else {
    $('snoozeState').textContent = 'Pause temporarily';
  }
}

$('snoozeBtn').addEventListener('click', () => {
  chrome.storage.sync.get(LFC_DEFAULTS, (s) => {
    const snoozed = s.enabled && Date.now() < (s.snoozeUntil || 0);
    const snoozeUntil = snoozed ? 0 : Date.now() + SNOOZE_MINUTES * 60000;
    syncSet({ snoozeUntil });
    renderPauseState(s.enabled, snoozeUntil);
  });
});

// --- Toggles & sliders ----------------------------------------------------

for (const id of TOGGLE_IDS) {
  $(id).addEventListener('change', (e) => {
    if (id === 'enabled') {
      // Re-enabling also clears any running snooze — one write, one reprocess.
      syncSet({ enabled: e.target.checked, snoozeUntil: 0 });
      renderPauseState(e.target.checked, 0);
    } else {
      syncSet({ [id]: e.target.checked });
    }
  });
}

$('hookSensitivity').addEventListener('input', (e) => {
  const level = LFC_SENSITIVITY_LEVELS[Number(e.target.value)] || 'medium';
  $('sensitivityLabel').textContent = SENSITIVITY_LABELS[level];
  syncSet({ hookSensitivity: level });
});

$('aiSensitivity').addEventListener('input', (e) => {
  const level = LFC_SENSITIVITY_LEVELS[Number(e.target.value)] || 'medium';
  $('aiSensitivityLabel').textContent = SENSITIVITY_LABELS[level];
  syncSet({ aiSensitivity: level });
});

$('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
