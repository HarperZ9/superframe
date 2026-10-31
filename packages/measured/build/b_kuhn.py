# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Kuhn 2002 P22 model: coefficients of eqs. 8-10 and a vector digitisation of Fig. 3.

Fig. 3 in the author's PDF is vector line art, so the curves are read from the drawing commands
(PyMuPDF get_drawings) with the axis mapped from the gridlines: x decades at 49.76 pt from 1e-9 s
(x = 136.1) to 1e-2 s (x = 484.4); y decades at 42.03 pt with 1e-1 at y = 268.5 and 1e3 at y = 100.4.
The digitised curves check the transcription of the equations: the model must reproduce the figure.
The public table carries the equations and the fit summary (fig3_vs_model); the digitised points go
to the private overlay p22_kuhn2002.private.json.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA, prov, write  # noqa: E402

MODEL = {
    "red": {"exp": [{"a": 4, "f_hz": 360}, {"a": 1.75, "f_hz": 1.6e3}, {"a": 2, "f_hz": 8e3},
                    {"a": 2.25, "f_hz": 25e3}, {"a": 15, "f_hz": 700e3}, {"a": 29, "f_hz": 7e6}]},
    "green": {"power": {"A": 210e-6, "t0_s": 5.5e-6, "n": 1.1},
              "exp": [{"a": 37, "f_hz": 150e3}, {"a": 100, "f_hz": 700e3}, {"a": 90, "f_hz": 5e6}]},
    "blue": {"power": {"A": 190e-6, "t0_s": 5e-6, "n": 1.11},
             "exp": [{"a": 75, "f_hz": 100e3}, {"a": 1000, "f_hz": 1.1e6}, {"a": 1100, "f_hz": 4e6}]},
}
COLOURS = {(0.0, 0.0, 1.0): "blue", (0.0, 1.0, 0.0): "green", (1.0, 0.0, 0.0): "red"}
X0, XD, Y1, YD = 136.1, (484.4 - 136.1) / 7, 268.5, (268.5 - 100.4) / 4


def digitise():
    import fitz  # research dependency, build only
    page = fitz.open(str(prov.RAW / "kuhn2002" / "ieee02-optical.pdf"))[5]
    curves = {}
    for g in page.get_drawings():
        name = COLOURS.get(tuple(g.get("color") or ()))
        r = g["rect"]
        if not name or r.width < 20:  # skip the legend swatches
            continue
        for it in g["items"]:
            if it[0] == "l":
                for q in (it[1], it[2]):
                    t = 10 ** (-9 + (q.x - X0) / XD)
                    v = 10 ** (-1 + (Y1 - q.y) / YD)
                    curves.setdefault(name, {})[round(t, 15)] = v
    return {k: sorted(v.items()) for k, v in curves.items()}


def model_I(c, t):
    m = MODEL[c]
    s = sum(e["a"] * math.exp(-2 * math.pi * e["f_hz"] * t) for e in m["exp"])
    if "power" in m:
        p = m["power"]
        s += p["A"] * (t + p["t0_s"]) ** -p["n"]
    return s


def main():
    dig = digitise()
    check = {}
    for c, pts in dig.items():
        errs = [abs(math.log10(v / model_I(c, t))) for t, v in pts if 2e-9 < t < 9e-3 and v > 0.04]
        check[c] = {"points": len(pts), "max_abs_log10_err": round(max(errs), 4), "median_abs_log10_err": round(sorted(errs)[len(errs) // 2], 4)}
    sampled = {c: [{"t_s": float(f"{t:.4g}"), "I": float(f"{v:.4g}")} for t, v in pts[:: max(1, len(pts) // 120)]] for c, pts in dig.items()}
    meta = prov.stamp("kuhn2002", ["ieee02-optical.pdf"], method="equations transcribed from eqs. 8-10; Fig. 3 digitised from vector paths",
                      units="W/(V s sr) for 1 V video drive; absolute scale within a factor of 2 (Kuhn)",
                      limits="one monitor (P22 per EIA, triple not identified beyond P22), video-level drive")
    write("p22_kuhn2002", {"provenance": meta, "model": MODEL, "fig3_vs_model": check})
    # The digitised figure stays private (author decision 2026-10-31): model equations public, Fig. 3 points by hash.
    write("p22_kuhn2002", {"fig3_digitised": sampled}, private="digitised points of Kuhn 2002 Fig. 3 (IEEE copyright figure)",
          field="fig3_digitised")


if __name__ == "__main__":
    main()
