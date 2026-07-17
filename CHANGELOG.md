# Changelog

All notable changes to Feed Cleaner for LinkedIn.

## 1.3.0 - 2026-07-17

### Added
- **Deep Focus**: hide the entire feed (and the LinkedIn News sidebar)
  behind a calm panel. Turn it on indefinitely or for one hour from the
  popup, or toggle it from the settings page. Independent of pause and
  snooze, so pausing the filters never reveals the feed mid-session.
  The panel offers "Show feed" (this tab only) and "End Deep Focus"
  (everywhere).
- **Right-click: mute a phrase**: select text in any post and right-click
  to add it to your muted phrases. Deduplicated, trimmed, and applied to
  the feed immediately.
- **Right-click: always show a post**: right-click a post (or its "post
  hidden" bar) to permanently exempt it from all filters.

### Changed
- Faster feed processing: muted phrases are compiled once instead of on
  every post, each post is analyzed in a single pass, and non-post feed
  units are no longer re-scanned on every sweep.
- Fast scrolling no longer leaves the last batch of lazily loaded posts
  unfiltered until the next feed activity.
- Unified styling between the popup and the settings page (shared
  stylesheet), so the two surfaces look and behave consistently.
- Clearer filter label: "Hide hook-bait posts" (was "Filter 12-line-hook
  posts", which never matched the actual thresholds).
- Removed all em dashes from user-facing text.

### Removed
- The non-functional "Hide dimfluencers (coming soon)" placeholder toggle.

## 1.2.0

### Added
- **Occasion filter**: hides LinkedIn template posts (new job, work
  anniversary, certificate announcements). Single-match precision since
  these are near-verbatim platform templates.
- Settings backup: export all settings to a JSON file and import them
  back, with strict validation of imported files. Fully local.
- Lifetime statistics on the settings page: total hidden and a
  per-reason breakdown.

## 1.1.0

### Added
- **AI-post filter**: weighted, fully local stylometric heuristic
  (signal phrases, em-dash density, emoji bullet lists, "not X, but Y"
  patterns) with its own sensitivity slider. Precision-first tuning.
- Ghost mode: dim filtered posts in place instead of collapsing them,
  useful for tuning sensitivity.

## 1.0.0

### Added
- Initial release: filters for Promoted posts, muted phrases (plain text
  or regex), hook-format posts with a sensitivity slider, and fake
  hustle stories.
- Posts are never deleted: they collapse into a "1 post hidden (reason)"
  bar with Show and Always show actions.
- Right-click menus to mute an author or always show an author.
- Popup with master pause, 30-minute snooze, per-filter toggles, and a
  per-tab hidden counter mirrored to the toolbar badge.
- Optional hiding of Suggested-for-you, People-you-may-know, and
  LinkedIn News modules.
- Supports both the 2026 LinkedIn feed DOM and the classic DOM.
- Everything runs locally: no external calls, no analytics, no tracking.
