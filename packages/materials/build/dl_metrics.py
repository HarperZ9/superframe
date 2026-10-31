# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Error metrics for the Drude-Lorentz fits, on the measured points and on the colour grid.

k_rms_rel     RMS of (k_model - k_measured) / k_measured over the measured points, 380-1000 nm
k_max_rel_vis largest |k error| / k over the measured points below 650 nm
R_rms         RMS error of normal-incidence reflectance over the measured points
dE_ab         CIELAB distance (D65) between model and library reflectance, 380-780 nm grid
"""
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from materials import drude, optics, spectral as S  # noqa: E402

import constants as C  # noqa: E402


def rounded(p):
    r = {k: round(v, 5) for k, v in p.items() if k != "oscillators"}
    r["oscillators"] = [{k: round(v, 5) for k, v in o.items()} for o in p["oscillators"]]
    return r


def _interp(xs, ys, x):
    for i in range(1, len(xs)):
        if xs[i] >= x:
            t = (x - xs[i - 1]) / (xs[i] - xs[i - 1])
            return ys[i - 1] + t * (ys[i] - ys[i - 1])
    return ys[-1]


def _lab(R):
    light = S.illuminant("D65")
    return S.xyz_to_lab(S.to_xyz(R, light), S.white_xyz(light))


def errors(pts, nk_fn, R_library):
    kr, Rr, kvis = [], [], []
    for wl, n, k in pts:
        nm, km = nk_fn(wl)
        rel = (km - k) / k
        kr.append(rel)
        Rr.append(optics.normal_reflectance(nm, km) - optics.normal_reflectance(n, k))
        if wl < 650:
            kvis.append(abs(rel))
    Rm = [optics.normal_reflectance(*nk_fn(w)) for w in S.GRID]
    dE = math.dist(_lab(Rm), _lab(R_library))
    return {"k_rms_rel": round(math.sqrt(sum(r * r for r in kr) / len(kr)), 4),
            "k_max_rel_vis": round(max(kvis), 4), "k_mean_signed_rel_vis": round(sum(
                (nk_fn(w)[1] - k) / k for w, _, k in pts if w < 650) / len(kvis), 4),
            "R_rms": round(math.sqrt(sum(r * r for r in Rr) / len(Rr)), 5), "dE_ab": round(dE, 2)}


def compare(mid, pts, params, drude_only, rec, rakic_pts):
    R_lib = rec["optics"]["reflectance_normal"]["value"]
    out = {"drude_lorentz": errors(pts, lambda w: drude.lorentz_drude_nk(w, params), R_lib),
           "drude_fit": errors(pts, lambda w: drude.lorentz_drude_nk(w, drude_only), R_lib)}
    if mid in C.DRUDE:
        mm, val = C.DRUDE[mid]
        sigma = rec["electromagnetic"]["electrical_conductivity"]["value"]
        ne = drude.electron_density(rec["thermal"]["density"]["value"], mm, val)
        out["drude_dc"] = errors(pts, lambda w: drude.nk(w, sigma, ne), R_lib)
    if rakic_pts:
        xs = [p[0] for p in rakic_pts]
        order = sorted(range(len(xs)), key=lambda i: xs[i])
        xs = [xs[i] for i in order]
        ns = [rakic_pts[i][1] for i in order]
        ks = [rakic_pts[i][2] for i in order]
        out["rakic1998_ld"] = errors(pts, lambda w: (_interp(xs, ns, w), _interp(xs, ks, w)), R_lib)
    return out
