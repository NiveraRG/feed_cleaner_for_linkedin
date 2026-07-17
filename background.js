// Feed Cleaner for LinkedIn - background service worker
// Jobs:
//  1. Right-click context menus (mute / always-show an author) - forwards
//     clicks to the content script, which tracked the last right-clicked node.
//  2. Per-tab badge counter: content scripts report their hidden count via
//     lfc-count messages; we mirror it onto the toolbar icon for that tab.
//  3. Lifetime statistics: content scripts report each hide via lfc-hidden;
//     we serialize the read-modify-write into storage.local so concurrent
//     tabs can't clobber each other.

const MENU_MUTE = 'lfc-mute-author';
const MENU_ALLOW = 'lfc-allow-author';
const MENU_MUTE_PHRASE = 'lfc-mute-phrase';
const MENU_ALLOW_POST = 'lfc-allow-post';
const MENU_IDS = [MENU_MUTE, MENU_ALLOW, MENU_MUTE_PHRASE, MENU_ALLOW_POST];

chrome.runtime.onInstalled.addListener(() => {
  // removeAll first: create() throws "duplicate id" if the menus survived a
  // previous install/update of the extension.
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_MUTE,
      title: "Hide this person's posts",
      contexts: ['page', 'link', 'selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*'],
    });
    chrome.contextMenus.create({
      id: MENU_ALLOW,
      title: "Always show this person's posts",
      contexts: ['page', 'link', 'selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*'],
    });
    chrome.contextMenus.create({
      id: MENU_ALLOW_POST,
      title: 'Always show this post',
      contexts: ['page', 'link', 'selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*'],
    });
    chrome.contextMenus.create({
      id: MENU_MUTE_PHRASE,
      // %s is replaced by the selected text at display time.
      title: 'Mute posts containing "%s"',
      contexts: ['selection'],
      documentUrlPatterns: ['https://www.linkedin.com/*'],
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  if (!MENU_IDS.includes(info.menuItemId)) return;
  const msg = { type: info.menuItemId };
  if (info.menuItemId === MENU_MUTE_PHRASE) msg.text = info.selectionText || '';
  chrome.tabs.sendMessage(tab.id, msg, (res) => {
    // No content script listening - either a non-LinkedIn page, or (most
    // common) the extension was reloaded after this tab loaded, so the tab's
    // listener is stale. A tab refresh fixes the latter.
    if (chrome.runtime.lastError) {
      console.warn(
        '[LFC] Could not reach the content script - try refreshing the LinkedIn tab.',
        chrome.runtime.lastError.message
      );
      return;
    }
    if (res && !res.ok) console.warn('[LFC]', res.error);
  });
});

// --- Badge ---------------------------------------------------------------

chrome.action.setBadgeBackgroundColor({ color: '#0a66c2' });

function setBadge(tabId, count) {
  chrome.action.setBadgeText(
    { tabId, text: count > 0 ? String(count) : '' },
    () => void chrome.runtime.lastError // tab may already be gone; ignore
  );
}

// --- Lifetime stats (storage.local, serialized writes) --------------------

const EMPTY_STATS = { total: 0, byReason: {}, since: 0 };
let statsChain = Promise.resolve();

function recordHidden(reason) {
  // Chain writes so two messages arriving back-to-back (or from two tabs)
  // don't both read the same snapshot and lose an increment.
  statsChain = statsChain
    .then(
      () =>
        new Promise((resolve) => {
          chrome.storage.local.get({ lfcStats: EMPTY_STATS }, ({ lfcStats }) => {
            const stats = {
              total: (lfcStats.total || 0) + 1,
              byReason: { ...(lfcStats.byReason || {}) },
              since: lfcStats.since || Date.now(),
            };
            stats.byReason[reason] = (stats.byReason[reason] || 0) + 1;
            chrome.storage.local.set({ lfcStats: stats }, resolve);
          });
        })
    )
    .catch((err) => console.warn('[LFC] stats write failed:', err));
}

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg && msg.type === 'lfc-count' && sender.tab && sender.tab.id != null) {
    setBadge(sender.tab.id, msg.count | 0);
  } else if (msg && msg.type === 'lfc-hidden' && typeof msg.reason === 'string') {
    recordHidden(msg.reason.slice(0, 40));
  }
  return false;
});
