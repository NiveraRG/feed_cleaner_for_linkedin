# Firefox Add-ons (AMO) submission - copy & checklist

Everything needed to submit **Feed Cleaner for LinkedIn** to
addons.mozilla.org. Not shipped in the extension package - reference only.
Companion to [STORE_LISTING.md](STORE_LISTING.md) (Chrome Web Store).

## Before you start

1. Create/sign in to a Firefox Account, then go to
   https://addons.mozilla.org/developers/ and click **Submit a New Add-on**.
   No fee, unlike Chrome's one-time $5.
2. Choose **"On this site"** (listed on AMO) rather than "Self-distribution" -
   listed add-ons get Mozilla's automated signing and a public listing page.
3. Upload the package built below.

## Manifest changes made for Firefox compatibility

Verified with Mozilla's own linter (`npx web-ext lint`) - 0 errors on the
final package. Three things Chrome doesn't need but Firefox requires:

- **`browser_specific_settings.gecko.id`**: `feed-cleaner-for-linkedin@niverarg.it`.
  This is a permanent identifier - Mozilla ties the listing to it, and it
  can't be changed later without publishing as a new add-on. Not a real
  email address, just a unique-looking string; doesn't need to resolve.
- **`background.scripts`** alongside `background.service_worker`: Chrome
  reads `service_worker`, Firefox reads `scripts` and ignores the other key
  (harmless "ignored" warning in the linter - expected). `background.js`
  uses no service-worker-only APIs, so the same file works unmodified in
  both.
- **`browser_specific_settings.gecko.data_collection_permissions`**: `{"required": ["none"]}`
  - Mozilla's own equivalent of Chrome's Privacy Practices tab, declared in
  the manifest instead of a dashboard form. `strict_min_version` bumped to
  `140.0` (`gecko_android` to `142.0`) because this key requires those
  versions - confirmed via linter, not guessed.

## Listing fields

**Name**
```
Feed Cleaner for LinkedIn
```

**Summary** (250 char max on AMO - more room than Chrome's 132)
```
Filters sponsored posts, hustle-bait, hook-bait spam, occasion posts, and AI-generated posts out of your LinkedIn feed - or hide the whole feed with Deep Focus. Mute authors and phrases, snooze filtering, see lifetime stats. 100% local, no tracking, no external servers.
```

**Categories:** Social & Communication (primary); Productivity if a second
category is offered.

**License:** MIT - select from AMO's license dropdown, or "Other" and paste
the [LICENSE](LICENSE) text if MIT isn't a preset option in your submission
flow.

**Support email:** the address in [privacy-policy.html](privacy-policy.html).

**Homepage / support site URL:**
```
https://github.com/NiveraRG/feed_cleaner_for_linkedin
```

**Privacy policy URL:**
```
https://niverarg.github.io/feed_cleaner_for_linkedin/privacy-policy.html
```
(Same hosted page used for the Chrome submission.)

### Detailed description

Reuse the Chrome Web Store description verbatim from
[STORE_LISTING.md](STORE_LISTING.md) - AMO's description field accepts the
same copy, no length constraint that would force a rewrite. Same for the
per-version release notes: reuse the "What's new in 1.3.0" block from
STORE_LISTING.md.

### Data collection disclosure (AMO submission flow)

AMO's upload flow reads `data_collection_permissions` from the manifest and
will show "None" - no additional dashboard form to fill in, unlike Chrome's
separate Privacy Practices tab.

### Source code

Not required - this submission is unminified, unbundled plain JS (no build
step), so AMO's "add-on isn't fully readable" source-code request doesn't
apply. If asked anyway, the GitHub repo above is the source.

### Screenshots

Reuse the same three PNGs already captured for Chrome
(`store-assets/screenshot-*-1280x800.png`) - AMO accepts the same image
sizes.

## Packaging for upload

Built and verified with Mozilla's own tool, not a hand-rolled zip - this
also runs `web-ext lint` against the final package to catch anything that
would fail AMO's automated review before you upload:

```bash
npx --yes web-ext build --source-dir . --overwrite-dest \
  --artifacts-dir "$TEMP/lfc-firefox-build" \
  --ignore-files "README.md" "STORE_LISTING.md" "FIREFOX_LISTING.md" \
    "CLAUDE.md" "LICENSE" ".gitignore" ".gitattributes" \
    "privacy-policy.html" "store-assets/**/*" "icons/*.svg" \
    "icons/icon128-mono.png"

npx --yes web-ext lint --source-dir "$TEMP/lfc-firefox-build" # sanity check
```

As of v1.3.0: produces `feed_cleaner_for_linkedin-1.3.0.zip`, 12
runtime files (same set as the Chrome package, incl. `ui.css`; verified
at 11 files for 1.2.0 on 2026-07-12), 0 lint errors, 0 notices -
one expected `BACKGROUND_SERVICE_WORKER_IGNORED` warning (the intentional
cross-browser fallback described above).

Upload that zip in AMO's submission flow. Mozilla's automated review is
typically much faster than Chrome's (often minutes to hours for a
straightforward add-on like this one, though manual review can add time).
