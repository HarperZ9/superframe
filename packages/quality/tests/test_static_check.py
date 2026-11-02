# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
from quality import static_check


def test_scan_finds_and_misses(tmp_path):
    (tmp_path / "a.js").write_text("const r = devicePixelRatio; let acc += dt; // tpdf dither\nctx.getContext('2d',{colorSpace:'display-p3'})")
    (tmp_path / "s.css").write_text("body{font-synthesis:none;text-wrap:pretty}")
    (tmp_path / "x.test.mjs").write_text("const d = ctx.getImageData(0,0,1,1)")
    (tmp_path / "vendor").mkdir()
    (tmp_path / "vendor" / "v.js").write_text("seed devicePixelRatio")
    r = static_check.scan(tmp_path)
    assert r["dpr"]["files"] == 1          # vendor skipped
    assert r["dither"]["files"] == 1 and r["p3"]["files"] == 1 and r["fixed_step"]["files"] == 1
    assert r["font_synthesis_none"]["files"] == 1 and r["text_wrap"]["files"] == 1
    assert r["pixel_tests"]["files"] == 1
    assert r["seeded"]["files"] == 0 and r["export_png"]["files"] == 0
