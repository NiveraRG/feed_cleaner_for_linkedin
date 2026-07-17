// Feed Cleaner for LinkedIn - popup logic
// Quick controls only: master pause, snooze, filter toggles, sensitivity.
// Phrase/author management, modules, stats, and backup live in options.html.
// Reads/writes chrome.storage.sync so the content script picks changes up
// live via storage.onChanged (no page reload needed).
// LFC_DEFAULTS / LFC_SENSITIVITY_LEVELS / $ / slider helpers come from shared.js.

const SNOOZE_MINUTES = 30;

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
  lfcSetSlider('hookSensitivity', 'sensitivityLabel', s.hookSensitivity);
  lfcSetSlider('aiSensitivity', 'aiSensitivityLabel', s.aiSensitivity);
  renderPauseState(s.enabled, s.snoozeUntil);
  renderDeepFocus(s.deepFocus, s.deepFocusUntil);
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
      $('snoozeState').textContent = `Paused - resumes in ${mins} min`;
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

// --- Deep Focus (independent of pause/snooze - see shared.js) --------------

let dfTick = null;

function renderDeepFocus(deepFocus, deepFocusUntil) {
  const timed = !deepFocus && Date.now() < (deepFocusUntil || 0);
  const active = deepFocus || timed;
  $('dfOn').classList.toggle('active', deepFocus);
  $('dfHour').classList.toggle('active', timed);
  $('dfOff').classList.toggle('active', !active);
  if (dfTick) {
    clearInterval(dfTick);
    dfTick = null;
  }
  if (timed) {
    const update = () => {
      const mins = Math.max(0, Math.ceil((deepFocusUntil - Date.now()) / 60000));
      $('deepFocusState').textContent = `Feed hidden - ${mins} min left`;
    };
    update();
    dfTick = setInterval(update, 15000);
  } else {
    $('deepFocusState').textContent = deepFocus ? 'Feed hidden until turned off' : '';
  }
}

$('dfOn').addEventListener('click', () => {
  syncSet({ deepFocus: true, deepFocusUntil: 0 });
  renderDeepFocus(true, 0);
});
$('dfHour').addEventListener('click', () => {
  const until = Date.now() + 60 * 60000;
  syncSet({ deepFocus: false, deepFocusUntil: until });
  renderDeepFocus(false, until);
});
$('dfOff').addEventListener('click', () => {
  syncSet({ deepFocus: false, deepFocusUntil: 0 });
  renderDeepFocus(false, 0);
});

// --- Toggles & sliders ----------------------------------------------------

for (const id of TOGGLE_IDS) {
  $(id).addEventListener('change', (e) => {
    if (id === 'enabled') {
      // Re-enabling also clears any running snooze - one write, one reprocess.
      syncSet({ enabled: e.target.checked, snoozeUntil: 0 });
      renderPauseState(e.target.checked, 0);
    } else {
      syncSet({ [id]: e.target.checked });
    }
  });
}

lfcWireSlider('hookSensitivity', 'sensitivityLabel', 'hookSensitivity');
lfcWireSlider('aiSensitivity', 'aiSensitivityLabel', 'aiSensitivity');

$('openOptions').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});
