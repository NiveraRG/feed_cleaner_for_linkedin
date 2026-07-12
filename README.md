# Feed Cleaner for LinkedIn

A Chrome extension (Manifest V3, plain JS, no build step) that filters the
LinkedIn feed based on toggleable preferences. Everything runs locally —
no external API calls, no tracking, no data leaves your browser.

Not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.

## Install (load unpacked)

1. Open `chrome://extensions` in Chrome.
2. Enable **Developer mode** (toggle, top right).
3. Click **Load unpacked** and select this folder.
4. Open [linkedin.com/feed](https://www.linkedin.com/feed/). Click the
   toolbar icon for quick toggles + a session count, or the "Settings" link
   in the popup for the full options page (phrases, author lists, feed
   modules, stats, backup).

## How the filters work

Matched posts are **never deleted** — they collapse into a thin
`1 post hidden (reason) — Always show / Show` bar, or (in ghost mode) dim to
low opacity with a small tag. The popup shows a running count of posts
hidden this session; the toolbar badge mirrors it per tab.

| Filter | How it works |
| --- | --- |
| **Allowed authors / posts** | Right-click → *"Always show this person's posts,"* or click "Always show" on a placeholder bar. Wins over every other filter. |
| **Muted authors** | Right-click → *"Hide this person's posts."* Checked before every content filter. |
| **Sponsored / Promoted** | Text-match on a standalone "Promoted" header line. |
| **Muted phrases** | Case-insensitive match against post text. Plain text or `/regex/` syntax, one per line, editable in Settings. |
| **Occasion posts** | New-job, work-anniversary, and certificate template phrases — near-verbatim LinkedIn boilerplate, so one match hides. |
| **12-line-hook posts** | Many short lines in the first ~300 characters. Adjustable sensitivity: Loose / Medium / Strict. |
| **Fake hustle stories** | Scores against phrases like *"$0 to $1M"*, *"left my 6-figure job"*, *"they laughed at me."* Two+ matches hides; one match plus hook formatting also hides. |
| **AI-generated posts** | Weighted stylometric signal list (phrase tells + structural tells like em-dash density). Own sensitivity slider. |
| **Feed modules** *(opt-in, off by default)* | "Suggested for you," "People you may know," and the News sidebar — text-heuristic based, unvalidated against the live DOM; see [CLAUDE.md](CLAUDE.md). |
| **Dimfluencers** | Not implemented — no reliable local signal. Toggle stays greyed out. |

Other controls: a master pause switch, a 30-minute snooze, ghost mode
(dim instead of collapse), lifetime stats by reason, and JSON export/import
of your entire settings.

Settings persist via `chrome.storage.sync`, so they follow you across
devices when signed into Chrome.

## ⚠️ Selector fragility

LinkedIn's DOM structure **changes periodically** (class renames, feed
re-renders). The extension supports both feed variants LinkedIn currently
ships: the 2026 rewrite (obfuscated class names; hooks into
`data-testid="mainFeed"` / `expandable-text-box` and `data-lazy-mount-id`
post wrappers) and the classic DOM (`feed-shared-update-v2` etc.). If posts
stop being detected after a LinkedIn update, the selectors to fix are all
collected in one place: the `SELECTORS` object at the top of
[content.js](content.js). Inspect a live feed post with DevTools and update
them there.

Note: "Promoted" and occasion-phrase detection match English labels only.
If your LinkedIn UI language isn't English, add the localized phrases in
content.js.

## File structure

```
manifest.json         MV3 manifest — permissions: storage, activeTab, contextMenus
shared.js              Default settings — single source of truth, loaded everywhere
content.js             Filters, MutationObserver, collapse/ghost UI, context-menu handling
background.js          Service worker: context menus, per-tab badge, lifetime stats
popup.html/js          Quick toggle UI (pause, snooze, filters, sliders)
options.html/js        Full settings dashboard (phrases, authors, modules, stats, backup)
icons/                 16 / 48 / 128 PNGs + source SVGs
privacy-policy.html    Standalone privacy policy for the Web Store listing
STORE_LISTING.md       Copy + checklist for Chrome Web Store submission
```

## Publishing to the Chrome Web Store

See [STORE_LISTING.md](STORE_LISTING.md) for the listing copy, permission
justifications, privacy-practices answers, and the packaging command.
