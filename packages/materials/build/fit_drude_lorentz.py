# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Fit a Drude-Lorentz model to the measured n and k of seven metals, 380-1000 nm.

Run: python -I build/fit_drude_lorentz.py <study_folder>
Writes data/drude_lorentz.json. Needs PyYAML and SciPy at build time only; the
runtime model (materials/drude.py) is standard library.

Data: the tabulated points of each metal's refractiveindex.info page (CC0) that lie in
380-1000 nm, the same pages the library's n and k come from. No grid interpolation.
Residual: (N_model - N_measured) / |N_measured| for N = n + ik, real and imaginary
parts, so silver's small n and gold's large k weigh alike.
Oscillator count: 1 to 4 Lorentz terms, chosen by two-fold interleaved cross-validation
(fit on alternate points, score on the others, both ways), among counts whose parameter
count does not exceed the number of measured points. The shipped fit is then refitted on
all points. 40 seeded starts per fit, 20 per fold.
Comparisons on the same points: the best-fit pure Drude model (eps_inf, Ep, G), the
DC-fed Drude model of the study (sigma, density, molar mass, valence), and Rakic et al.
1998 Lorentz-Drude n, k as tabulated on refractiveindex.info (CC0 database page, used
only as a comparison and never shipped as parameters).
"""
import json
import math
import random
import sys
from pathlib import Path

import numpy as np
import yaml
from scipy.optimize import least_squares

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(HERE))
from materials import drude  # noqa: E402

import dl_metrics  # noqa: E402

METALS = ["gold", "copper", "silver", "aluminium", "nickel", "platinum", "iron"]
RAKIC = {"gold": "Au", "copper": "Cu", "silver": "Ag", "aluminium": "Al", "nickel": "Ni", "platinum": "Pt"}
LO, HI, MAX_OSC, STARTS = 380.0, 1000.0, 4, 40
EV_LO, EV_HI = drude.HC_EV_NM / HI, drude.HC_EV_NM / LO


def tabulated(path, lo=LO, hi=HI):
    doc = yaml.safe_load(Path(path).read_text(encoding="utf-8"))
    for block in doc["DATA"]:
        if block["type"] == "tabulated nk":
            rows = [[float(v) for v in ln.split()] for ln in block["data"].strip().splitlines() if ln.strip()]
            return [(r[0] * 1000, r[1], r[2]) for r in rows if lo <= r[0] * 1000 <= hi]
    raise ValueError(f"no tabulated nk in {path}")


def to_params(x, n_osc):
    osc = [{"strength_eV2": x[3 + 3 * j], "centre_eV": x[4 + 3 * j], "width_eV": x[5 + 3 * j]}
           for j in range(n_osc)]
    osc.sort(key=lambda o: o["centre_eV"])
    return {"eps_inf": x[0], "plasma_eV": x[1], "gamma_eV": x[2], "oscillators": osc}


def model_N(x, n_osc, wl):
    e = drude.HC_EV_NM / wl
    eps = x[0] - x[1] ** 2 / (e * e + 1j * x[2] * e)
    for j in range(n_osc):
        a, c, g = x[3 + 3 * j:6 + 3 * j]
        eps = eps + a / (c * c - e * e - 1j * g * e)
    N = np.sqrt(eps)
    return np.where(N.imag < 0, -N, N)


def residual(x, n_osc, wl, N_meas):
    r = (model_N(x, n_osc, wl) - N_meas) / np.abs(N_meas)
    return np.concatenate([r.real, r.imag])


def bounds(n_osc):
    lo = [1.0, 1.0, 1e-3] + [0.0, 0.5, 0.05] * n_osc
    hi = [15.0, 20.0, 3.0] + [600.0, 12.0, 8.0] * n_osc
    return lo, hi


def start(rng, n_osc):
    x = [rng.uniform(1, 6), rng.uniform(4, 15), rng.uniform(0.01, 0.5)]
    for _ in range(n_osc):
        x += [rng.uniform(1, 80), rng.uniform(EV_LO * 0.8, 6.0), rng.uniform(0.2, 3.0)]
    return x


def fit(wl, N_meas, n_osc, seed, starts=STARTS):
    rng = random.Random(seed)
    lo, hi = bounds(n_osc)
    best = None
    for _ in range(starts):
        x0 = np.clip(start(rng, n_osc), lo, hi)
        try:
            sol = least_squares(residual, x0, bounds=(lo, hi), args=(n_osc, wl, N_meas), max_nfev=4000)
        except (ValueError, FloatingPointError) as exc:
            print(f"  start failed ({n_osc} osc): {exc}", file=sys.stderr)
            continue
        rms = math.sqrt(float(np.mean(sol.fun ** 2)))
        if best is None or rms < best[0]:
            best = (rms, sol.x)
    return best


def holdout_rms(wl, N_meas, n_osc, seed):
    errs = []
    for fold in (0, 1):
        tr = np.arange(len(wl)) % 2 == fold
        _, x = fit(wl[tr], N_meas[tr], n_osc, seed + fold, starts=STARTS // 2)
        errs.append(residual(x, n_osc, wl[~tr], N_meas[~tr]))
    return math.sqrt(float(np.mean(np.concatenate(errs) ** 2)))


def fit_metal(mid, study, man, seed=20261029):
    pts = tabulated(study / "downloads" / "ri" / mid / Path(man[mid]["data_path"]).name)
    wl = np.array([p[0] for p in pts])
    N_meas = np.array([complex(p[1], p[2]) for p in pts])
    allowed = [m for m in range(MAX_OSC + 1) if 3 + 3 * m <= len(pts)]
    cv = {m: holdout_rms(wl, N_meas, m, seed + 97 * m) for m in allowed}
    chosen = min((m for m in allowed if m > 0), key=lambda m: (round(cv[m], 4), m))
    runs = {m: fit(wl, N_meas, m, seed + 97 * m) for m in (0, chosen)}
    params = to_params([float(v) for v in runs[chosen][1]], chosen)
    drude_only = to_params([float(v) for v in runs[0][1]], 0)
    scores = {m: {"holdout_rms": round(cv[m], 5)} for m in allowed}
    for m in runs:
        scores[m]["train_rms"] = round(runs[m][0], 5)
    return pts, params, drude_only, scores, chosen


def at_bounds(params):
    """Names of parameters that sit on a fit bound: effective values, not physical constants."""
    n = len(params["oscillators"])
    lo, hi = bounds(n)
    names = ["eps_inf", "plasma_eV", "gamma_eV"]
    vals = [params[k] for k in names]
    for j, o in enumerate(params["oscillators"]):
        names += [f"osc{j}.{k}" for k in ("strength_eV2", "centre_eV", "width_eV")]
        vals += [o["strength_eV2"], o["centre_eV"], o["width_eV"]]
    order = [0, 1, 2] + [3 + i for i in range(3 * n)]
    return [names[i] for i in order if abs(vals[i] - lo[i]) < 1e-6 or abs(vals[i] - hi[i]) < 1e-6]


def main(study):
    study = Path(study)
    man = json.loads((study / "ri_manifest.json").read_text(encoding="utf-8"))
    lib = json.loads((ROOT / "data" / "materials.json").read_text(encoding="utf-8"))
    recs = {r["id"]: r for r in lib["materials"]}
    out = {"model": "eps = eps_inf - Ep^2/(E^2 + iGE) + sum_j A_j/(E_j^2 - E^2 - iG_jE), E in eV",
           "fit_range_nm": [LO, HI], "selection": "oscillator count with the lowest two-fold interleaved holdout RMS, parameters <= points",
           "residual": "(N_model - N_measured)/|N_measured|, real and imaginary parts", "metals": {}}
    for mid in METALS:
        pts, params, drude_only, rms_by_n, chosen = fit_metal(mid, study, man)
        rak = None
        if mid in RAKIC:
            rak = tabulated(study / "downloads" / "ri-rakic-ld" / f"{RAKIC[mid]}-Rakic-LD.yml", 200, 1100)
        m = dl_metrics.compare(mid, pts, params, drude_only, recs[mid], rak)
        out["metals"][mid] = {"source": f"refractiveindex.info:{man[mid]['book']}/{man[mid]['page']}",
                              "source_name": man[mid]["page_name"], "n_points": len(pts),
                              "oscillators_chosen": chosen, "params_at_bound": at_bounds(params), "rms_by_oscillator_count": rms_by_n,
                              "params": dl_metrics.rounded(params), "drude_fit": dl_metrics.rounded(drude_only),
                              "errors": m}
        e = m["drude_lorentz"]
        print(f"{mid:<10} N={chosen} pts={len(pts)} k_rms {e['k_rms_rel']:.3f} R_rms {e['R_rms']:.4f} "
              f"dE {e['dE_ab']:.2f} | drude-fit k_rms {m['drude_fit']['k_rms_rel']:.3f} dE {m['drude_fit']['dE_ab']:.2f}")
    (ROOT / "data" / "drude_lorentz.json").write_text(json.dumps(out, indent=1), encoding="utf-8")


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    main(sys.argv[1])
