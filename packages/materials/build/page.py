# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Write materials.html: the template with the library data and the site kit inlined.

Run: python -I build/page.py

The page's data is compact() of each record in data/materials.json plus the CIE grid, colour-matching
functions and three illuminants; the template's head comment names the shape. The look comes from
the site's system/kit (kit.css, kit.js, inlined by its inline.py). Without the kit folder the page still
builds, unstyled by the kit, and says so on stdout.
"""
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
KIT = Path(os.environ.get("SITE_KIT", "site-kit"))  # the site repo's system/kit
sys.path.insert(0, str(ROOT))
from materials import spectral as S  # noqa: E402

SHOW = [("thermal", "density"), ("thermal", "specific_heat"), ("thermal", "thermal_conductivity"),
        ("thermal", "melting_point"), ("thermal", "boiling_point"),
        ("electromagnetic", "electrical_conductivity"), ("electromagnetic", "relative_permittivity"),
        ("mechanical", "youngs_modulus"), ("mechanical", "poisson_ratio"), ("mechanical", "viscosity"),
        ("surface", "surface_tension"), ("surface", "water_contact_angle")]


def r4(xs):
    return None if xs is None else [round(x, 5) if abs(x) >= 1e-3 else float(f"{x:.3g}") for x in xs]


def compact(rec):
    o = rec["optics"]
    v = lambda f: None if f is None else f["value"]  # noqa: E731
    props = []
    for g, k in SHOW:
        f = rec[g].get(k)
        props.append([k, None if f is None else [f["value"], f["unit"], f["source"], f["licence"], f["confidence"]]])
    for k in ("n", "k"):
        f = o.get(k)
        if f:
            props.append([f"optics {k}", ["380-780 nm spectrum", "1", f["source"], f["licence"], f["confidence"]]])
    pv = o.get("srgb_preview")
    return {"id": rec["id"], "name": rec["name"], "cls": rec["class"], "phase": rec["phase"],
            "cond": o["conductor"], "n": r4(v(o.get("n"))), "k": r4(v(o.get("k"))),
            "R": r4(v(o.get("reflectance_normal"))), "body": None,
            "layer": rec["render"]["layer_m"], "rgb": v(pv), "rgbm": pv.get("method") if pv else None,
            "rough": v(o.get("roughness")), "props": props}


def main():
    lib = json.loads((ROOT / "data/materials.json").read_text(encoding="utf-8"))
    data = {
        "grid": S.GRID, "cmf": [list(c) for c in S.cmf()],
        "lights": {"D65": S.illuminant("D65"), "A": [round(x, 4) for x in S.illuminant("A")],
                   "sodium": S.illuminant("sodium")},
        "mats": [compact(r) for r in lib["materials"]],
    }
    tpl = (ROOT / "build/materials.template.html").read_text(encoding="utf-8")
    html = tpl.replace("/*__DATA__*/null", json.dumps(data, separators=(",", ":")))
    out = ROOT / "materials.html"
    try:
        sys.path.insert(0, str(KIT))
        from inline import inline_kit
        html = inline_kit(html, out)
    except (ImportError, OSError) as e:
        print("site kit not inlined:", e)
    out.write_text(html, encoding="utf-8")
    print("materials.html", len(html), "bytes")


if __name__ == "__main__":
    main()
