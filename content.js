// Feed Cleaner for LinkedIn - content script
// Watches the feed for posts (including lazy-loaded ones), runs each post
// through a set of independent filters, and collapses matches into a thin
// "post hidden" placeholder bar (or dims them, in ghost mode) instead of
// deleting them.
//
// LinkedIn currently ships TWO different feed DOMs:
//  - "new" (2026 rewrite): obfuscated hashed class names, but stable
//    data-testid hooks - mainFeed / expandable-text-box - and posts wrapped
//    in div[data-lazy-mount-id] units that mount their content lazily.
//  - "classic": semantic class names like feed-shared-update-v2.
// We support both; the new DOM is tried first.
//
// LFC_DEFAULTS comes from shared.js, injected before this file (manifest).

(() => {
  'use strict';

  // ---------------------------------------------------------------------
  // Selectors - the fragile part. Update these when LinkedIn ships a redesign.
  // ---------------------------------------------------------------------
  const SELECTORS = {
    // New DOM: the feed column and its per-post lazy-mount wrappers.
    feed: '[data-testid="mainFeed"]',
    newPost: '[data-testid="mainFeed"] > div[data-lazy-mount-id]',
    newPostText: '[data-testid="expandable-text-box"]',
    // Classic DOM fallbacks.
    classicFeed: 'main .scaffold-finite-scroll, .scaffold-layout__main .core-rail',
    classicPost: 'div.feed-shared-update-v2, div[data-id^="urn:li:activity"]',
    classicPostText: '.update-components-text, .feed-shared-update-v2__description',
    classicActorName: '.update-components-actor__title span[aria-hidden="true"], .update-components-actor__title',
    // Works in both DOMs: any profile/company link inside the post.
    profileLink: 'a[href*="/in/"], a[href*="/company/"]',
  };

  const MARKER = 'lfcProcessed'; // dataset flag so we never process a post twice
  const MODULE_MARKER = 'lfcModule'; // dataset flag for hidden non-post modules
  const MODULE_SCANNED = 'lfcModScanned'; // unit classified by hideModules - skip next sweep

  // Reloading the extension in chrome://extensions leaves this content
  // script running in already-open tabs; any chrome.* call it then makes
  // throws "Extension context invalidated". Once that happens the page
  // needs a refresh anyway, so detect it, tear down the observer/listeners,
  // and stop instead of throwing on every future feed mutation.
  let contextInvalidated = false;
  let feedObserver = null;
  function isContextValid() {
    if (contextInvalidated) return false;
    if (!chrome.runtime || !chrome.runtime.id) {
      contextInvalidated = true;
      return false;
    }
    return true;
  }
  function invalidateContext() {
    contextInvalidated = true;
    if (feedObserver) feedObserver.disconnect();
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
  }

  // Every chrome.* call the content script makes after load goes through
  // here. Two failure modes to cover: the synchronous "Extension context
  // invalidated" throw (caught below), and - because MV3 APIs return a
  // promise when called WITHOUT a callback - unhandled rejections. So call
  // sites must always pass a callback (swallowLastError at minimum), which
  // keeps the API in callback mode and routes failures to lastError instead.
  function safeChromeCall(fn) {
    if (!isContextValid()) return;
    try {
      fn();
    } catch {
      invalidateContext();
    }
  }

  function swallowLastError() {
    void chrome.runtime.lastError;
  }

  let settings = { ...LFC_DEFAULTS };
  let hiddenCount = 0; // posts hidden this session (this tab)
  let refreshTimer = null; // fires reprocessFeed() when a snooze / focus session expires
  let deepFocusRevealed = false; // "Show feed" clicked - this tab, this page-view only

  // Filtering is active only when the master switch is on and no snooze is
  // running. While inactive, sweeps still run (cheap) but hide nothing.
  function filteringActive() {
    return settings.enabled && Date.now() >= (settings.snoozeUntil || 0);
  }

  // Deep Focus is deliberately NOT gated on filteringActive() - see shared.js.
  function deepFocusActive() {
    return settings.deepFocus || Date.now() < (settings.deepFocusUntil || 0);
  }

  // Phrases that signal a "fake hustle story". 2+ matches => hide.
  const HUSTLE_PHRASES = [
    /\$0 to \$\d/i,
    /left my 6[- ]figure job/i,
    /everyone told me/i,
    /no degree,? no connections/i,
    /dropped out/i,
    /they laughed at me/i,
    /from my (garage|bedroom|parents'? (basement|couch))/i,
    /fired from my job/i,
    /\d+ figures? in \d+ (days|weeks|months)/i,
    /quit my (corporate )?job/i,
  ];

  // LinkedIn template posts: new job, work anniversary, certificates, and
  // similar "occasion" announcements. These are near-verbatim platform
  // templates, so a single match is high-precision - hide on 1 hit.
  const OCCASION_PHRASES = [
    /i['’]m (happy|excited|thrilled|proud|pleased) to (share|announce) that i['’]m (starting|beginning|joining)/i,
    /starting a new position as/i,
    /celebrating \d+ years? at /i,
    /work anniversar(y|ies)/i,
    /i['’]?ve (just )?(completed|earned|obtained|received) (my|a|the) .{0,40}(certificat|certification|badge|course)/i,
    /officially (a |an )?(certified|graduate)/i,
  ];

  // Signals that a post reads like AI slop. Each signal is a regex (or a
  // function over the whole text for structural patterns) with a weight;
  // the weighted sum is compared against AI_THRESHOLDS[aiSensitivity].
  // Tuned precision-first: a post needs two strong tells, or one strong tell
  // plus a couple of weak/structural ones, before it gets hidden at "medium".
  const AI_SIGNALS = [
    // Strong phrase tells.
    { weight: 2, re: /let that sink in/i },
    { weight: 2, re: /here['’]s the (kicker|thing|hard truth)/i },
    { weight: 2, re: /i asked (chatgpt|ai|claude)/i },
    { weight: 2, re: /^\s*(the result\?|the best part\?|the takeaway\?|the lesson\?)\s*$/im },
    { weight: 2, re: /in today['’]s fast-paced (world|environment|landscape)/i },
    // Weak phrase tells.
    { weight: 1, re: /\b(delve|tapestry|testament to|game-?chang(er|ing)|paradigm shift|unlock(ing)? (your|the) potential|double[- ]edged sword|elephant in the room)\b/i },
    { weight: 1, re: /it['’]s not (just )?about [^.\n]{3,60}[.;,] it['’]s about /i },
    { weight: 1, fn: (t) => /🚀|✨/.test(t) && /excit(ed|ing)|thrilled/i.test(t) },
    // Structural tells.
    {
      weight: 1,
      fn: (t) => {
        const dashes = (t.match(/—/g) || []).length;
        return dashes >= 3 && dashes / t.length > 1 / 150;
      },
    },
    {
      weight: 1,
      fn: (t) =>
        t
          .split('\n')
          .filter((l) => /^\s*[✅🔥💡👉➡️✨📌🎯❌⭐🚫]/u.test(l)).length >= 3,
    },
    { weight: 1, fn: (t) => (t.match(/not [^.\n]{2,40}, but /gi) || []).length >= 2 },
  ];

  // Minimum AI-signal score to hide, per sensitivity level (strict hides more).
  const AI_THRESHOLDS = { loose: 6, medium: 4, strict: 3 };

  // Hook heuristic thresholds per sensitivity level.
  const HOOK_THRESHOLDS = {
    loose: { maxLines: 8, maxAvgLineLen: 30 },
    medium: { maxLines: 5, maxAvgLineLen: 40 },
    strict: { maxLines: 3, maxAvgLineLen: 50 },
  };

  // ---------------------------------------------------------------------
  // Post discovery + inspection
  // ---------------------------------------------------------------------

  // All feed units that currently look like real posts (content mounted).
  // New-DOM lazy wrappers start empty, so a unit that isn't recognizable yet
  // is simply skipped and re-checked on the next mutation sweep.
  function findPosts() {
    const newPosts = [...document.querySelectorAll(SELECTORS.newPost)].filter(
      (p) =>
        p.querySelector(SELECTORS.newPostText) ||
        isPromotedHeader(p) ||
        // image/video-only reshares: needs at least a profile link + some bulk
        (p.querySelectorAll(SELECTORS.profileLink).length >= 2 &&
          (p.innerText || '').length > 80)
    );
    if (newPosts.length) return newPosts;
    return [...document.querySelectorAll(SELECTORS.classicPost)];
  }

  function getPostText(post) {
    const el =
      post.querySelector(SELECTORS.newPostText) ||
      post.querySelector(SELECTORS.classicPostText);
    return el ? el.innerText.trim() : '';
  }

  function getAuthor(post) {
    // Classic DOM has a dedicated actor-name node.
    const classicName = post.querySelector(SELECTORS.classicActorName);
    if (classicName) {
      const link = post.querySelector(SELECTORS.profileLink);
      return {
        name: classicName.innerText.trim(),
        url: link ? normalizeUrl(link.href) : '',
      };
    }
    // New DOM: the author is the LAST named profile link that appears before
    // the post text. (Earlier named links are "X commented on this" headers.)
    const textBox = post.querySelector(SELECTORS.newPostText);
    const links = [...post.querySelectorAll(SELECTORS.profileLink)];
    let best = null;
    for (const a of links) {
      const name = (a.innerText || '').trim().split('\n')[0].trim();
      if (!name) continue;
      if (
        textBox &&
        !(a.compareDocumentPosition(textBox) & Node.DOCUMENT_POSITION_FOLLOWING)
      ) {
        break; // we've passed the post body - stop
      }
      best = { name, url: normalizeUrl(a.href) };
    }
    return best || { name: '', url: '' };
  }

  function normalizeUrl(href) {
    // Strip query params / trailing slash so URLs compare cleanly.
    return (href || '').split('?')[0].replace(/\/$/, '');
  }

  // Per-evaluation cache so one shouldHide() pass reads each expensive
  // source (getPostText, getAuthor, post.innerText - the last one forces a
  // reflow) exactly once, however many filters consult it.
  function makeCtx(post) {
    return { post, text: null, innerText: null, author: null };
  }
  function ctxText(ctx) {
    if (ctx.text === null) ctx.text = getPostText(ctx.post);
    return ctx.text;
  }
  function ctxInnerText(ctx) {
    if (ctx.innerText === null) ctx.innerText = ctx.post.innerText || '';
    return ctx.innerText;
  }
  function ctxAuthor(ctx) {
    if (ctx.author === null) ctx.author = getAuthor(ctx.post);
    return ctx.author;
  }

  // Stable-ish identity for "always show this post": author URL + a text
  // prefix. Survives page reloads; collisions are harmless (worst case an
  // identical repost by the same author stays visible too).
  function postKeyFromCtx(ctx) {
    const { url, name } = ctxAuthor(ctx);
    const text = ctxText(ctx).slice(0, 80);
    if (!text && !url && !name) return '';
    return `${url || name}|${text}`;
  }
  function postKey(post) {
    return postKeyFromCtx(makeCtx(post));
  }

  function authorMatches(list, author) {
    return list.some(
      (a) =>
        (a.url && author.url && a.url === author.url) ||
        (a.name &&
          author.name &&
          a.name.toLowerCase() === author.name.toLowerCase())
    );
  }

  // ---------------------------------------------------------------------
  // Filters - each takes the post element (or its text) and returns true = hide.
  // ---------------------------------------------------------------------

  // 0. Allowlist - wins over everything. Never hide these.
  function isAllowed(ctx) {
    if (
      settings.allowedAuthors.length &&
      authorMatches(settings.allowedAuthors, ctxAuthor(ctx))
    ) {
      return true;
    }
    if (settings.allowedPosts.length) {
      const key = postKeyFromCtx(ctx);
      if (key && settings.allowedPosts.includes(key)) return true;
    }
    return false;
  }

  // 1. Manual mute list - checked first, before content filters.
  function isMutedAuthor(ctx) {
    if (!settings.mutedAuthors.length) return false;
    return authorMatches(settings.mutedAuthors, ctxAuthor(ctx));
  }

  // 2. Sponsored / Promoted posts. "Promoted" appears as a standalone header
  // line (where the post age normally sits) - sometimes with a sponsor name,
  // e.g. "Promoted by KNOWLIMITS Group a.s." - so we match an exact line or
  // an exact "Promoted by " prefix in the first dozen lines. This avoids
  // false positives on posts that merely mention the word "Promoted".
  function isPromotedText(innerText) {
    const lines = (innerText || '').split('\n', 14);
    return lines.some((l) => {
      const t = l.trim();
      return t === 'Promoted' || t.startsWith('Promoted by ');
    });
  }

  // Element-based variant for findPosts(), which runs before any ctx exists.
  function isPromotedHeader(post) {
    return isPromotedText(post.innerText);
  }

  function isPromoted(ctx) {
    return settings.filterPromoted && isPromotedText(ctxInnerText(ctx));
  }

  // 3. Keyword / phrase muting against post text. Plain lines are escaped
  // and matched case-insensitively; /slash-wrapped/ lines are real regexes.
  function phraseToRegex(phrase) {
    const m = phrase.match(/^\/(.+)\/([a-z]*)$/is);
    if (m) {
      try {
        // Force case-insensitive to match plain-phrase behavior.
        return new RegExp(m[1], m[2].includes('i') ? m[2] : m[2] + 'i');
      } catch {
        // Invalid pattern - fall through and treat the line literally.
      }
    }
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(escaped, 'i');
  }

  // Muted phrases are recompiled only when the setting changes (settings
  // load + storage.onChanged), not per post per sweep.
  let compiledPhrases = [];
  function compilePhrases() {
    compiledPhrases = (settings.mutedPhrases || [])
      .map((phrase) => String(phrase).trim())
      .filter(Boolean)
      .map((p) =>
        // "thoughts?" only counts as a standalone CTA line, not mid-sentence.
        p.toLowerCase() === 'thoughts?'
          ? { standalone: true, re: /^thoughts\?+$/i }
          : { standalone: false, re: phraseToRegex(p) }
      );
  }

  function matchesMutedPhrase(text) {
    if (!settings.filterKeywords || !text || !compiledPhrases.length) return false;
    let lines = null; // lazily split - most phrases match against full text
    return compiledPhrases.some(({ standalone, re }) => {
      if (standalone) {
        if (!lines) lines = text.split('\n').map((l) => l.trim());
        return lines.some((l) => re.test(l));
      }
      return re.test(text);
    });
  }

  // 4. "12-line hook" heuristic: many very short lines at the top of a post.
  function looksLikeHookPost(text) {
    if (!text) return false;
    const head = text.slice(0, 300);
    const lines = head.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length < 2) return false;
    const avgLen = lines.reduce((sum, l) => sum + l.length, 0) / lines.length;
    const t = HOOK_THRESHOLDS[settings.hookSensitivity] || HOOK_THRESHOLDS.medium;
    return lines.length > t.maxLines && avgLen < t.maxAvgLineLen;
  }

  function isHookPost(text) {
    return settings.filterHooks && looksLikeHookPost(text);
  }

  // 5. "Fake hustle story": hook-shaped AND scores 2+ on the hustle phrase list.
  function isHustleStory(text) {
    if (!settings.filterHustle || !text) return false;
    const score = HUSTLE_PHRASES.reduce(
      (n, re) => n + (re.test(text) ? 1 : 0),
      0
    );
    if (score >= 2) return true;
    // Hook format + at least one hustle phrase is also a strong signal.
    return score >= 1 && looksLikeHookPost(text);
  }

  // 6. Occasion template posts: single match hides (platform templates).
  function isOccasionPost(text) {
    if (!settings.filterOccasions || !text) return false;
    return OCCASION_PHRASES.some((re) => re.test(text));
  }

  // 7. AI-generated post heuristic: weighted stylometric signals, all local.
  function aiScore(text) {
    return AI_SIGNALS.reduce((sum, s) => {
      const hit = s.re ? s.re.test(text) : s.fn(text);
      return sum + (hit ? s.weight : 0);
    }, 0);
  }

  function isAIPost(text) {
    if (!settings.filterAI || !text) return false;
    const threshold = AI_THRESHOLDS[settings.aiSensitivity] || AI_THRESHOLDS.medium;
    return aiScore(text) >= threshold;
  }

  // Run all filters; return a human-readable reason, or null to keep the post.
  function shouldHide(ctx) {
    if (!filteringActive()) return null;
    if (isAllowed(ctx)) return null;
    if (isMutedAuthor(ctx)) return 'muted author';
    if (isPromoted(ctx)) return 'promoted';
    const text = ctxText(ctx);
    if (matchesMutedPhrase(text)) return 'muted phrase';
    if (isOccasionPost(text)) return 'occasion post'; // template posts: most specific
    if (isHustleStory(text)) return 'hustle story'; // before hook: more specific
    if (isAIPost(text)) return 'AI-generated'; // before hook: more specific
    if (isHookPost(text)) return 'hook format';
    return null;
  }

  // ---------------------------------------------------------------------
  // Hide / show UI - collapse into a placeholder bar (or dim, in ghost
  // mode), never delete.
  // ---------------------------------------------------------------------

  function reportHidden(reason) {
    hiddenCount++;
    // Badge (per-tab) and lifetime stats both live in the background
    // worker; sendMessage never hits the sync-storage write quota.
    safeChromeCall(() => {
      chrome.runtime.sendMessage({ type: 'lfc-count', count: hiddenCount }, swallowLastError);
      chrome.runtime.sendMessage({ type: 'lfc-hidden', reason }, swallowLastError);
    });
  }

  function makeBarButton(text) {
    const btn = document.createElement('button');
    btn.textContent = text;
    btn.style.cssText =
      'border:none;background:none;color:#0a66c2;font-weight:600;' +
      'cursor:pointer;font-size:12px;padding:2px 8px;';
    return btn;
  }

  // Persist "always show this post" and un-hide it. The allowedPosts list is
  // capped FIFO so it can't outgrow the sync-storage item quota.
  function allowPostForever(post) {
    const key = postKey(post);
    if (!key) return;
    if (settings.allowedPosts.includes(key)) return;
    const updated = [...settings.allowedPosts, key].slice(-LFC_MAX_ALLOWED_POSTS);
    // storage.onChanged updates `settings` and reprocesses the feed.
    safeChromeCall(() =>
      chrome.storage.sync.set({ allowedPosts: updated }, swallowLastError)
    );
  }

  function collapsePost(post, reason) {
    // Post can be detached between findPosts() and here (feed re-render);
    // inserting the placeholder would throw on a null parent.
    if (!post.parentNode) return;

    if (settings.ghostMode) {
      ghostPost(post, reason);
      return;
    }

    post.style.display = 'none';

    const bar = document.createElement('div');
    bar.className = 'lfc-placeholder';
    bar.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:6px 16px;margin:4px 0;font-size:12px;color:#666;' +
      'background:#f3f2ef;border:1px solid #e0dfdc;border-radius:8px;';

    const label = document.createElement('span');
    label.textContent = `1 post hidden (${reason})`;

    const actions = document.createElement('span');
    const showBtn = makeBarButton('Show');
    showBtn.addEventListener('click', () => {
      post.style.display = '';
      bar.remove();
    });
    const alwaysBtn = makeBarButton('Always show');
    alwaysBtn.title = 'Never hide this post again';
    alwaysBtn.addEventListener('click', () => {
      post.style.display = '';
      bar.remove();
      allowPostForever(post);
    });
    actions.append(alwaysBtn, showBtn);

    bar.append(label, actions);
    post.parentNode.insertBefore(bar, post);
    reportHidden(reason);
  }

  // Ghost mode: dim the post in place with a small reason tag on top.
  // Clicking the tag restores full opacity (this sweep only).
  function ghostPost(post, reason) {
    post.style.opacity = '0.35';
    post.dataset.lfcGhost = '1';

    const tag = document.createElement('div');
    tag.className = 'lfc-placeholder lfc-ghost-tag';
    tag.style.cssText =
      'font-size:11px;color:#666;background:#f3f2ef;border:1px solid #e0dfdc;' +
      'border-radius:6px;padding:2px 10px;margin:4px 0;display:flex;' +
      'align-items:center;justify-content:space-between;';
    const label = document.createElement('span');
    label.textContent = `hidden (${reason}) - ghost mode`;
    const restore = makeBarButton('Restore');
    restore.addEventListener('click', () => {
      post.style.opacity = '';
      tag.remove();
    });
    tag.append(label, restore);
    post.parentNode.insertBefore(tag, post);
    reportHidden(reason);
  }

  // ---------------------------------------------------------------------
  // Non-post module hiding ("Suggested for you", PYMK, News sidebar).
  // Opt-in; heuristics are text-based because the 2026 DOM has no semantic
  // hooks for these. Hidden modules get no placeholder (they're chrome, not
  // content) but do count toward stats.
  // ---------------------------------------------------------------------

  const MODULE_HEADERS = {
    suggested: [/^suggested( for you)?$/i, /^recommended for you$/i],
    pymk: [/^people you may know$/i, /^add to your feed$/i, /^people to follow$/i],
  };

  function moduleType(unitText) {
    // Match against the unit's first few non-empty lines only - a real post
    // quoting "people you may know" mid-body must not trigger this.
    const lines = (unitText || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 3);
    for (const [type, patterns] of Object.entries(MODULE_HEADERS)) {
      if (lines.some((l) => patterns.some((re) => re.test(l)))) return type;
    }
    return null;
  }

  function hideModules() {
    if (!filteringActive()) return;
    const wants = settings.hideModules || {};
    if (wants.suggested || wants.pymk) {
      const units = document.querySelectorAll(
        `${SELECTORS.newPost}, ${SELECTORS.classicPost}`
      );
      for (const unit of units) {
        if (
          unit.dataset[MODULE_MARKER] ||
          unit.dataset[MARKER] ||
          unit.dataset[MODULE_SCANNED]
        ) {
          continue;
        }
        // Only treat unit as a module if it has NO post text box - real
        // posts always have one; modules are link/card grids.
        if (unit.querySelector(SELECTORS.newPostText) ||
            unit.querySelector(SELECTORS.classicPostText)) {
          unit.dataset[MODULE_SCANNED] = '1'; // real post - never a module
          continue;
        }
        const text = unit.innerText || '';
        const type = moduleType(text);
        if (type && wants[type]) {
          unit.dataset[MODULE_MARKER] = type;
          unit.style.display = 'none';
          reportHidden('module');
          continue;
        }
        // Mark only units with enough mounted content to classify with
        // confidence; empty/half-mounted lazy wrappers must stay unmarked so
        // the next sweep re-checks them once their content arrives.
        if (
          text.length > 80 &&
          text.split('\n').filter((l) => l.trim()).length >= 3
        ) {
          unit.dataset[MODULE_SCANNED] = '1';
        }
      }
    }
    if (wants.news) {
      for (const aside of document.querySelectorAll('aside')) {
        if (aside.dataset[MODULE_MARKER]) continue;
        if (/linkedin news|top stories/i.test((aside.innerText || '').slice(0, 400))) {
          aside.dataset[MODULE_MARKER] = 'news';
          aside.style.display = 'none';
          reportHidden('module');
        }
      }
    }
  }

  function unhideModules() {
    document.querySelectorAll('[data-lfc-module]').forEach((el) => {
      el.style.display = '';
      delete el.dataset[MODULE_MARKER];
    });
    // Clear scan markers too, so toggling a module setting re-evaluates
    // units that were previously classified as "not a wanted module".
    document.querySelectorAll('[data-lfc-mod-scanned]').forEach((el) => {
      delete el.dataset[MODULE_SCANNED];
    });
  }

  // ---------------------------------------------------------------------
  // Deep Focus - hide the whole feed behind a calm panel. Independent of
  // pause/snooze; owns its own panel class + teardown (NOT .lfc-placeholder,
  // so reprocessFeed's blanket bar removal can't orphan a hidden feed).
  // ---------------------------------------------------------------------

  const DF_MARKER = 'lfcDeepfocus'; // dataset flag on the hidden feed container
  const DF_NEWS = 'news-df'; // MODULE_MARKER value for asides Deep Focus hid

  function buildDeepFocusPanel() {
    const panel = document.createElement('div');
    panel.className = 'lfc-deepfocus-panel';
    panel.style.cssText =
      'padding:28px 24px;margin:8px 0;text-align:center;font-size:14px;' +
      'color:#444;background:#f3f2ef;border:1px solid #e0dfdc;border-radius:10px;';
    const title = document.createElement('div');
    title.textContent = 'Deep Focus is on';
    title.style.cssText = 'font-weight:600;font-size:16px;margin-bottom:4px;';
    const sub = document.createElement('div');
    const until = settings.deepFocusUntil || 0;
    sub.textContent =
      !settings.deepFocus && until > Date.now()
        ? `Your feed is hidden until ${new Date(until).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}.`
        : 'Your feed is hidden.';
    sub.style.cssText = 'font-size:13px;color:#666;margin-bottom:12px;';
    const actions = document.createElement('div');
    const showBtn = makeBarButton('Show feed');
    showBtn.title = 'Reveal the feed in this tab only';
    showBtn.addEventListener('click', () => {
      deepFocusRevealed = true;
      removeDeepFocus();
      processAllPosts(); // normal filtering resumes on the revealed feed
    });
    const endBtn = makeBarButton('End Deep Focus');
    endBtn.addEventListener('click', () => {
      // storage.onChanged reprocesses every LinkedIn tab.
      safeChromeCall(() =>
        chrome.storage.sync.set({ deepFocus: false, deepFocusUntil: 0 }, swallowLastError)
      );
    });
    actions.append(showBtn, endBtn);
    panel.append(title, sub, actions);
    return panel;
  }

  // Returns true while Deep Focus owns the page (callers skip post/module work).
  function applyDeepFocus() {
    if (!deepFocusActive() || deepFocusRevealed) {
      removeDeepFocus();
      return false;
    }
    const feed =
      document.querySelector(SELECTORS.feed) ||
      document.querySelector(SELECTORS.classicFeed);
    // No recognizable feed container (profile page, or DOM changed): fall
    // back to normal per-post filtering rather than doing nothing at all.
    if (!feed) return false;
    if (!feed.dataset[DF_MARKER] || !document.querySelector('.lfc-deepfocus-panel')) {
      document.querySelectorAll('.lfc-deepfocus-panel').forEach((p) => p.remove());
      feed.dataset[DF_MARKER] = '1';
      feed.style.display = 'none';
      feed.parentNode.insertBefore(buildDeepFocusPanel(), feed);
    }
    // A focus mode that leaves LinkedIn News glowing in the sidebar isn't
    // one - hide it too, tagged separately from the hideModules.news flow.
    for (const aside of document.querySelectorAll('aside')) {
      if (aside.dataset[MODULE_MARKER]) continue;
      if (/linkedin news|top stories/i.test((aside.innerText || '').slice(0, 400))) {
        aside.dataset[MODULE_MARKER] = DF_NEWS;
        aside.style.display = 'none';
      }
    }
    return true;
  }

  function removeDeepFocus() {
    document.querySelectorAll('.lfc-deepfocus-panel').forEach((p) => p.remove());
    document.querySelectorAll('[data-lfc-deepfocus]').forEach((feed) => {
      feed.style.display = '';
      delete feed.dataset[DF_MARKER];
    });
    document.querySelectorAll(`[data-lfc-module="${DF_NEWS}"]`).forEach((el) => {
      el.style.display = '';
      delete el.dataset[MODULE_MARKER];
    });
  }

  // ---------------------------------------------------------------------
  // Processing loop
  // ---------------------------------------------------------------------

  function processPost(post) {
    if (post.dataset[MARKER] || post.dataset[MODULE_MARKER]) return;
    post.dataset[MARKER] = '1';
    const reason = shouldHide(makeCtx(post));
    if (reason) collapsePost(post, reason);
  }

  function processAllPosts() {
    // Deep Focus first: while it owns the page the feed is hidden wholesale,
    // so per-post and module work would be wasted (and invisible).
    if (applyDeepFocus()) return;
    // Modules first: a PYMK unit can look like a post to findPosts() (many
    // profile links); if processPost marked it first, the module check would
    // skip it forever.
    hideModules();
    findPosts().forEach(processPost);
  }

  // Re-evaluate everything, e.g. after settings change. Un-collapses posts
  // that no longer match, re-checks posts that were previously let through.
  function reprocessFeed() {
    document.querySelectorAll('.lfc-placeholder').forEach((bar) => bar.remove());
    // dataset.lfcProcessed maps to the data-lfc-processed attribute
    document.querySelectorAll('[data-lfc-processed]').forEach((post) => {
      post.style.display = '';
      post.style.opacity = '';
      delete post.dataset[MARKER];
      delete post.dataset.lfcGhost;
    });
    unhideModules();
    // Everything is visible again; restart the count so re-collapsed posts
    // aren't counted twice. (Stats in the background are lifetime counters
    // and intentionally keep growing.)
    hiddenCount = 0;
    safeChromeCall(() =>
      chrome.runtime.sendMessage({ type: 'lfc-count', count: 0 }, swallowLastError)
    );
    processAllPosts();
    scheduleTimedRefresh();
  }

  // If a snooze or a timed Deep Focus session is running, arrange to
  // reprocess the moment the earliest one expires - otherwise the feed
  // stays in the stale state until the next DOM mutation.
  function scheduleTimedRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
      refreshTimer = null;
    }
    const now = Date.now();
    const deadlines = [];
    if (settings.enabled && (settings.snoozeUntil || 0) > now) {
      deadlines.push(settings.snoozeUntil);
    }
    if ((settings.deepFocusUntil || 0) > now) {
      deadlines.push(settings.deepFocusUntil);
    }
    if (!deadlines.length) return;
    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      reprocessFeed();
    }, Math.min(...deadlines) - now + 1000);
  }

  // ---------------------------------------------------------------------
  // Context-menu support: remember the last element the user right-clicked
  // so the background script can ask "who was that?"
  // ---------------------------------------------------------------------

  let lastRightClicked = null;
  document.addEventListener(
    'contextmenu',
    (e) => {
      lastRightClicked = e.target;
    },
    true
  );

  function postFromLastClick() {
    return (
      lastRightClicked &&
      (lastRightClicked.closest('div[data-lazy-mount-id]') ||
        lastRightClicked.closest(SELECTORS.classicPost))
    );
  }

  // Shared handler for both context-menu actions: resolve the author of the
  // right-clicked post and append them to `listKey` in sync storage.
  function addAuthorToList(listKey, sendResponse) {
    const post = postFromLastClick();
    if (!post) {
      sendResponse({
        ok: false,
        error: 'Could not find the post. Right-click directly on the author name.',
      });
      return;
    }
    const author = getAuthor(post);
    if (!author.name && !author.url) {
      sendResponse({ ok: false, error: 'Could not identify the author.' });
      return;
    }
    if (!authorMatches(settings[listKey], author)) {
      const updated = [...settings[listKey], author];
      // storage.onChanged will update `settings` and reprocess the feed.
      safeChromeCall(() =>
        chrome.storage.sync.set({ [listKey]: updated }, swallowLastError)
      );
    }
    sendResponse({ ok: true, author });
  }

  // "Mute posts containing <selection>": append the selected text to the
  // muted-phrases list. One sync write per click (quota-safe);
  // storage.onChanged recompiles the regexes and reprocesses the feed.
  function mutePhraseFromSelection(rawText, sendResponse) {
    const phrase = String(rawText || '').trim().replace(/\s+/g, ' ').slice(0, 120);
    if (!phrase) {
      sendResponse({ ok: false, error: 'Select some text in a post first.' });
      return;
    }
    const exists = settings.mutedPhrases.some(
      (p) => String(p).trim().toLowerCase() === phrase.toLowerCase()
    );
    if (!exists) {
      const updated = [...settings.mutedPhrases, phrase];
      safeChromeCall(() =>
        chrome.storage.sync.set({ mutedPhrases: updated }, swallowLastError)
      );
    }
    sendResponse({ ok: true, phrase });
  }

  // "Always show this post": persist the right-clicked post's key and
  // restore it immediately (reprocessFeed via storage.onChanged would do it
  // anyway, but this makes the click feel instant).
  function allowPostFromClick(sendResponse) {
    const post = postFromLastClick();
    if (!post) {
      sendResponse({
        ok: false,
        error: 'Could not find the post. Right-click inside the post you want to keep.',
      });
      return;
    }
    const key = postKey(post);
    if (!key) {
      sendResponse({ ok: false, error: 'Could not identify the post.' });
      return;
    }
    allowPostForever(post);
    post.style.display = '';
    post.style.opacity = '';
    delete post.dataset.lfcGhost;
    const prev = post.previousElementSibling;
    if (prev && prev.classList.contains('lfc-placeholder')) prev.remove();
    sendResponse({ ok: true });
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'lfc-mute-author') {
      addAuthorToList('mutedAuthors', sendResponse);
    } else if (msg.type === 'lfc-allow-author') {
      addAuthorToList('allowedAuthors', sendResponse);
    } else if (msg.type === 'lfc-mute-phrase') {
      mutePhraseFromSelection(msg.text, sendResponse);
    } else if (msg.type === 'lfc-allow-post') {
      allowPostFromClick(sendResponse);
    } else if (msg.type === 'lfc-get-count') {
      sendResponse({ hiddenCount });
    }
    return false;
  });

  // ---------------------------------------------------------------------
  // Settings + feed observation
  // ---------------------------------------------------------------------

  chrome.storage.sync.get(LFC_DEFAULTS, (stored) => {
    settings = { ...LFC_DEFAULTS, ...stored };
    compilePhrases();
    // Clear any stale badge left over from before this (re)load.
    safeChromeCall(() =>
      chrome.runtime.sendMessage({ type: 'lfc-count', count: 0 }, swallowLastError)
    );
    processAllPosts();
    scheduleTimedRefresh();

    // New-DOM posts mount their content lazily inside pre-inserted wrappers,
    // so per-added-node processing would fire before the content exists.
    // Instead: any mutation schedules one debounced full sweep. The sweep is
    // cheap - findPosts() scans a few dozen nodes and the MARKER flag skips
    // everything already handled.
    let sweepTimer = null;
    let sweepDirty = false; // mutations arrived while a sweep was pending
    const runSweep = () => {
      sweepTimer = null;
      try {
        processAllPosts();
      } catch (err) {
        // Only tear down if the extension context is actually gone; a
        // one-off DOM error must not kill the observer for the whole page.
        if (!isContextValid()) return;
        console.warn('[LFC] sweep failed:', err);
      }
      // Trailing edge: content that mounted during the sweep window would
      // otherwise sit unprocessed until the next unrelated mutation.
      if (sweepDirty) {
        sweepDirty = false;
        sweepTimer = setTimeout(runSweep, 250);
      }
    };
    feedObserver = new MutationObserver(() => {
      if (!isContextValid()) return;
      if (sweepTimer) {
        sweepDirty = true;
        return;
      }
      sweepTimer = setTimeout(runSweep, 250);
    });
    feedObserver.observe(document.body, { childList: true, subtree: true });
  });

  // React live to popup/options toggles, snoozes, and new muted authors.
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    for (const [key, { newValue }] of Object.entries(changes)) {
      // A removed key arrives as newValue === undefined - fall back to the
      // default instead of poisoning settings (e.g. mutedAuthors.length throws).
      settings[key] = newValue === undefined ? LFC_DEFAULTS[key] : newValue;
    }
    if ('mutedPhrases' in changes) compilePhrases();
    // A new focus session (from any surface) cancels this tab's "Show feed"
    // override; ending one clears it too so the next session starts hidden.
    // Tear the panel down so applyDeepFocus rebuilds it - otherwise a
    // switch between "On" and a timed session keeps stale "until" text.
    if ('deepFocus' in changes || 'deepFocusUntil' in changes) {
      deepFocusRevealed = false;
      removeDeepFocus();
    }
    reprocessFeed();
  });
})();
