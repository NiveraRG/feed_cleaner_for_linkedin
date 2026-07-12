// Feed Cleaner for LinkedIn — shared constants
// Loaded before content.js (manifest content_scripts) and before popup.js /
// options.js (script tags). Single source of truth for setting defaults so
// the three surfaces can't drift apart.

// eslint-disable-next-line no-unused-vars
const LFC_DEFAULTS = {
  // Master switches
  enabled: true, // global pause: false = extension does nothing
  snoozeUntil: 0, // epoch ms; filtering is paused while Date.now() < this
  ghostMode: false, // dim hidden posts instead of collapsing them

  // Per-filter toggles
  filterKeywords: true,
  filterPromoted: true,
  filterHooks: true,
  filterHustle: true,
  filterAI: true,
  filterOccasions: true, // new-job / anniversary / certificate template posts

  hookSensitivity: 'medium', // loose | medium | strict
  aiSensitivity: 'medium', // loose | medium | strict

  // Muted phrases: plain text, matched case-insensitively after regex-escaping.
  // A line wrapped in slashes (/like this/ or /like this/i) is treated as a
  // real regex instead. Invalid regexes fall back to literal matching.
  mutedPhrases: [
    'humbled to announce',
    "i'm excited to share",
    'thoughts?',
    '🧵',
  ],

  mutedAuthors: [], // [{ name, url }] — always hide
  allowedAuthors: [], // [{ name, url }] — never hide, wins over every filter
  allowedPosts: [], // [string postKey] — individual posts marked "always show"

  // Non-post feed modules to remove entirely (opt-in; selectors heuristic).
  hideModules: {
    suggested: false, // "Suggested for you" units
    pymk: false, // "People you may know" / "Add to your feed"
    news: false, // LinkedIn News sidebar
  },
};

// Cap so allowedPosts can't grow unbounded and blow the sync-storage quota
// (each entry is ~100 chars; sync item limit is 8KB).
// eslint-disable-next-line no-unused-vars
const LFC_MAX_ALLOWED_POSTS = 60;

// eslint-disable-next-line no-unused-vars
const LFC_SENSITIVITY_LEVELS = ['loose', 'medium', 'strict'];

// Write to sync storage with a callback so the MV3 API stays in callback
// mode — without one it returns a promise, and a failure (quota, invalidated
// context) becomes an unhandled rejection instead of a lastError we can log.
// Used by popup.js/options.js; content.js routes through its own guard.
// eslint-disable-next-line no-unused-vars
function syncSet(obj) {
  chrome.storage.sync.set(obj, () => {
    if (chrome.runtime.lastError) {
      console.warn('[LFC] settings write failed:', chrome.runtime.lastError.message);
    }
  });
}
