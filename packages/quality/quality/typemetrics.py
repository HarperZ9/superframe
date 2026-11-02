# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Type-metrics checker.

collect(page) runs typemetrics.js in a Playwright page and returns the raw items.
check(items) scores them against QUALITY-SPEC.md section T:

- T1 minimum size: no visible text under 12 CSS px; running text (3+ lines) at least 15 px.
- T2 line length: running text (3+ lines, size under 24 px) sets 45 to 80 characters on a full line
  (characters x widest line / summed line widths, so a short last line is not counted as a narrow
  measure); on viewports under 600 CSS px the floor is 30 (a 343 px column at 16 px holds about 40).
- T3 leading: running text line-height 1.35 to 1.75; display 32 to 72 px 0.95 to 1.25;
  display above 72 px 0.78 to 1.05 (leading tightens as size grows; revised once after the
  first audit, which flagged deliberate 0.8 settings on 180 px heads).
- T4 tracking by size: display text (32 px and up) tracking at or below 0; all-caps text
  under 32 px at least +0.04 em (display caps follow the display rule); text under 14 px not tighter than 0.
- T5 contrast (WCAG 2.2): 4.5 under 24 px (or under 18.66 px bold), 3.0 above; items over an
  image or canvas are reported as unknown, not passed, unless collect measured the rendered pixels in the text's
  box (contrast_source "rendered": the ink's own tone against the box's median ground, typemetrics.ink_contrast). Text under aria-hidden is decorative
  (WCAG 1.4.3 exempts incidental text) and is not scored for contrast or line length.
- T6 no faux bold or italic: every used weight and style has a loaded face.
- T7 kerning on: font-kerning is not "none".
- T8 hierarchy: distinct sizes on a page between 3 and 8 (aria-hidden art type excluded); adjacent sizes differ by at least 1.125x.

Each rule returns pass, the failing count and up to five examples.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

JS = Path(__file__).with_name("typemetrics.js").read_text(encoding="utf-8")


def collect(page, rendered: bool = True) -> dict:
    """Collect items; with rendered=True, items over art or with a transparent fill get their contrast measured from
    the rendered pixels (measure_rendered) instead of staying unknown."""
    data = page.evaluate(JS)
    if rendered:
        for i in data["items"]:
            if i.get("measure"):
                c = measure_rendered(page, i["measure"])
                if c is not None:
                    i.update(contrast=c, bg_unknown=False, contrast_source="rendered")
    return data


def ink_contrast(Y) -> float | None:
    """WCAG contrast between the ground and the ink of a text box, from its pixels' relative luminance Y (1D array).

    The ground is the median (text covers less than half of its box). The ink is on whichever side of the ground the
    pixels stray further (dark text on light, or light on dark), and its tone is read inside the ink itself: the pixels
    that stray more than 30% of the largest excursion are the ink, and the ink tone is the median of their most
    distant half, so antialiased edges do not dilute it.
    The first version took the darkest 5% against the lightest 5%. Thin or small text covers less than 5% of its box,
    so both ends landed on the ground and every such item read near 1:1 whatever its colour (2026-10-26, the UI atlas:
    a 13 px mono label covering 2.9% of its box read 1.18:1)."""
    import numpy as np
    Y = np.asarray(Y, dtype=np.float64).ravel()
    if Y.size < 16:
        return None
    g = float(np.median(Y)); lo, hi = float(Y.min()), float(Y.max())
    dark = (g - lo) >= (hi - g); span = (g - lo) if dark else (hi - g)
    if span < 1e-4:
        return 1.0
    ink = Y[Y < g - 0.3 * span] if dark else Y[Y > g + 0.3 * span]
    if ink.size < 4:
        return 1.0
    ink = np.sort(ink); ink = ink[: max(1, ink.size // 2)] if dark else ink[ink.size // 2:]
    i = float(np.median(ink))
    return round((max(g, i) + 0.05) / (min(g, i) + 0.05), 2)


def measure_rendered(page, box, settle_ms: int = 1500) -> float | None:
    """WCAG contrast of what is painted in a text box (ink_contrast on a capture of the box). A proxy for text over
    art: it says how far apart ink and ground are, not that the letters are well formed. None when the box is empty.
    The box is captured from the page as laid out (full_page), so fixed and scrolled layers sit where a reader sees
    them only for boxes inside the first viewport; boxes further down are scrolled into view and captured there."""
    import io
    import numpy as np
    from PIL import Image
    if box["w"] < 2 or box["h"] < 2:
        return None
    vh, vw = page.evaluate("innerHeight"), page.evaluate("innerWidth")
    # find the element itself and bring it into view, then read where it is now: a sticky, fixed or transformed layout
    # moves it, so coordinates recorded at load can point at the wrong place (2026-10-26: a living-type word inside a
    # sticky stage was measured on the mosaic beside it). Without a key, fall back to the recorded box.
    key = box.get("key")
    r = page.evaluate(f"""(() => {{ const e = document.querySelector('[data-tm-measure="{key}"]'); if (!e) return null;
        e.scrollIntoView({{ block: 'center', inline: 'nearest' }}); const b = e.getBoundingClientRect(); return [scrollY, b.left, b.top, b.width, b.height]; }})()""") if key is not None else None
    if r is None:
        page.evaluate(f"scrollTo(0, {max(0, box['y'] - vh / 3)})")
    if r is None or abs(r[0]) > 0:
        # what a reader sees after arriving: lazy layers (a worker painting a canvas) get a moment to draw
        page.wait_for_timeout(settle_ms)
    page.evaluate("new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res)))")
    if key is not None:
        r = page.evaluate(f"""(() => {{ const b = document.querySelector('[data-tm-measure="{key}"]').getBoundingClientRect(); return [scrollY, b.left, b.top, b.width, b.height]; }})()""")
        left, top, w, h = r[1], r[2], r[3], r[4]
    else:
        left, top, w, h = box["x"], box["y"] - page.evaluate("scrollY"), box["w"], box["h"]
    # the part of the box that is on screen
    x0, y0, x1, y1 = max(0, left), max(0, top), min(vw, left + w), min(vh, top + h)
    if x1 - x0 < 2 or y1 - y0 < 2:
        page.evaluate("scrollTo(0, 0)")
        return None
    png = page.screenshot(clip={"x": x0, "y": y0, "width": x1 - x0, "height": y1 - y0})
    page.evaluate("scrollTo(0, 0)")
    a = np.asarray(Image.open(io.BytesIO(png)).convert("RGB"), dtype=np.float64) / 255
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    return ink_contrast(lin @ np.array([0.2126, 0.7152, 0.0722]))


def wcag_contrast(fg, bg) -> float:
    def lin(v):
        v /= 255
        return v / 12.92 if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4

    def L(c):
        return 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])

    a, b = L(fg), L(bg)
    return (max(a, b) + 0.05) / (min(a, b) + 0.05)


def _running(i):
    return i["lines"] >= 3 and i["size"] < 24 and not i.get("decorative")


def _lead_ok(i):
    if i["size"] > 72:
        return 0.78 <= i["lh"] <= 1.05
    return 0.95 <= i["lh"] <= 1.25


def _rule(name, bad, items_total, examples_key=lambda i: f"{i['tag']} {i['size']}px '{i['text'][:30]}'"):
    return {"rule": name, "pass": len(bad) == 0, "fail": len(bad), "of": items_total,
            "examples": [examples_key(i) for i in bad[:5]]}


def check(data: dict) -> dict:
    items = data["items"] if isinstance(data, dict) else data
    n = len(items)
    rules = []
    rules.append(_rule("T1 min size", [i for i in items if i["size"] < 12 or (_running(i) and i["size"] < 15)], n))
    run = [i for i in items if _running(i)]
    floor = lambda i: 30 if i.get("viewport", 1440) < 600 else 45
    rules.append(_rule("T2 line length 45-80 (30-80 under 600 px)", [i for i in run if not floor(i) <= i["cpl"] <= 80], len(run),
                       lambda i: f"{i['tag']} cpl={i['cpl']} '{i['text'][:30]}'"))
    disp = [i for i in items if i["size"] >= 32]
    rules.append(_rule("T3 leading", [i for i in run if not 1.35 <= i["lh"] <= 1.75] +
                       [i for i in disp if not i.get("decorative") and not _lead_ok(i)], len(run) + len(disp),
                       lambda i: f"{i['tag']} {i['size']}px lh={i['lh']}"))
    caps = [i for i in items if i["transform"] == "uppercase" or (i["text"].isupper() and len(i["text"]) > 3)]
    rules.append(_rule("T4 tracking", [i for i in disp if i["tracking_em"] > 0.001] +
                       [i for i in caps if i["size"] < 32 and i["tracking_em"] < 0.04] +
                       [i for i in items if i["size"] < 14 and i["tracking_em"] < 0], n,
                       lambda i: f"{i['tag']} {i['size']}px track={i['tracking_em']}em '{i['text'][:20]}'"))
    known = [i for i in items if not i["bg_unknown"] and not i.get("decorative")]
    need = lambda i: 3.0 if i["size"] >= 24 or (i["size"] >= 18.66 and i["weight"] >= 700) else 4.5
    rules.append(_rule("T5 contrast", [i for i in known if i["contrast"] < need(i)], len(known),
                       lambda i: f"{i['tag']} {i['contrast']}:1 '{i['text'][:30]}'"))
    rules.append(_rule("T6 no faux styles", [i for i in items if i["faux"] in ("weight", "style")], n,
                       lambda i: f"{i['tag']} {i['family']} {i['weight']} {i['style']} faux={i['faux']}"))
    rules.append(_rule("T7 kerning", [i for i in items if i["kerning"] == "none"], n))
    sizes = sorted({round(i["size"], 1) for i in items if not i.get("decorative")})  # aria-hidden art type is not hierarchy
    close = [(a, b) for a, b in zip(sizes, sizes[1:]) if b / a < 1.125]
    rules.append({"rule": "T8 hierarchy", "pass": 3 <= len(sizes) <= 8 and not close, "fail": len(close) + (0 if 3 <= len(sizes) <= 8 else 1),
                  "of": len(sizes), "examples": [f"levels={len(sizes)} sizes={sizes}"] + [f"{a}->{b}" for a, b in close[:4]]})
    unknown = sum(1 for i in items if i["bg_unknown"] and not i.get("decorative"))
    passed = sum(r["pass"] for r in rules)
    return {"items": n, "contrast_unknown": unknown, "rules": rules, "score": f"{passed}/{len(rules)}"}


def main(argv=None):
    argv = argv or sys.argv[1:]
    data = json.loads(Path(argv[0]).read_text(encoding="utf-8"))
    r = check(data)
    print(json.dumps(r, indent=1))
    return 0 if all(x["pass"] for x in r["rules"]) else 1


if __name__ == "__main__":
    sys.exit(main())
