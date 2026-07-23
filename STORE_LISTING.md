# Chrome Web Store listing - copy & checklist

Everything needed to fill out the Developer Dashboard for **Feed Cleaner for
LinkedIn**. Not shipped in the extension package - reference only.

## Before you start

1. Register a Chrome Web Store developer account (one-time $5 fee):
   https://chrome.google.com/webstore/devconsole
2. Host [privacy-policy.html](privacy-policy.html) somewhere public (GitHub
   Pages is the easiest free option - enable Pages on this repo, or on a
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

**Summary** (132 char max - shown in search results)
```
Filters sponsored posts, hustle-bait, hook-format spam, and AI-generated posts out of your LinkedIn feed. 100% local, no tracking.
```
(132 chars exactly - trim if the dashboard counts differently.)

**Category:** Productivity

**Language:** English

### Detailed description

```
Feed Cleaner for LinkedIn quietly filters the noise out of your LinkedIn
feed - right in your browser, with nothing sent anywhere.

WHAT IT FILTERS (each is a toggle, all on by default except Network-only and feed modules)
• Sponsored / Promoted posts
• Muted phrases you choose ("humbled to announce", "thoughts?", etc. -
  add your own, plain text or regex)
• Optional: Only show first-degree connections and accounts you follow
• New-job / work-anniversary / certificate "occasion" template posts
• Hook-bait posts built from stacks of one-line "hook" sentences
  ("The 3 things that changed my career:")
• Fake hustle stories ("$0 to $1M", "they laughed at me", "I got fired…")
• AI-generated / stylometric "slop" posts
• Optional: Suggested-for-you / People-you-may-know / News sidebar modules

DEEP FOCUS
Need to post or message without getting pulled into the feed? Deep Focus
hides the entire feed (and the News sidebar) behind a calm panel - turn
it on indefinitely or for one hour, right from the popup.

HOW IT WORKS
Nothing is ever deleted. Filtered posts collapse into a one-line "post
hidden (reason)" bar you can expand with one click, or mark "Always show."
Right-click any author to mute them forever, right-click selected text to
mute that phrase, or mark a post "Always show" - all without leaving the
feed. Snooze filtering for 30
minutes, or pause it entirely, right from the toolbar popup. A settings
page gives you sensitivity sliders, full control over every list, lifetime
stats on what's been hidden and why, and one-click backup/restore of all
your settings to a file.

PRIVACY
Everything runs locally in your browser. There are no external servers,
no analytics, no ads, and no data of any kind is sent anywhere. Your
settings sync across your own devices only through Chrome's built-in
sync (the same mechanism used for bookmarks) - never through us, because
there is no "us" to send it to.

Feed Cleaner for LinkedIn is an independent, unofficial project and is
not affiliated with, endorsed by, or sponsored by LinkedIn Corporation.
"LinkedIn" is a trademark of LinkedIn Corporation.
```

### Privacy practices tab (Developer Dashboard)

When asked "What user data does your extension collect?":
- **Personally identifiable information**: select **No** in the sense of
  transmission - the extension reads author names/profile URLs already
  visible on the page and stores them locally (mute/allow lists), but never
  transmits them anywhere. If the dashboard forces a data-type selection,
  declare **"Personally identifiable information"** and **"Web history"**
  (the post text/URLs it reads) as *collected* but answer **"Data is not
  sold to third parties"** and **"Data is not used for purposes unrelated to
  the item's core functionality"** and **"Data is not used to determine
  creditworthiness or for lending purposes"** - all Yes/compliant.
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
  Adds four right-click menu items - "Hide this person's posts",
  "Always show this person's posts", "Always show this post", and
  "Mute posts containing <selected text>" - so the user can manage
  filtering without opening the settings page.
  ```

### Screenshots (required: at least one, 1280×800 or 640×400 PNG/JPEG)

Ready-to-upload designed screenshots live in [store-assets/](store-assets/)
(1280×800 PNG, generated by `store-assets/gen_assets.py` - vector recreations
of the real UI, no real names/content, so no privacy concerns):
1. `screenshot-1-popup-1280x800.png` - popup with annotated callouts
2. `screenshot-2-feed-1280x800.png` - collapsed "1 post hidden" bars + ghost mode
3. `screenshot-3-stats-1280x800.png` - stats + backup panels

If you prefer real captures instead, take these from your own live feed, not
a stranger's:
1. The options/settings page (`options.html`) - shows the full feature set
   in one shot, no privacy concern since it's your own UI.
2. The popup with a few posts hidden and the count visible.
3. Optional: a hidden-post placeholder bar and a ghost-mode dimmed post,
   on your own posts or with names cropped/blurred.

Do **not** submit screenshots showing other real people's names, photos, or
post content without cropping/blurring - even though the extension itself
only reads what's already public, a store screenshot is a published image.

### Promo tiles (optional but recommended)

- Small tile: 440×280 - ready: [store-assets/small-promo-tile-440x280.png](store-assets/small-promo-tile-440x280.png)
- Marquee: 1400×560 - ready: [store-assets/marquee-promo-tile-1400x560.png](store-assets/marquee-promo-tile-1400x560.png)
Both reuse the icon's palette (`#0a66c2` blue, `#ff7a50` coral) and can be
regenerated with `store-assets/gen_assets.py` (needs Python + cairosvg +
ImageMagick). `store-assets/` is reference-only - it is NOT part of the
uploaded .zip (see packaging below, which copies runtime files explicitly).

## Packaging for upload

The Web Store wants a .zip of exactly the runtime files - no README, no
this file, no source SVGs, no dev artifacts. From PowerShell, repo root:

```powershell
$pkg = "$env:TEMP\lfc-package"
if (Test-Path $pkg) { Remove-Item $pkg -Recurse -Force }
New-Item -ItemType Directory -Force -Path "$pkg\icons" | Out-Null
Copy-Item manifest.json,shared.js,content.js,background.js,popup.html,popup.js,options.html,options.js,ui.css -Destination $pkg
Copy-Item icons\icon16.png,icons\icon48.png,icons\icon128.png -Destination "$pkg\icons"
$zip = "$env:TEMP\feed-cleaner-for-linkedin.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path "$pkg\*" -DestinationPath $zip
```

Upload the resulting `feed-cleaner-for-linkedin.zip` (in `%TEMP%`) in the
dashboard's "Package" tab. As of v1.3.0 this produces exactly 12 files
(manifest, 5 JS, 2 HTML, 1 CSS, 3 PNGs) - no source SVGs, no docs, no
`.claude/` config.

## What's new in 1.3.0 (for the dashboard's release notes field)

```
• NEW - Deep Focus: hide the entire feed (and the News sidebar) behind a
  calm panel, indefinitely or for one hour, straight from the popup.
• NEW - Right-click selected text in a post to mute that phrase, and
  right-click any post to mark it "Always show".
• Faster: filter rules are precompiled and each post is analyzed in a
  single pass, so heavy scrolling stays smooth.
• UI polish: unified styling between popup and settings, clearer filter
  labels, removed the unfinished "dimfluencers" placeholder toggle.
• As always: 100% local, no tracking, nothing leaves your browser.
```
