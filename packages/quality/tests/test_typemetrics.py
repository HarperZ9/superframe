# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Type checker tests: pure rules on fixtures, plus the collector end to end in headless Chromium."""
import os
from pathlib import Path

import pytest

from quality import typemetrics as tm

FONT = Path(__file__).resolve().parents[3] / "techniques" / "fonts" / "hanken-grotesk.woff2"


def browser_or_skip():
    """Playwright with a Chromium it can launch, or a skip that says which is missing."""
    sync = pytest.importorskip("playwright.sync_api", reason="playwright is not installed").sync_playwright
    try:
        with sync() as p:
            launch(p).close()
    except Exception as err:  # no browser binary on this machine
        pytest.skip(f"Chromium does not launch: {type(err).__name__}")
    return sync


def launch(p):
    exe = os.environ.get("PLAYWRIGHT_CHROMIUM")
    return p.chromium.launch(executable_path=exe) if exe else p.chromium.launch()


def item(**kw):
    base = dict(tag="p", cls="", text="x" * 200, chars=200, lines=4, cpl=64, width=600, family="Hanken",
                size=17, weight=400, style="normal", lh=1.5, tracking_em=0, transform="none", kerning="auto",
                optical="auto", synthesis="none", variation="normal", faux=None, contrast=12.0, bg_unknown=False)
    base.update(kw)
    return base


def rules(items):
    return {r["rule"].split()[0]: r for r in tm.check({"items": items})["rules"]}


def test_wcag_contrast_known_values():
    assert tm.wcag_contrast((0, 0, 0), (255, 255, 255)) == pytest.approx(21.0, abs=0.01)
    assert tm.wcag_contrast((118, 118, 118), (255, 255, 255)) == pytest.approx(4.54, abs=0.02)


def test_good_page_passes_all_rules():
    items = [item(), item(size=48, lh=1.05, tracking_em=-0.02, lines=1, cpl=20),
             item(size=13, lines=1, cpl=20, transform="uppercase", tracking_em=0.06),
             item(size=24, lines=1, cpl=30, lh=1.2)]
    r = rules(items)
    assert all(v["pass"] for v in r.values()), {k: v for k, v in r.items() if not v["pass"]}


def test_each_rule_catches_its_failure():
    r = rules([item(size=11, lines=1), item(cpl=110), item(lh=1.15), item(size=40, lh=1.0, tracking_em=0.05, lines=1),
               item(contrast=3.1), item(faux="weight"), item(kerning="none"), item(size=17.5, lines=1)])
    for k in ("T1", "T2", "T3", "T4", "T5", "T6", "T7", "T8"):
        assert r[k]["pass"] is False, k


def test_unknown_background_is_not_counted_as_pass():
    out = tm.check({"items": [item(contrast=1.2, bg_unknown=True)]})
    assert out["contrast_unknown"] == 1


@pytest.mark.skipif(not FONT.exists(), reason="fixture font missing")
def test_collector_detects_faux_bold_and_line_length(tmp_path):
    sync_playwright = browser_or_skip()
    (tmp_path / "f.woff2").write_bytes(FONT.read_bytes())
    long = "Measure every line of running text in characters, not in a feeling about width. " * 4
    html = f"""<!doctype html><style>@font-face{{font-family:T;src:url(f.woff2);font-weight:400}}
    body{{font-family:T;background:#fff;color:#111;margin:20px}}
    p{{font-size:16px;line-height:1.5;width:{{W}}px}} b{{font-weight:700}}</style>
    <p id=a>{long}</p><p><b>Bold run that the face cannot supply</b></p>"""
    (tmp_path / "i.html").write_text(html.replace("{W}", "560"), encoding="utf-8")
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page()
        pg.goto((tmp_path / "i.html").as_uri())
        pg.evaluate("document.fonts.ready")
        data = tm.collect(pg)
        b.close()
    by = {i["text"][:4]: i for i in data["items"]}
    para = by["Meas"]
    assert para["lines"] >= 4 and 55 <= para["cpl"] <= 80
    assert para["cpl"] >= para["cpl_mean"]  # the full-line measure ignores the short last line
    assert para["contrast"] > 15
    bold = by["Bold"]
    assert bold["weight"] == 700 and bold["faux"] == "weight"


def test_display_leading_tiers_and_decorative_exemption():
    r = rules([item(size=180, lh=0.82, lines=2, cpl=10), item(size=48, lh=1.05, lines=1, cpl=12)])
    assert r["T3"]["pass"] is True
    r = rules([item(size=48, lh=0.82, lines=2, cpl=10)])
    assert r["T3"]["pass"] is False
    r = rules([item(contrast=1.0, decorative=True), item(cpl=20, decorative=True)])
    assert r["T5"]["pass"] is True and r["T2"]["pass"] is True


def test_phone_floor_and_full_line_measure():
    r = rules([item(cpl=38, viewport=375)])
    assert r["T2"]["pass"] is True
    r = rules([item(cpl=38, viewport=1440)])
    assert r["T2"]["pass"] is False


@pytest.mark.skipif(not FONT.exists(), reason="fixture font missing")
def test_inline_children_count_toward_the_measure(tmp_path):
    sync_playwright = browser_or_skip()
    (tmp_path / "f.woff2").write_bytes(FONT.read_bytes())
    words = "<cite>Continental Building Center</cite>, 2025. Released to the public domain. " * 3
    html = f"""<!doctype html><style>@font-face{{font-family:T;src:url(f.woff2)}} body{{font-family:T}}
    li{{font-size:16px;line-height:1.5;width:600px}} cite{{position:relative;top:.6px}}</style><ul><li>Klotzplate, {words}<a href=#>Source</a></li></ul>"""
    (tmp_path / "i.html").write_text(html, encoding="utf-8")
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page()
        pg.goto((tmp_path / "i.html").as_uri())
        pg.evaluate("document.fonts.ready")
        data = tm.collect(pg)
        b.close()
    li = [i for i in data["items"] if i["tag"] == "li"][0]
    assert li["chars"] > 200            # the cite text is counted, not only the li's own text nodes
    assert 55 <= li["cpl"] <= 90
    # sub-pixel tops of inline boxes on one line (the cite sits 0.6 px lower) must not count as extra lines
    assert li["lines"] == round(li["chars"] / li["cpl"] + 0.49)


def test_text_over_canvas_is_measured_from_pixels_not_reported_1_to_1():
    """Transparent DOM text over a canvas that paints the word: computed colours give 1:1 (the old result); the
    rendered measurement passes dark ink and still fails a pale grey."""
    sync_playwright = browser_or_skip()
    page_path = Path(__file__).with_name("fixtures") / "text-over-canvas.html"
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": 800, "height": 500})
        pg.goto(page_path.as_uri())
        old = tm.collect(pg, rendered=False)
        new = tm.collect(pg)
        b.close()
    o = [i for i in old["items"] if i["text"] == "Living"]
    n = [i for i in new["items"] if i["text"] == "Living"]
    assert len(o) == 2 and all(i["contrast_computed"] == 1.0 for i in o), "the old reading: 1:1 from computed colours"
    assert all(i["bg_unknown"] and i["measure"]["art"] and i["measure"]["transparent"] for i in o)
    good, faint = n
    assert good["contrast_source"] == "rendered" and good["contrast"] > 10, good["contrast"]
    assert faint["contrast_source"] == "rendered" and faint["contrast"] < 3, faint["contrast"]
    r = {x["rule"].split()[0]: x for x in tm.check({"items": n})["rules"]}
    assert r["T5"]["fail"] == 1 and r["T5"]["of"] == 2


def test_thin_text_over_a_fixed_canvas_reads_its_ink_not_the_ground():
    """The atlas dispute: small text alone in a wide box covers under 5% of it. The old measure (darkest 5% against
    lightest 5%) read the ground twice and scored about 1:1; ink_contrast reads the ink. A veiled label still fails."""
    import io
    import numpy as np
    from PIL import Image
    sync_playwright = browser_or_skip()
    page_path = Path(__file__).with_name("fixtures") / "thin-text-over-fixed-canvas.html"
    with sync_playwright() as p:
        b = launch(p)
        pg = b.new_page(viewport={"width": 1200, "height": 800}, device_scale_factor=2)
        pg.goto(page_path.as_uri())
        data = tm.collect(pg)
        by = {i["text"]: i for i in data["items"]}
        # the old measure, on the same capture, for the record
        m = by["Plate 21"]["measure"]
        a = np.asarray(Image.open(io.BytesIO(pg.screenshot(clip={"x": m["x"], "y": m["y"], "width": m["w"], "height": m["h"]}))).convert("RGB"), dtype=np.float64) / 255
        lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
        Y = (lin @ np.array([0.2126, 0.7152, 0.0722])).ravel()
        old = (np.percentile(Y, 95) + 0.05) / (np.percentile(Y, 5) + 0.05)
        b.close()
    assert old < 1.3, f"the old measure should read the ground twice here (got {old:.2f})"
    thin, far, veil = by["Plate 21"], by["Plate 22"], by["Plate 23"]
    for i in (thin, far, veil):
        assert i["contrast_source"] == "rendered" and i["measure"]["art"]
    assert thin["contrast"] > 5, thin["contrast"]
    assert abs(far["contrast"] - thin["contrast"]) < 0.6, (far["contrast"], thin["contrast"])  # far down the page, same reading
    assert veil["contrast"] < 2.0, veil["contrast"]                                            # the real fault still fails
    assert ink_contrast_known_values()


def ink_contrast_known_values():
    import numpy as np
    paper, ink = 0.80, 0.04
    Y = np.full(1000, paper); Y[:20] = ink                 # 2% ink coverage
    assert abs(tm.ink_contrast(Y) - (paper + 0.05) / (ink + 0.05)) < 0.01
    Y = np.full(1000, 0.02); Y[:30] = 0.7                  # light text on a dark ground
    assert abs(tm.ink_contrast(Y) - (0.7 + 0.05) / (0.02 + 0.05)) < 0.01
    assert tm.ink_contrast(np.full(100, 0.5)) == 1.0       # nothing there
    return True
