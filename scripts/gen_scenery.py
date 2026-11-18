"""Generate the two hero landscapes as inline SVG.

    python scripts/gen_scenery.py --write

Builds two <g> groups: .scene-pixel (dark theme: stepped pixel mountains) and
.scene-snow (light theme: misty snow peak). With --write it replaces the block between
<!-- scenery --> and <!-- /scenery --> in public/index.html; without it, it prints them.
Tweak the peak tuples / seeds below to reshape the landscapes.
"""
import math, random

W, H = 1440, 820
R = random.Random(39)


def f(v):
    return f"{v:.0f}"


def ridge(x0, y0, x1, y1, rough, depth=7, rnd=R):
    """Midpoint displacement between two points -> list of points."""
    pts = [(x0, y0), (x1, y1)]
    amp = rough
    for _ in range(depth):
        nxt = [pts[0]]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            mx, my = (ax + bx) / 2, (ay + by) / 2 + rnd.uniform(-amp, amp)
            nxt += [(mx, my), (bx, by)]
        pts = nxt
        amp *= 0.55
    return pts


def poly(pts, close=True):
    d = "M" + " L".join(f"{f(x)} {f(y)}" for x, y in pts)
    return d + ("Z" if close else "")


def profile(x, peaks, base):
    y = base
    for px, ph, pw in peaks:
        d = (x - px) / pw
        y -= ph * math.exp(-d * d)
    return y


# ---------------------------------------------------------------- light: snow peak
def snow_scene():
    out = ['<g class="scene-snow" id="art-snow">',
           '<defs><linearGradient id="snBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8790b1"/><stop offset=".55" stop-color="#aab1cb"/><stop offset="1" stop-color="#e3e3ee"/></linearGradient>'
           '<linearGradient id="snShade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5f6890" stop-opacity=".7"/><stop offset=".7" stop-color="#7a83a6" stop-opacity=".25"/><stop offset="1" stop-color="#7a83a6" stop-opacity="0"/></linearGradient>'
           '<linearGradient id="snMist" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5f3f8" stop-opacity="0"/><stop offset=".45" stop-color="#f5f3f8" stop-opacity=".85"/><stop offset="1" stop-color="#f5f3f8"/></linearGradient>'
           '<linearGradient id="snSnow" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#eef0f8"/></linearGradient>'
           '<filter id="soft"><feGaussianBlur stdDeviation="1.6"/></filter></defs>']
    # distant ranges (blurred)
    for cls, base, peaks, seed in [
        ("sn-far2", 650, [(260, 120, 200), (620, 90, 160), (900, 150, 160), (1300, 120, 200)], 1),
        ("sn-far1", 690, [(120, 70, 160), (480, 110, 180), (760, 150, 140), (1420, 160, 160)], 2),
    ]:
        rnd = random.Random(seed)
        pts = [(x, profile(x, peaks, base) + rnd.uniform(-4, 4)) for x in range(0, W + 1, 12)]
        out.append(f'<path class="{cls}" d="{poly([(0, H)] + pts + [(W, H)])}"/>')

    S = (1120, 330)
    left = ridge(S[0], S[1], 420, 760, 70)
    right = ridge(S[0], S[1], 1440, 540, 40)
    body = list(reversed(left)) + right[1:] + [(1440, H), (470, H)]
    out.append('<clipPath id="massif"><path d="%s"/></clipPath>' % poly(body))
    out.append(f'<path class="sn-body" d="{poly(body)}"/>')
    out.append('<g clip-path="url(#massif)">')
    # shadow face: right of a spine running down from the summit
    spine = ridge(S[0], S[1], 1240, 820, 40)
    out.append(f'<path class="sn-shade" d="{poly(spine + [(1440, 820), (1440, 300)] )}"/>')
    # snow cap: noisy snowline whose tongues run down-slope (diagonal), not straight down
    rnd = random.Random(7)
    line = []
    x = 430
    while x <= 1440:
        y = 450 + 0.16 * abs(x - S[0]) + 22 * math.sin(x / 41) + rnd.uniform(-10, 10)
        if rnd.random() < 0.22:
            dirx = -1 if x < S[0] else 1
            ln = rnd.uniform(40, 120)
            wdt = rnd.uniform(8, 18)
            line += [(x, y), (x + dirx * ln * 0.45, y + ln), (x + wdt, y + rnd.uniform(-4, 6))]
            x += wdt + 6
        else:
            line.append((x, y))
            x += 10
    cap = [(430, 0), (1440, 0)] + list(reversed(line))
    out.append(f'<path class="sn-snow" d="{poly(cap)}"/>')
    snow_shade = spine + [(1440, 820), (1440, 0), (S[0], 0)]
    out.append(f'<path class="sn-snow-shade" d="{poly(snow_shade)}"/>')
    # a few rock ribs below the summit on the lit side
    for i in range(10):
        x0 = rnd.uniform(S[0] - 260, S[0] + 40)
        y0 = S[1] + 40 + 0.5 * abs(x0 - S[0]) + rnd.uniform(0, 60)
        l = rnd.uniform(25, 70)
        out.append(f'<path class="sn-rock" d="M{f(x0)} {f(y0)} l{-l * .5:.0f} {l:.0f} l6 -{l * .8:.0f}Z"/>')
    out.append("</g>")
    # mist bands + foreground
    out.append('<rect class="sn-mist" x="0" y="470" width="1440" height="350"/>')
    rnd = random.Random(11)
    pts = [(x, profile(x, [(200, 60, 260), (760, 40, 220), (1250, 70, 260)], 800) + rnd.uniform(-3, 3)) for x in range(0, W + 1, 16)]
    out.append(f'<path class="sn-front" d="{poly([(0, H)] + pts + [(W, H)])}"/>')
    out.append("</g>")
    return "\n".join(out)


# ---------------------------------------------------------------- dark: pixel peaks
def tri(x, peaks, base):
    y = base
    for px, ph, pw in peaks:
        t = max(0.0, 1 - abs(x - px) / (pw * 2.2))
        y = min(y, base - ph * t ** 1.15)
    return y


def stepped(peaks, base, step, seed, x_from=0, x_to=W):
    rnd = random.Random(seed)
    d = [f"M{x_from} {H}"]
    for x in range(x_from, x_to, step):
        y = tri(x + step / 2, peaks, base) + rnd.uniform(-1, 1) * step * 0.9
        y = round(y / step) * step
        d.append(f"V{y} H{x + step}")
    d.append(f"V{H}Z")
    return " ".join(d)


def pixel_scene():
    out = ['<g class="scene-pixel" id="art-pixel">',
           '<defs><linearGradient id="pxBody" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b2d7a"/><stop offset=".45" stop-color="#1d1640"/><stop offset="1" stop-color="#0b0a14"/></linearGradient>'
           '<linearGradient id="pxFar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#241c4c"/><stop offset="1" stop-color="#0d0b18"/></linearGradient>'
           '<pattern id="pxDither" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="#a78bfa" opacity=".22"/><rect x="4" y="4" width="2" height="2" fill="#a78bfa" opacity=".12"/></pattern></defs>']
    out.append('<path class="px-far" d="%s"/>' % stepped([(1080, 200, 120), (1300, 170, 140), (420, 90, 200), (900, 120, 110)], 680, 10, 3))
    main = stepped([(770, 400, 200), (600, 200, 120), (980, 230, 130), (300, 70, 180)], 740, 10, 5)
    out.append(f'<path class="px-main" d="{main}"/>')
    out.append(f'<path class="px-dither" d="{main}"/>')
    out.append('<path class="px-near" d="%s"/>' % stepped([(1220, 160, 200), (200, 90, 220), (620, 60, 140)], 790, 10, 9))
    # glitchy reflection lines on the ground
    rnd = random.Random(4)
    lines = []
    for i in range(16):
        y = 700 + i * 7
        x = 520 + rnd.uniform(-120, 160)
        while x < 1140:
            w = rnd.choice([10, 20, 30, 50, 80])
            if rnd.random() < 0.6:
                lines.append(f"M{f(x)} {y}h{w}")
            x += w + rnd.choice([10, 20, 40])
    out.append(f'<path class="px-lines" d="{"".join(lines)}"/>')
    out.append("</g>")
    return "\n".join(out)


if __name__ == "__main__":
    import pathlib, re, sys
    art = pixel_scene() + "\n" + snow_scene()
    if "--write" in sys.argv:
        index = pathlib.Path(__file__).resolve().parent.parent / "public" / "index.html"
        text = index.read_text(encoding="utf-8")
        block = "<!-- scenery -->\n" + art + "\n<!-- /scenery -->"
        text, n = re.subn(r"<!-- scenery -->.*?<!-- /scenery -->", lambda m: block, text, flags=re.S)
        if n != 1:
            sys.exit("scenery markers not found in index.html")
        index.write_text(text, encoding="utf-8", newline="\n")
        print("scenery updated")
    else:
        print(art)
