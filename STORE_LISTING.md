# Chrome Web Store listing — copy & checklist

Everything needed to fill out the Developer Dashboard for **Feed Cleaner for
LinkedIn**. Not shipped in the extension package — reference only.

## Before you start

1. Register a Chrome Web Store developer account (one-time $5 fee):
   https://chrome.google.com/webstore/devconsole
2. Host [privacy-policy.html](privacy-policy.html) somewhere public (GitHub
   Pages is the easiest free option — enable Pages on this repo, or on a
   dedicated repo, and it'll be served at
   `https://<you>.github.io/<repo>/privacy-policy.html`). You'll paste that
   URL into the dashboard's Privacy Practices tab.
3. Run the packaging step at the bottom of this file to produce the .zip you
   upload.

## Store listing fields

**Name** (45 char max)
```
Feed Cleaner for LinkedIn
```

**Summary** (132 char max — shown in search results)
```
Filters sponsored posts, hustle-bait, hook-format spam, and AI-generated posts out of your LinkedIn feed. 100% local, no tracking.
```
(132 chars exactly — trim if the dashboard counts differently.)

**Category:** Productivity

**Language:** English

### Detailed description

```
Feed Cleaner for LinkedIn quietly filters the noise out of your LinkedIn
feed — right in your browser, with nothing sent anywhere.

WHAT IT FILTERS (each is a toggle, all on by default except feed modules)
• Sponsored / Promoted posts
• Muted phrases you choose ("humbled to announce", "thoughts?", etc. —
  add your own, plain text or regex)
• New-job / work-anniversary / certificate "occasion" template posts
• 12-line hook-format posts ("The 3 things that changed my career:")
• Fake hustle stories ("$0 to $1M", "they laughed at me", "I got fired…")
• AI-generated / stylometric "slop" posts
• Optional: Suggested-for-you / People-you-may-know / News sidebar modules

HOW IT WORKS
Nothing is ever deleted. Filtered posts collapse into a one-line "post
hidden (reason)" bar you can expand with one click, or mark "Always show."
Right-click any author to mute them forever, or to always show their
posts regardless of what the filters think. Snooze filtering for 30
minutes, or pause it entirely, right from the toolbar popup. A settings
page gives you sensitivity sliders, full control over every list, lifetime
stats on what's been hidden and why, and one-click backup/restore of all
your settings to a file.

PRIVACY
Everything runs locally in your browser. There are no external servers,
no analytics, no ads, and no data of any kind is sent anywhere. Your
settings sync across your own devices only through Chrome's built-in
sync (the same mechanism used for bookmarks) — never through us, because
there is no "us" to send it to.

Feed Cleaner for LinkedIn is an independent, unofficial project and is
not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.
"LinkedIn" is a trademark of LinkedIn Corporation.
```

### Privacy practices tab (Developer Dashboard)

When asked "What user data does your extension collect?":
- **Personally identifiable information**: select **No** in the sense of
  transmission — the extension reads author names/profile URLs already
  visible on the page and stores them locally (mute/allow lists), but never
  transmits them anywhere. If the dashboard forces a data-type selection,
  declare **"Personally identifiable information"** and **"Web history"**
  (the post text/URLs it reads) as *collected* but answer **"Data is not
  sold to third parties"** and **"Data is not used for purposes unrelated to
  the item's core functionality"** and **"Data is not used to determine
  creditworthiness or for lending purposes"** — all Yes/compliant.
- **Privacy policy URL**: the hosted URL from [privacy-policy.html](privacy-policy.html).
- **Single purpose statement**:
  ```
  Feed Cleaner for LinkedIn has a single purpose: to let a user filter
  unwanted posts out of their own LinkedIn feed based on user-configured
  rules (sponsored, phrases, format heuristics, muted/allowed authors).
  All filtering happens locally in the browser.
  ```
- **Host permission justification** (`https://www.linkedin.com/*`):
  ```
  Required to read and filter the LinkedIn feed's DOM on linkedin.com
  pages the user has open. LinkedIn is a single-page app, so the content
  script must match the whole origin (not just /feed) to keep working
  after in-app navigation back to the feed. No other site is accessed.
  ```
- **`storage` justification**:
  ```
  Stores the user's filter settings, muted/allowed author lists, and
  lifetime statistics locally via chrome.storage, so preferences persist
  across sessions and (via Chrome's own sync) across the user's devices.
  ```
- **`activeTab` justification**:
  ```
  Used defensively alongside the declared host permission; no additional
  data is accessed beyond what the host permission already covers.
  ```
- **`contextMenus` justification**:
  ```
  Adds two right-click menu items — "Hide this person's posts" and
  "Always show this person's posts" — so the user can manage per-author
  filtering without opening the settings page.
  ```

### Screenshots (required: at least one, 1280×800 or 640×400 PNG/JPEG)

Take these from your own live feed, not a stranger's:
1. The options/settings page (`options.html`) — shows the full feature set
   in one shot, no privacy concern since it's your own UI.
2. The popup with a few posts hidden and the count visible.
3. Optional: a hidden-post placeholder bar and a ghost-mode dimmed post,
   on your own posts or with names cropped/blurred.

Do **not** submit screenshots showing other real people's names, photos, or
post content without cropping/blurring — even though the extension itself
only reads what's already public, a store screenshot is a published image.

### Promo tiles (optional but recommended)

- Small tile: 440×280
- Marquee: 1400×560
Reuse the icon's color palette (`#0a66c2` blue, `#ff7a50` coral) so the
store listing matches the extension icon.

## Packaging for upload

The Web Store wants a .zip of exactly the runtime files — no README, no
this file, no source SVGs, no dev artifacts. From PowerShell, repo root:

```powershell
$pkg = "$env:TEMP\lfc-package"
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$pkg\icons" | Out-Null
Copy-Item manifest.json,shared.js,content.js,background.js,popup.html,popup.js,options.html,options.js -Destination $pkg
Copy-Item icons\icon16.png,icons\icon48.png,icons\icon128.png -Destination "$pkg\icons"
$zip = "$env:TEMP\feed-cleaner-for-linkedin.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$pkg\*" -DestinationPath $zip
```

Upload the resulting `feed-cleaner-for-linkedin.zip` (in `%TEMP%`) in the
dashboard's "Package" tab. Verified 2026-07-10: this produces exactly 11
files (manifest, 5 JS, 2 HTML, 3 PNGs) — no source SVGs, no docs, no
`.claude/` config.
