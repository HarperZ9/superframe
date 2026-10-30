# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Shared vectors for the JavaScript twin (js/materials.mjs).

The Python is the reference. vectors() computes every case from it; write() stores them in
tests/parity-vectors.json, which tests/materials.test.mjs reads in Node and test_parity.py re-derives.
Cases: every material with spectral n shaded under D65 at 0, 30 and 60 degrees (CIE XYZ), Fresnel on a
grid of angles for a metal and a glass, illuminants A and sodium, CIELAB, Drude and Drude-Lorentz n, k.
Run: python -I -B tests/parity.py   (from packages/materials) to rewrite the file after a deliberate change.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import materials as M  # noqa: E402
from materials import drude, optics, spectral as S  # noqa: E402

OUT = ROOT / "tests" / "parity-vectors.json"


def vectors():
    d65 = S.illuminant("D65")
    shaded = []
    for rec in M.all_materials():
        n, _ = optics.nk(rec)
        if n is None:
            continue
        for theta in (0.0, 30.0, 60.0):
            shaded.append({"id": rec["id"], "theta": theta, "xyz": list(S.to_xyz(optics.shade(rec, d65, theta), d65))})
    fres = []
    for n, k in ((0.18, 3.0), (1.5168, 0.0), (1.33, 1e-8)):
        for c in (0.0, 0.1, 0.5, 0.866, 1.0):
            fres.append({"n": n, "k": k, "cos": c, "R": optics.fresnel(complex(n, k), c)})
    dl = json.loads((ROOT / "data" / "drude_lorentz.json").read_text(encoding="utf-8"))["metals"]
    ld = [{"metal": m, "nm": w, "nk": list(drude.lorentz_drude_nk(w, dl[m]["params"]))}
          for m in sorted(dl) for w in (400, 527.9, 650, 780)]
    ne = drude.electron_density(19300, 0.196966569, 1)
    dr = [{"nm": w, "sigma": 4.1e7, "ne": ne, "nk": list(drude.nk(w, 4.1e7, ne)), "hr": drude.hagen_rubens_k(w, 4.1e7)}
          for w in (400, 550, 700)]
    white = S.white_xyz(d65)
    lab = [{"xyz": list(x), "lab": list(S.xyz_to_lab(x, white))} for x in ((0.2, 0.3, 0.4), (0.9, 0.95, 1.0), (0.001, 0.002, 0.001))]
    return {"grid": S.GRID, "illuminant_A": S.illuminant("A"), "illuminant_sodium": S.illuminant("sodium"),
            "white_d65": list(white), "shaded_d65": shaded, "fresnel": fres, "lorentz_drude": ld, "drude": dr, "lab": lab}


def write():
    OUT.write_text(json.dumps(vectors(), indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    write()
    print(OUT)
