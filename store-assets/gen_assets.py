#!/usr/bin/env python3
"""Generate Chrome Web Store promo tiles + screenshots for Feed Cleaner for LinkedIn.
All vector (SVG) -> cairosvg @2x -> ImageMagick downscale to exact store sizes."""
import cairosvg, subprocess, os

OUT = os.path.dirname(os.path.abspath(__file__))
F = "Liberation Sans, sans-serif"
BLUE = "#0a66c2"; BLUE_D = "#0a5cae"; BLUE_L = "#0e72d1"
CORAL = "#ff7a50"; INK = "#1d2226"; GREY = "#666e75"; LGREY = "#eef1f4"
FEEDBG = "#f4f2ee"

def render(name, svg, w, h):
    tmp = os.path.join("/tmp", name + ".2x.png")
    final = os.path.join(OUT, name + ".png")
    cairosvg.svg2png(bytestring=svg.encode(), write_to=tmp,
                     output_width=w * 2, output_height=h * 2)
    subprocess.run(["convert", tmp, "-resize", f"{w}x{h}!",
                    "-background", "white", "-alpha", "remove", "-alpha", "off",
                    final], check=True)
    os.remove(tmp)
    print(name, subprocess.run(["identify", final], capture_output=True, text=True).stdout.strip())

# ---------------------------------------------------------------- brand bits
def defs():
    return f'''<defs>
<linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="{BLUE_L}"/><stop offset="1" stop-color="{BLUE_D}"/>
</linearGradient>
<filter id="sh" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#0b1c2c" flood-opacity="0.25"/>
</filter>
<filter id="shs" x="-20%" y="-20%" width="140%" height="140%">
  <feDropShadow dx="0" dy="1" stdDeviation="2.5" flood-color="#0b1c2c" flood-opacity="0.18"/>
</filter>
</defs>'''

def logo(x, y, s):
    """Icon motif at (x,y), s = side length."""
    k = s / 128.0
    return f'''<g transform="translate({x},{y}) scale({k})">
<rect width="128" height="128" rx="28" fill="url(#bg)" stroke="#ffffff" stroke-opacity="0.25" stroke-width="2"/>
<rect x="30" y="32" width="68" height="14" rx="7" fill="#fff"/>
<rect x="30" y="57" width="68" height="14" rx="7" fill="#fff"/>
<g fill="{CORAL}">
  <rect x="32" y="82" width="50" height="14" rx="7" transform="rotate(10 32 89)"/>
  <circle cx="94" cy="99" r="5"/><circle cx="106" cy="104" r="3.2"/>
</g></g>'''

def toggle(x, y, on=True, grey=False):
    fill = BLUE if on and not grey else "#c3cbd3"
    kx = x + 25 if on and not grey else x + 9
    return (f'<rect x="{x}" y="{y}" width="34" height="18" rx="9" fill="{fill}"/>'
            f'<circle cx="{kx}" cy="{y+9}" r="7" fill="#fff"/>')

def slider(x, y, w=140, frac=0.5):
    fx = x + w * frac
    return (f'<rect x="{x}" y="{y}" width="{w}" height="4" rx="2" fill="#d7dde3"/>'
            f'<rect x="{x}" y="{y}" width="{w*frac}" height="4" rx="2" fill="{BLUE}"/>'
            f'<circle cx="{fx}" cy="{y+2}" r="8" fill="{BLUE}"/>'
            f'<circle cx="{fx}" cy="{y+2}" r="3" fill="#fff"/>')

# ---------------------------------------------------------------- popup mockup
def popup(x, y, scale=1.0):
    """Recreation of popup.html, 340 x 566 at scale 1."""
    W = 340
    rows = []
    yy = 0
    # header
    rows.append(f'<rect width="{W}" height="64" fill="{BLUE}"/>'
                f'<text x="14" y="27" font-family="{F}" font-size="16" font-weight="bold" fill="#fff">Feed Cleaner for LinkedIn</text>'
                f'<text x="14" y="48" font-family="{F}" font-size="12" fill="#dbe9f7">12 posts hidden in this tab</text>')
    yy = 64
    def sep():
        nonlocal yy
        rows.append(f'<line x1="14" y1="{yy}" x2="{W-14}" y2="{yy}" stroke="#e8ebee" stroke-width="1"/>')
    def row(label, on=True, bold=False, grey=False, badge=None):
        nonlocal yy
        h = 38
        col = "#9aa4ad" if grey else INK
        fw = ' font-weight="bold"' if bold else ""
        rows.append(f'<text x="14" y="{yy+24}" font-family="{F}" font-size="13"{fw} fill="{col}">{label}</text>')
        lx = 14 + len(label) * 6.3
        if badge:
            rows.append(f'<rect x="{lx+4}" y="{yy+11}" rx="7" width="{len(badge)*6.4+14}" height="17" fill="#eef1f4"/>'
                        f'<text x="{lx+11}" y="{yy+23}" font-family="{F}" font-size="10.5" fill="#8a939b">{badge}</text>')
        rows.append(toggle(W - 14 - 34, yy + 10, on, grey))
        yy += h
    def subslider():
        nonlocal yy
        rows.append(f'<text x="14" y="{yy+16}" font-family="{F}" font-size="11.5" fill="{GREY}">Sensitivity</text>')
        rows.append(slider(84, yy + 10, 170, 0.5))
        rows.append(f'<text x="{W-14}" y="{yy+16}" font-family="{F}" font-size="11.5" fill="{GREY}" text-anchor="end">Medium</text>')
        yy += 30
    row("Filtering enabled", on=True, bold=True)
    # snooze row
    rows.append(f'<text x="14" y="{yy+22}" font-family="{F}" font-size="12.5" fill="#c26a1e">Pause temporarily</text>')
    rows.append(f'<rect x="{W-14-108}" y="{yy+4}" width="108" height="26" rx="13" fill="#fff" stroke="{BLUE}" stroke-width="1.5"/>'
                f'<text x="{W-14-54}" y="{yy+21}" font-family="{F}" font-size="12" font-weight="bold" fill="{BLUE}" text-anchor="middle">Snooze 30 min</text>')
    yy += 36; sep()
    row("Hide sponsored / promoted posts"); sep()
    row("Hide muted phrases"); sep()
    row("Hide new-job / anniversary posts"); sep()
    row("Filter 12-line-hook posts"); subslider(); sep()
    row("Mute fake hustle stories"); sep()
    row("Hide AI-generated posts"); subslider(); sep()
    row("Ghost mode (dim instead of hide)"); sep()
    row("Hide dimfluencers", on=False, grey=True, badge="coming soon")
    # footer
    rows.append(f'<rect x="0" y="{yy}" width="{W}" height="36" fill="#f6f8fa"/>'
                f'<line x1="0" y1="{yy}" x2="{W}" y2="{yy}" stroke="#e8ebee"/>'
                f'<text x="14" y="{yy+23}" font-family="{F}" font-size="11" fill="{GREY}">Phrases, authors &amp; stats live in settings</text>'
                f'<text x="{W-14}" y="{yy+23}" font-family="{F}" font-size="12" font-weight="bold" fill="{BLUE}" text-anchor="end">Settings</text>')
    H = yy + 36
    body = "".join(rows)
    return (f'<g transform="translate({x},{y}) scale({scale})">'
            f'<rect width="{W}" height="{H}" rx="10" fill="#fff" filter="url(#sh)"/>'
            f'<clipPath id="pclip"><rect width="{W}" height="{H}" rx="10"/></clipPath>'
            f'<g clip-path="url(#pclip)">{body}</g></g>', W, H)

# ---------------------------------------------------------------- feed mockup
def post_card(x, y, w, name_w=110, lines=3, opacity=1.0, tag=None):
    """Fake feed post with grey bars (no real content)."""
    h = 76 + lines * 16 + (26 if tag else 0)
    e = [f'<g transform="translate({x},{y})" opacity="{opacity}">',
         f'<rect width="{w}" height="{h}" rx="8" fill="#fff" filter="url(#shs)"/>']
    ty = 0
    if tag:
        e.append(f'<text x="16" y="18" font-family="{F}" font-size="12" fill="{CORAL}" font-weight="bold">{tag}</text>')
        ty = 26
    e.append(f'<circle cx="34" cy="{ty+34}" r="18" fill="#d5dbe1"/>')
    e.append(f'<rect x="60" y="{ty+22}" width="{name_w}" height="10" rx="5" fill="#c3ccd4"/>')
    e.append(f'<rect x="60" y="{ty+38}" width="{name_w*1.5}" height="8" rx="4" fill="#e2e7eb"/>')
    ly = ty + 66
    for i in range(lines):
        lw = w - 32 if i < lines - 1 else (w - 32) * 0.55
        e.append(f'<rect x="16" y="{ly}" width="{lw}" height="9" rx="4.5" fill="#e2e7eb"/>')
        ly += 16
    e.append('</g>')
    return "".join(e), h

def hidden_bar(x, y, w, reason, small=False):
    fs = 12 if small else 13
    h = 42
    return (f'<g transform="translate({x},{y})">'
            f'<rect width="{w}" height="{h}" rx="8" fill="#fff" filter="url(#shs)"/>'
            f'<rect x="0" y="0" width="4" height="{h}" rx="2" fill="{CORAL}"/>'
            f'<text x="16" y="{h/2+4.5}" font-family="{F}" font-size="{fs}" fill="{GREY}">1 post hidden ({reason})</text>'
            f'<text x="{w-16}" y="{h/2+4.5}" font-family="{F}" font-size="{fs}" font-weight="bold" fill="{BLUE}" text-anchor="end">Always show&#160;&#160;&#183;&#160;&#160;Show</text>'
            f'</g>', h)

def feed_mock(x, y, w, ghost_reason="AI-generated"):
    e = []
    yy = 0
    c, h = post_card(0, yy, w); e.append(c); yy += h + 12
    b, h = hidden_bar(0, yy, w, "Promoted"); e.append(b); yy += h + 12
    b, h = hidden_bar(0, yy, w, "hustle story"); e.append(b); yy += h + 12
    c, h = post_card(0, yy, w, lines=2, opacity=0.45, tag=f"hidden ({ghost_reason}) &#8212; ghost mode")
    e.append(c); yy += h
    return f'<g transform="translate({x},{y})">' + "".join(e) + "</g>", yy

# ---------------------------------------------------------------- 1. small tile
def small_tile():
    W, H = 440, 280
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
{defs()}
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<circle cx="415" cy="-30" r="130" fill="#ffffff" opacity="0.05"/>
<circle cx="20" cy="300" r="150" fill="#ffffff" opacity="0.05"/>
{logo(50, 78, 96)}
<text x="176" y="112" font-family="{F}" font-size="34" font-weight="bold" fill="#fff">Feed Cleaner</text>
<text x="176" y="142" font-family="{F}" font-size="19" fill="#cfe3f7">for LinkedIn</text>
<rect x="178" y="158" width="46" height="4" rx="2" fill="{CORAL}"/>
<text x="50" y="222" font-family="{F}" font-size="17" fill="#eaf3fc">A quieter feed. No hustle-bait, no AI slop.</text>
<text x="50" y="248" font-family="{F}" font-size="14" fill="#a9cbeb">100% local &#183; no tracking &#183; nothing deleted</text>
</svg>'''
    render("small-promo-tile-440x280", svg, W, H)

# ---------------------------------------------------------------- 2. marquee
def marquee():
    W, H = 1400, 560
    fm, fh = feed_mock(0, 0, 520)
    fscale = 1.0
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
{defs()}
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<circle cx="1330" cy="30" r="220" fill="#ffffff" opacity="0.05"/>
<circle cx="60" cy="560" r="240" fill="#ffffff" opacity="0.05"/>
{logo(90, 96, 120)}
<text x="238" y="150" font-family="{F}" font-size="52" font-weight="bold" fill="#fff">Feed Cleaner</text>
<text x="238" y="196" font-family="{F}" font-size="28" fill="#cfe3f7">for LinkedIn</text>
<text x="90" y="292" font-family="{F}" font-size="26" fill="#eaf3fc">Filters sponsored posts, hook-bait, fake hustle stories</text>
<text x="90" y="330" font-family="{F}" font-size="26" fill="#eaf3fc">and AI-generated slop out of your feed.</text>
<g font-family="{F}" font-size="17" font-weight="bold">
  <rect x="90" y="386" width="150" height="40" rx="20" fill="#ffffff" opacity="0.14"/>
  <text x="165" y="411" fill="#fff" text-anchor="middle">100% local</text>
  <rect x="254" y="386" width="160" height="40" rx="20" fill="#ffffff" opacity="0.14"/>
  <text x="334" y="411" fill="#fff" text-anchor="middle">No tracking</text>
  <rect x="428" y="386" width="190" height="40" rx="20" fill="#ffffff" opacity="0.14"/>
  <text x="523" y="411" fill="#fff" text-anchor="middle">Nothing deleted</text>
</g>
<text x="90" y="486" font-family="{F}" font-size="15" fill="#a9cbeb">Independent project &#8212; not affiliated with LinkedIn Corporation.</text>
<g transform="translate(770,46)">
  <rect x="-30" y="-30" width="640" height="{fh+60}" rx="16" fill="{FEEDBG}" filter="url(#sh)"/>
  <g transform="scale({fscale})">{fm}</g>
</g>
</svg>'''
    render("marquee-promo-tile-1400x560", svg, W, H)

# ---------------------------------------------------------------- screenshots
def shot_frame(title, sub, content, name):
    W, H = 1280, 800
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
{defs()}
<rect width="{W}" height="{H}" fill="{FEEDBG}"/>
<rect width="{W}" height="8" fill="{BLUE}"/>
<text x="640" y="86" font-family="{F}" font-size="42" font-weight="bold" fill="{INK}" text-anchor="middle">{title}</text>
<text x="640" y="126" font-family="{F}" font-size="20" fill="{GREY}" text-anchor="middle">{sub}</text>
{content}
</svg>'''
    render(name, svg, W, H)

def shot_popup():
    p, pw, ph = popup(0, 0, 1.0)
    scale = 1.02
    x = (1280 - pw * scale) / 2
    y = 160
    content = f'<g transform="translate({x},{y}) scale({scale})">{p.replace("translate(0,0) scale(1.0)", "translate(0,0)")}</g>'
    # side annotations
    lx, rx = 230, 1092
    ann = f'''
<g font-family="{F}" font-size="18" fill="{INK}" font-weight="bold">
  <text x="{lx}" y="266" text-anchor="end">Pause or snooze</text>
  <text x="{lx}" y="290" text-anchor="end" font-weight="normal" font-size="15" fill="{GREY}">one click, 30 minutes</text>
  <text x="{lx}" y="452" text-anchor="end">Every filter is a toggle</text>
  <text x="{lx}" y="476" text-anchor="end" font-weight="normal" font-size="15" fill="{GREY}">all optional, all local</text>
  <text x="{rx}" y="462">Sensitivity sliders</text>
  <text x="{rx}" y="486" font-weight="normal" font-size="15" fill="{GREY}">loose &#183; medium &#183; strict</text>
  <text x="{rx}" y="620">Ghost mode</text>
  <text x="{rx}" y="644" font-weight="normal" font-size="15" fill="{GREY}">dim instead of hide</text>
</g>
<g stroke="#b6c2cc" stroke-width="2" fill="none">
  <path d="M {lx+14} 262 H {(1280-pw*scale)/2 - 24}"/>
  <path d="M {lx+14} 448 H {(1280-pw*scale)/2 - 24}"/>
  <path d="M {rx-14} 456 H {(1280+pw*scale)/2 + 24}"/>
  <path d="M {rx-14} 614 H {(1280+pw*scale)/2 + 24}"/>
</g>'''
    shot_frame("Every filter, one click away",
               "Sponsored posts, muted phrases, hook-bait, hustle stories and AI slop &#8212; each its own toggle.",
               content + ann, "screenshot-1-popup-1280x800")

def shot_feed():
    fm, fh = feed_mock(0, 0, 640)
    scale = 1.35
    x = (1280 - 640 * scale) / 2
    content = f'<g transform="translate({x},170) scale({scale})">{fm}</g>'
    shot_frame("Noise collapses into one quiet line",
               "Nothing is deleted &#8212; expand any hidden post with one click, or mark it &#8220;Always show&#8221;.",
               content, "screenshot-2-feed-1280x800")

def shot_stats():
    def stat(x, n, label, w=170):
        return (f'<rect x="{x}" y="0" width="{w}" height="96" rx="10" fill="#f7f9fa" stroke="#e4e8eb"/>'
                f'<text x="{x+20}" y="42" font-family="{F}" font-size="30" font-weight="bold" fill="{BLUE}">{n}</text>'
                f'<text x="{x+20}" y="70" font-family="{F}" font-size="14" fill="{GREY}">{label}</text>')
    card_w, cx = 880, (1280 - 880) / 2
    content = f'''
<g transform="translate({cx},170)">
  <rect width="{card_w}" height="270" rx="14" fill="#fff" filter="url(#sh)"/>
  <text x="36" y="52" font-family="{F}" font-size="16" font-weight="bold" fill="{GREY}" letter-spacing="1.5">STATISTICS</text>
  <g transform="translate(36,72)">{stat(0,"37","Total hidden")}{stat(190,"35","Promoted")}{stat(380,"1","Hook format")}{stat(570,"1","Muted phrases")}</g>
  <text x="36" y="206" font-family="{F}" font-size="14" fill="{GREY}">Counting since 7/9/2026</text>
  <text x="36" y="240" font-family="{F}" font-size="14" font-weight="bold" fill="#c62f2f">Reset statistics</text>
</g>
<g transform="translate({cx},474)">
  <rect width="{card_w}" height="196" rx="14" fill="#fff" filter="url(#sh)"/>
  <text x="36" y="52" font-family="{F}" font-size="16" font-weight="bold" fill="{GREY}" letter-spacing="1.5">BACKUP</text>
  <text x="36" y="84" font-family="{F}" font-size="15" fill="{INK}">Export your filters and settings to a file, or import a previously exported one.</text>
  <text x="36" y="108" font-family="{F}" font-size="15" fill="{INK}">Everything stays on this machine &#8212; nothing is uploaded anywhere.</text>
  <rect x="36" y="132" width="160" height="40" rx="20" fill="{BLUE}"/>
  <text x="116" y="157" font-family="{F}" font-size="15" font-weight="bold" fill="#fff" text-anchor="middle">Export settings</text>
  <rect x="212" y="132" width="170" height="40" rx="20" fill="#fff" stroke="{BLUE}" stroke-width="1.5"/>
  <text x="297" y="157" font-family="{F}" font-size="15" font-weight="bold" fill="{BLUE}" text-anchor="middle">Import settings&#8230;</text>
</g>'''
    shot_frame("Your rules, your stats, your data",
               "Lifetime counts of what was hidden and why &#8212; plus one-click backup and restore, all offline.",
               content, "screenshot-3-stats-1280x800")

# ---------------------------------------------------------------- social promo (v1.3.0)
def deep_focus_panel(x, y, w):
    h = 176
    e = [f'<g transform="translate({x},{y})">',
         f'<rect width="{w}" height="{h}" rx="14" fill="{FEEDBG}" stroke="#dfe3e6" stroke-width="1.5" filter="url(#sh)"/>']
    cx = w / 2
    e.append(f'<text x="{cx}" y="66" font-family="{F}" font-size="23" font-weight="bold" fill="{INK}" text-anchor="middle">Deep Focus is on</text>')
    e.append(f'<text x="{cx}" y="94" font-family="{F}" font-size="16" fill="{GREY}" text-anchor="middle">Your feed is hidden until 11:27 AM.</text>')
    e.append(f'<text x="{cx-70}" y="136" font-family="{F}" font-size="16" font-weight="bold" fill="{BLUE}" text-anchor="middle">Show feed</text>')
    e.append(f'<text x="{cx+90}" y="136" font-family="{F}" font-size="16" font-weight="bold" fill="{BLUE}" text-anchor="middle">End Deep Focus</text>')
    e.append('</g>')
    return "".join(e)

def social_promo_130():
    W = H = 1080
    m = 72
    panel_w = W - 2 * m
    bullets = [
        "Select text in a post and right-click to mute that phrase.",
        "Right-click a post, or its hidden bar, to always show it going forward.",
        "Feed processing is faster, including during fast scrolling.",
        "Popup and settings now share one consistent style.",
        "Removed the non-functional Hide dimfluencers placeholder.",
    ]
    bullet_rows = []
    by = 664
    for b in bullets:
        bullet_rows.append(f'<rect x="{m}" y="{by-14}" width="10" height="10" rx="2" fill="{CORAL}"/>')
        bullet_rows.append(f'<text x="{m+24}" y="{by}" font-family="{F}" font-size="18.5" fill="#eaf3fc">{b}</text>')
        by += 38
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">
{defs()}
<rect width="{W}" height="{H}" fill="url(#bg)"/>
<circle cx="1030" cy="30" r="220" fill="#ffffff" opacity="0.05"/>
<circle cx="40" cy="1060" r="240" fill="#ffffff" opacity="0.05"/>
{logo(m, m, 96)}
<text x="{m+118}" y="{m+40}" font-family="{F}" font-size="32" font-weight="bold" fill="#fff">Feed Cleaner for LinkedIn</text>
<text x="{m+118}" y="{m+70}" font-family="{F}" font-size="18" fill="#cfe3f7">v1.3.0 &#183; Released July 17, 2026</text>
<rect x="{m+118}" y="{m+84}" width="52" height="4" rx="2" fill="{CORAL}"/>
<text x="{m}" y="264" font-family="{F}" font-size="34" font-weight="bold" fill="#fff">Deep Focus hides the entire feed</text>
<text x="{m}" y="306" font-family="{F}" font-size="34" font-weight="bold" fill="#fff">behind a calm panel.</text>
<text x="{m}" y="344" font-family="{F}" font-size="18" fill="#cfe3f7">Turn it on indefinitely or for one hour, from the popup or the settings page.</text>
<text x="{m}" y="370" font-family="{F}" font-size="18" fill="#cfe3f7">Independent of pause and snooze, so pausing filters never reveals the feed.</text>
{deep_focus_panel(m, 404, panel_w)}
<text x="{m}" y="628" font-family="{F}" font-size="20" font-weight="bold" fill="#fff">Also in v1.3.0</text>
<rect x="{m}" y="640" width="40" height="3" rx="1.5" fill="{CORAL}"/>
{"".join(bullet_rows)}
<text x="{m}" y="1000" font-family="{F}" font-size="14" fill="#a9cbeb">Independent project. Not affiliated with LinkedIn Corporation.</text>
</svg>'''
    render("social-promo-v1.3.0-1080x1080", svg, W, H)

small_tile()
marquee()
shot_popup()
shot_feed()
shot_stats()
social_promo_130()
print("done")
