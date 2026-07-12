# Feed Cleaner for LinkedIn

A free Chrome extension that filters the noise out of your LinkedIn feed —
sponsored posts, hustle-bait, engagement-hook spam, and AI-generated
"slop" — so you see more of what you actually follow LinkedIn for.

Everything runs locally in your browser. No external servers, no analytics,
no tracking, no data ever leaves your machine. See the
[Privacy Policy](https://niverarg.github.io/feed_cleaner_for_linkedin/privacy-policy.html)
for details.

*Feed Cleaner for LinkedIn is an independent, unofficial project and is not
affiliated with, endorsed by, or sponsored by LinkedIn Corporation.*

## Install

**From the Chrome Web Store** *(recommended)* — search "Feed Cleaner for
LinkedIn" in the Chrome Web Store, or use the listing link once published.

**From source**, if you'd rather install it yourself:
1. Download or clone this repository.
2. Open `chrome://extensions` in Chrome.
3. Enable **Developer mode** (toggle, top right).
4. Click **Load unpacked** and select the folder.

## What it filters

Every filter can be turned on or off, and posts are **never deleted** —
they collapse into a one-line "post hidden (reason)" bar you can expand
again with one click, or dim in place if you turn on Ghost mode.

| Filter | What it catches |
| --- | --- |
| **Sponsored / Promoted** | Ads in the feed. |
| **Muted phrases** | Any phrase you choose — plain text or advanced regex, one per line. |
| **Occasion posts** | New-job announcements, work anniversaries, certificate/course-completion posts. |
| **Hook-format posts** | "The 3 things that changed my career:" style posts — many short punchy lines up top. Adjustable sensitivity. |
| **Fake hustle stories** | "$0 to $1M", "they laughed at me", "I got fired and then..." — the whole genre. |
| **AI-generated posts** | Posts that read like they were written by a chatbot. Adjustable sensitivity. |
| **Feed modules** *(optional)* | "Suggested for you," "People you may know," and the News sidebar. |

You can also:
- **Mute** or **always show** specific people — right-click their name in the feed.
- **Pause** filtering entirely, or **snooze** it for 30 minutes, from the toolbar.
- See **lifetime stats** on what's been hidden and why.
- **Export/import** all your settings as a file, to back them up or move to another machine.

Settings sync across your devices through Chrome's built-in sync, the same
way your bookmarks do — never through us.

## Known limitations

- "Promoted" and occasion-post detection currently match English-language
  labels only.
- AI-post and hook-format detection are heuristic, not perfect — you can
  always mark a wrongly-hidden post "Always show," or a person as allowed,
  to fix it permanently.

## Feedback / issues

Found a bug, or a post that should (or shouldn't) have been filtered?
Open an issue on this repository.

## License

MIT — see [LICENSE](LICENSE).
