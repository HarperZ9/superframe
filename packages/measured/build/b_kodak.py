# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Kodak VISION3 500T (H-1-5219t) curves, digitised from the data sheet's vector line art.

Each figure's axis is calibrated by a least-squares line through its printed tick labels (position of
the label centre against its value, log10 of the value for log axes). Curves are the drawing paths
inside the plot box. Identification of each path (which layer) is by the figure's own labels, noted
per figure. Typical error: the label-centre calibration, under 0.5% of the axis span (inferred from
the residuals stored in each figure's "axis_fit" block).
Also records the base facts printed in the text of H-1-5219t and H-1-2383.
"""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

PDF = "VISION3-500T-7219-TECHNICAL-DATA.pdf"


def fit(pairs, log=False):
    xs = [p for p, _ in pairs]
    ys = [math.log10(v) if log else v for _, v in pairs]
    n = len(xs)
    mx, my = sum(xs) / n, sum(ys) / n
    b = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / sum((x - mx) ** 2 for x in xs)
    a = my - b * mx
    res = max(abs(a + b * x - y) for x, y in zip(xs, ys)) / (max(ys) - min(ys))
    f = (lambda p: 10 ** (a + b * p)) if log else (lambda p: a + b * p)
    return f, round(res, 5)


def paths(page, ids):
    out = {}
    dr = page.get_drawings()
    for name, i in ids.items():
        pts = []
        for it in dr[i]["items"]:
            if it[0] == "l":
                pts += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
            elif it[0] == "c":
                pts += [(it[1].x, it[1].y), (it[4].x, it[4].y)]
        out[name] = pts
    return out


def split_overlaid(pts):
    """A path that draws two curves left to right twice: split where x jumps back."""
    segs = [[pts[0]]]
    for q in pts[1:]:
        (segs.append([q]) if q[0] < segs[-1][-1][0] - 5 else segs[-1].append(q))
    return segs


def curve(pts, fx, fy):
    c = sorted({round(fx(x), 5): fy(y) for x, y in pts}.items())
    return [[x, float(f"{y:.5g}")] for x, y in c]


def interp(c, x):
    for (x0, y0), (x1, y1) in zip(c, c[1:]):
        if x0 <= x <= x1:
            return y0 + (y1 - y0) * (x - x0) / (x1 - x0) if x1 > x0 else y0
    raise ValueError(x)


def granularity(page):
    fx, rx = fit([(67.4, 0.0), (103.4, 1.0), (141.0, 2.0), (177.9, 3.0), (214.6, 4.0), (250.5, 5.0)])
    fy, ry = fit([(346.0, 0.0), (284.4, 1.0), (222.5, 2.0), (160.2, 3.0)])
    fs, rs = fit([(345.7, 0.001), (286.3, 0.01), (229.5, 0.10), (269.5, 0.02), (328.2, 0.002)], log=True)
    p = paths(page, {"B": 45, "G": 46, "R": 47, "Bg": 48, "GRg": 49})
    gr = sorted(split_overlaid(p["GRg"]), key=lambda s: sum(y for _, y in s) / len(s))
    dens = {k: curve(p[k], fx, fy) for k in "BGR"}
    grain = {"B": curve(p["Bg"], fx, fs), "G": curve(gr[0], fx, fs), "R": curve(gr[-1], fx, fs)}
    at_net1 = {}
    for k in "BGR":
        d = dens[k]
        dmin = sum(y for _, y in d[:5]) / 5
        le = next(x for (x, y), (x2, y2) in zip(d, d[1:]) if y <= dmin + 1.0 <= y2)
        at_net1[k] = {"dmin": round(dmin, 3), "logH_at_net_density_1": round(le, 3), "sigmaD": round(interp(grain[k], le), 4)}
    return {"axis_fit": {"x": rx, "density": ry, "sigma": rs}, "aperture_um": 48, "density": dens, "sigmaD": grain,
            "at_net_density_1": at_net1,
            "identification": "solid paths B, G, R from top; dashed paths: blue grain alone, green and red grain overlaid in one path (green above red, per figure labels)"}


def sensitometry(page):
    # The printed log-exposure ticks are unevenly placed (35.3, 36.5, 40.5 pt per decade), so x is taken
    # from the plot frame, whose ends carry the -4.0 and 1.0 labels. The camera-stop axis (16 even
    # ticks across the same frame, 0.301 per stop) implies a 3.7% shorter span; that is the x
    # uncertainty of any slope read here.
    fx, rx = fit([(353.63, -4.0), (538.15, 1.0)])
    fy, ry = fit([(306.79, 0.0), (245.29, 1.0), (183.8, 2.0), (122.3, 3.0)])
    p = paths(page, {"B": 94, "G": 93, "R": 95})
    cs = {k: curve(v, fx, fy) for k, v in p.items()}
    gamma = {k: round((interp(c, 0.0) - interp(c, -2.0)) / 2.0, 3) for k, c in cs.items()}
    gmax = {}
    for k, c in cs.items():
        sl = [(y2 - y) / (x2 - x) for (x, y), (x2, y2) in zip(c, c[1:]) if x2 - x > 0.05]
        gmax[k] = round(max(sum(sl[i:i + 5]) / 5 for i in range(len(sl) - 4)), 3)
    return {"axis_fit": {"x": rx, "y": ry}, "curves": cs, "gamma_logH_-2_to_0": gamma, "gamma_max_local": gmax,
            "x_uncertainty": "camera-stop axis implies slopes 3.7% steeper than the log lux-s frame used here",
            "identification": "by the B, G, R labels at the curve ends (B top); x is log lux-seconds"}


def spectral(page):
    fx, rx = fit([(353.3, 250), (393.5, 350), (413.6, 400), (433.7, 450), (453.8, 500), (473.9, 550), (493.9, 600), (514.0, 650), (534.1, 700), (553.8, 750)])
    fy, ry = fit([(669.3, 0.0), (631.9, 1.0), (594.7, 2.0), (557.7, 3.0), (519.8, 4.0)])
    p = paths(page, {"yellow_forming_blue_sensitive": 110, "magenta_forming_green_sensitive": 111, "cyan_forming_red_sensitive": 112})
    cs = {k: curve(v, fx, fy) for k, v in p.items()}
    summ = {}
    for k, c in cs.items():
        peak = max(c, key=lambda q: q[1])
        band = [x for x, y in c if y >= peak[1] - math.log10(2)]
        summ[k] = {"peak_nm": round(peak[0], 1), "peak_log_sensitivity": peak[1], "half_max_span_nm": [round(min(band), 1), round(max(band), 1)]}
    return {"axis_fit": {"x": rx, "y": ry}, "curves_log_sensitivity": cs, "summary": summ,
            "identification": "by the layer labels inside the figure; sensitivity = 1/exposure (erg/cm^2) for density 0.2 above D-min"}


def mtf(page):
    fx, rx = fit([(362.95, 1), (384.45, 2), (397.45, 3), (413.45, 5), (435.4, 10), (457.4, 20), (486.4, 50), (508.7, 100), (530.4, 200)], log=True)
    fy, ry = fit([(336.5, 200), (355.85, 100), (367.1, 70), (376.55, 50), (391.15, 30), (403.15, 20), (422.6, 10), (444.15, 5), (458.4, 3), (489.5, 1)], log=True)
    p = paths(page, {"R": 44, "G": 45, "B": 46})
    cs = {k: curve(v, fx, fy) for k, v in p.items()}
    f50 = {}
    for k, c in cs.items():
        hit = [x for (x, y), (x2, y2) in zip(c, c[1:]) if y >= 50 > y2]
        f50[k] = round(hit[0], 1) if hit else None
    return {"axis_fit": {"x": rx, "y": ry}, "curves_percent": cs, "freq_at_50pct_cyc_per_mm": f50,
            "identification": "by the R, G, B labels at the curve ends (R highest at 100 c/mm, B lowest)"}


def dyes(page):
    fx, rx = fit([(81.25, 400), (104.15, 450), (127.9, 500), (150.3, 550), (172.0, 600), (197.05, 650), (220.65, 700), (242.35, 750), (265.45, 800)])
    fy, ry = fit([(321.5, 0.0), (302.5, 0.2), (284.8, 0.4), (266.6, 0.6), (247.4, 0.8), (229.8, 1.0), (210.2, 1.2), (193.5, 1.4), (174.3, 1.6), (158.2, 1.8)])
    p = paths(page, {"a": 28, "b": 29, "c": 30, "midscale_neutral": 31, "minimum": 32})
    cs = {k: curve(v, fx, fy) for k, v in p.items()}
    named = {}
    for k in "abc":
        pk = max(cs[k], key=lambda q: q[1])[0]
        name = "yellow" if pk < 500 else "magenta" if pk < 600 else "cyan"
        named[name] = {"peak_nm": round(pk, 1), "curve": cs[k]}
    named["midscale_neutral"] = {"curve": cs["midscale_neutral"]}
    named["minimum"] = {"curve": cs["minimum"]}
    return {"axis_fit": {"x": rx, "y": ry}, "dyes": named,
            "identification": "the three dye paths named by their own peak wavelength; neutral and minimum by line style"}


def main():
    import fitz  # research dependency, build only
    doc = fitz.open(str(prov.RAW / "kodak-5219" / PDF))
    out = {"granularity": granularity(doc[3]), "sensitometry": sensitometry(doc[3]), "spectral_sensitivity": spectral(doc[3]),
           "mtf": mtf(doc[2]), "dye_density": dyes(doc[4]),
           "base": {"5219_7219": "acetate safety base with rem-jet backing (H-1-5219t, Base section); thickness not stated",
                    "SO-219": "ESTAR safety base with rem-jet backing (H-1-5219t)"}}
    meta = prov.stamp("kodak-5219", [PDF], method="vector digitisation of the data sheet's figures (PyMuPDF get_drawings)",
                      limits="Kodak notes the granularity curves use modified measuring techniques and different equipment from the sensitometry")
    write("kodak_5219", {"provenance": meta, **out},
          private="digitised curves sit close to the Kodak data sheet figures (author decision 2026-10-31)")
    meta2 = prov.stamp("kodak-2383", ["KODAK-VISION-Color-Print-Film-2383-3383-data-sheet.pdf"], method="read from the Film Structure section")
    write("kodak_2383", {"provenance": meta2, "base": {"material": "ESTAR (polyester)", "thickness_um": 120, "thickness_in": 0.0047,
                                                       "rem_jet": False, "status": "measured",
                                                       "text": "coated on a 120 micrometer (0.0047-inch) ESTAR Base; available on ESTAR Base only"}})


if __name__ == "__main__":
    main()
