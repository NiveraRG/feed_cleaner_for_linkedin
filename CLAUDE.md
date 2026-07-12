# CLAUDE.md — Feed Cleaner for LinkedIn

Chrome extension (Manifest V3, plain JS, **no build step, no bundler, no dependencies**)
that filters the LinkedIn feed. Distributed on the Chrome Web Store (see
[STORE_LISTING.md](STORE_LISTING.md) for the listing/packaging process) as well
as loadable unpacked for development. Privacy constraint: **no external API
calls, no analytics — nothing leaves the browser.** Keep it that way in every
change; this is also what the Web Store privacy policy ([privacy-policy.html](privacy-policy.html))
promises, so any change that adds an external call or new data collection
requires updating that policy too.

Extension name is **"Feed Cleaner for LinkedIn"** — deliberately not
"LinkedIn ___" or "___ LinkedIn ___" as the product name, to avoid Chrome Web
Store trademark-policy rejection/takedown for implying LinkedIn affiliation.
Every user-facing surface (manifest name, popup/options titles, store copy)
must include the "not affiliated with LinkedIn Corporation" disclaimer or
keep the "for LinkedIn" construction — don't drift back to leading with the
trademark.

## File map

| File | Role |
| --- | --- |
| `manifest.json` | MV3. Permissions: `storage`, `activeTab`, `contextMenus`. Host: `https://www.linkedin.com/*`. Content script runs on all of `www.linkedin.com` — LinkedIn is a SPA, so a feed-only match missed client-side navigations to the feed; off-feed pages are harmless (`findPosts()` matches nothing there). |
| `shared.js` | `LFC_DEFAULTS` + shared constants. Loaded before content.js (manifest `js` array) and before popup.js/options.js (script tags). **The only place defaults live** — never re-declare them. |
| `content.js` | Everything feed-side: post discovery, all filters, collapse/ghost/show UI, module hiding, MutationObserver, snooze timer, context-menu message handling. IIFE, no globals of its own. |
| `background.js` | Service worker: both right-click menus (mute / always-show), per-tab badge counter (from `lfc-count` messages), lifetime stats (serialized read-modify-writes to `storage.local.lfcStats` from `lfc-hidden` messages). |
| `popup.html` / `popup.js` | Quick controls only: master pause, snooze, filter toggles, sliders, per-tab count (fetched via `lfc-get-count` message). Links to options. |
| `options.html` / `options.js` | Full settings dashboard: filters, phrases (regex syntax), modules, muted/allowed author lists, stats, file-based export/import. Opens in a tab (`options_ui`). |
| `icons/` | Generated placeholder PNGs (PowerShell System.Drawing, blue circle + "F"). |

## The critical thing to know: LinkedIn ships TWO feed DOMs

This user's account is on the **2026 LinkedIn rewrite**: all class names are
obfuscated hashes (`_1aa780e9 _34250a86 …`). The classic semantic classes
(`feed-shared-update-v2`, `update-components-actor__*`) **do not exist** there.
Verified live on 2026-07-07.

Stable hooks in the new DOM (all confirmed by live inspection):

- Feed container: `[data-testid="mainFeed"]`
- Post wrappers: direct children `div[data-lazy-mount-id]` — **inserted empty,
  content mounts lazily afterward**. Never process a wrapper on insertion;
  sweep later (see Observer strategy).
- Post body text: `[data-testid="expandable-text-box"]` (also
  `expandable-text-button` for the "…more" toggle)
- No dedicated author-name node. Author = the **last** profile link
  (`a[href*="/in/"], a[href*="/company/"]`) with non-empty text that appears
  *before* the text box. Earlier named links are "X commented on this" /
  "X likes this" headers. Position check uses `compareDocumentPosition`.
- "Promoted" appears as a **standalone header line** (where the post age
  normally sits) — match `line.trim() === 'Promoted'` within the first ~14
  lines of `post.innerText`. Do NOT substring-match; posts can mention the word.
  English-only label; other UI languages need the localized word added.
- Other useful testids seen: `primary-nav`, `typeahead-input`,
  `expandable-text-box`, `dialog-content`. `data-view-name` attributes: none.

All selectors live in the `SELECTORS` object at the top of `content.js` —
new DOM tried first, classic DOM kept as fallback. Keep that structure.

## Architecture decisions (don't regress these)

- **Never delete posts** — collapse via `display:none` + insert a
  `.lfc-placeholder` bar ("1 post hidden (reason) — Always show / Show").
  Show restores for the sweep; Always show persists a `postKey` (author URL +
  first 80 chars of text) into `allowedPosts` (sync, FIFO-capped at
  `LFC_MAX_ALLOWED_POSTS` = 60 to respect the 8KB sync item quota). Ghost
  mode dims to 0.35 opacity with a small tag instead of collapsing.
- **Filter order matters**: master pause/snooze gate → allowlist (authors,
  then posts — wins over everything) → muted authors → Promoted → muted
  phrases → occasion → hustle story → AI → hook format. Mute list first
  (spec); occasion/hustle/AI before hook because they're the more specific
  reason labels.
- **Modules before posts**: `processAllPosts()` runs `hideModules()` before
  `processPost()` — a PYMK unit looks like a post to `findPosts()` (many
  profile links), and the MARKER skip would otherwise exempt it forever.
  Module detection: exact header-line match in the unit's first 3 non-empty
  lines, and only on units with NO text box (real posts always have one).
- **Observer strategy**: one MutationObserver on `document.body`
  (childList+subtree) that schedules a **debounced (250ms) full sweep** of
  `findPosts()` → `processPost()`. Per-added-node processing does NOT work on
  the new DOM (lazy mounting). Sweeps stay cheap because processed posts carry
  `data-lfc-processed` and are skipped; unrecognizable (not-yet-mounted)
  wrappers are *not* marked, so they get re-checked next sweep.
- **`processPost` marks first, then decides** — a post is evaluated exactly
  once until `reprocessFeed()` (triggered by any settings change) clears all
  markers and placeholder bars and re-runs everything.
- **Settings**: `chrome.storage.sync`, defaults single-sourced in
  `LFC_DEFAULTS` in shared.js. Phrase-textarea writes are debounced 400ms
  (sync-storage write quota: ~120 ops/min) and flushed on `visibilitychange`
  so closing the page can't drop an edit. `storage.onChanged` handlers must
  treat `newValue === undefined` (key removed) as "fall back to default".
- **Pause/snooze**: `enabled` (master) + `snoozeUntil` (epoch ms) in sync.
  Content gates every hide on `filteringActive()` and sets a `setTimeout` to
  reprocess when the snooze expires (no `alarms` permission needed).
- **Counters**: per-tab session count lives in content-script memory only;
  it's mirrored to the toolbar badge via `lfc-count` messages (background
  sets per-tab badge text) and served to the popup via `lfc-get-count`.
  Lifetime stats: content sends `lfc-hidden {reason}` per hide; background
  serializes read-modify-writes into `storage.local.lfcStats`
  (`{total, byReason, since}`) through a promise chain so concurrent tabs
  can't lose increments. `reprocessFeed()` resets the session count (posts
  re-collapse and re-count) but stats keep growing by design.
- **Context-menu flows**: content script records the last right-clicked
  element (capture-phase `contextmenu` listener) → background's
  `contextMenus.onClicked` sends `{type:'lfc-mute-author'}` or
  `{type:'lfc-allow-author'}` → content script walks
  `closest('div[data-lazy-mount-id]')` (or classic post selector) and
  appends `{name, url}` to `mutedAuthors` / `allowedAuthors` in sync storage.
  Profile URLs are normalized (strip query string + trailing slash) and
  names compared case-insensitively.
- **Hook heuristic**: first 300 chars, non-empty lines; hide if
  `lines > maxLines && avgLineLen < maxAvgLineLen`. Thresholds —
  loose 8/30, medium 5/40, strict 3/50.
- **Hustle heuristic**: regex list `HUSTLE_PHRASES`; hide on score ≥2, or
  score ≥1 combined with hook shape.
- **Phrase muting**: phrases are plain text — regex metacharacters escaped
  before matching. A line wrapped in slashes (`/pat/` or `/pat/i`) is parsed
  as a real regex (`i` forced on; invalid patterns degrade to literal text,
  never throw). Special case: `thoughts?` only matches as a standalone line.
- **Occasion filter** (v1.2): `OCCASION_PHRASES` — near-verbatim LinkedIn
  template phrases (new position, work anniversary, certificates), so a
  single match hides. English-only.
- **Import/export** (options page): JSON file download / file-picker upload.
  `sanitizeImport()` whitelists keys against `LFC_DEFAULTS` and type-checks
  every value — an arbitrary hand-edited file must not be able to wedge the
  extension. Nothing is uploaded anywhere (privacy constraint).
- **AI-post heuristic** (v1.1): `AI_SIGNALS` — weighted local stylometric
  signals; strong phrase tells weight 2, weak phrases and structural tells
  (em-dash density, emoji-bullet lists, "not X, but Y" pairs) weight 1. Hide
  when score ≥ `AI_THRESHOLDS[aiSensitivity]` — loose 6 / medium 4 / strict 3
  (strict hides more). Precision-first: at medium a post needs two strong
  tells, or one strong plus two weak. Own sensitivity slider, separate from
  the hook one. Fully local — no external calls.
- Dimfluencer detection remains **unimplemented** (no reliable local signal).
  Its popup toggle stays a greyed-out "coming soon" with nothing wired behind
  it — leave it that way unless the user asks.

## Popup UI gotchas (bugs already fixed once — don't reintroduce)

- Toggle switches must be `<label class="switch">` wrapping the hidden
  checkbox. A `<span>` doesn't forward clicks to the input → dead toggles.
- `.row label { flex: 1 }` hits ALL labels; `.row label.switch { flex: 0 0 34px }`
  overrides it so the switch doesn't stretch across the row. Keep both rules.
- Sensitivity slider is `range 0–2` mapped through
  `LFC_SENSITIVITY_LEVELS = ['loose','medium','strict']` (shared.js). Slider
  position and its text label must be derived from the same clamped index so
  they can't disagree on an invalid stored value.
- `popup.js`/`options.js` load `shared.js` via a script tag ABOVE their own —
  don't reorder.

## Dev / test workflow

- Load: `chrome://extensions` → Developer mode → Load unpacked → this folder.
- `popup.html`/`popup.js` changes: just reopen the popup (read from disk each
  open). `content.js` / `background.js` / `manifest.json` changes: hit reload
  (↻) on the extension, then refresh the LinkedIn tab.
- Best way to verify filter logic without reload cycles: paste the selector
  pipeline into the DevTools console on a live feed (or drive it via the
  Claude-in-Chrome browser tools) — that's how the new-DOM selectors were
  originally validated. Note: the browser tool's output filter blocks dumps
  containing raw attribute *values* / URLs ("Cookie/query string data") —
  output attribute names, booleans, and short text previews instead.
- There are no tests and no lint setup. Keep code plain ES2020-ish, reasonably
  commented — the repo is screen-recorded for a "how I built this" LinkedIn post.

## Known limitations / future work

- "Promoted" and occasion-template matches are English-only.
- Module-hiding selectors (Suggested / PYMK / News) are text heuristics that
  have NOT been validated against the live 2026 DOM yet — verify with a live
  feed inspection session before trusting them; they're opt-in (default off)
  for exactly this reason.
- Session hidden-count is per-tab and resets on page load (by design; the
  badge mirrors it per-tab). Lifetime stats persist in `storage.local`.
- Image/video-only posts (no text box) are only caught by the muted-author and
  Promoted filters, via a looser discovery heuristic (≥2 profile links +
  >80 chars of innerText).
- AI-post detection is heuristic-only (stylometric tells); an on-device model
  (e.g. Chrome's built-in Prompt API) could slot in as a second pass later.
  Signal phrases are English-only.
- Greyed-out toggle: dimfluencer detection reserved for a v2 with some
  external signal.
