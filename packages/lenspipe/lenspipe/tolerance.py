# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Monte Carlo tolerance run: perturb the numeric lens, refocus, score, count yield.

Power in fringes: f rings at the test wavelength mean a sag error f * lambda / 2 across the test diameter. Score: geometric
MTF times the diffraction envelope at the reference frequency (optics.mtf_geom). Distribution: uniform inside the tolerance for
fabrication errors, which is pessimistic against the shop statistics in SPIE 12222 and stays stated as an assumption.
"""
import numpy as np

from . import design, optics

ARCMIN = np.pi / 180 / 60


def dc_from_fringes(fr, semi):
    """Curvature change for fr fringes of power over the semi-diameter: sag = c h^2 / 2 and one fringe = lambda / 2."""
    return fr * (design.LAMBDA_TEST_NM * 1e-6 / 2) * 2 / semi ** 2


def sample(lens, d, rng):
    """One perturbed lens and the record of what moved."""
    L = lens.copy()
    m = len(L.c)
    moved = dict(dc=np.zeros(m), dt=np.zeros(m), dx=np.zeros(m), dy=np.zeros(m), ax=np.zeros(m), ay=np.zeros(m), irr=np.zeros((m, 2)), dn=np.zeros(m + 1))
    surf = d["surfaces"]
    for i in range(m):
        tol = design.tolerances(d, i)
        isglass = surf[i].get("material") not in (None, "air")
        ispower = surf[i].get("stop") is not True
        if ispower:
            moved["dc"][i] = dc_from_fringes(rng.uniform(-tol["power_fringes"], tol["power_fringes"]), L.semi[i])
            amp = tol["irreg_fringes"] * design.LAMBDA_TEST_NM * 1e-6 / 2
            moved["irr"][i] = [rng.uniform(-amp, amp), rng.uniform(-amp, amp)]
            th = rng.uniform(0, 2 * np.pi)
            tilt = rng.uniform(0, tol["tilt_arcmin"]) * ARCMIN
            moved["ax"][i], moved["ay"][i] = tilt * np.cos(th), tilt * np.sin(th)
        th = rng.uniform(0, 2 * np.pi)
        dec = rng.uniform(0, tol["decentre_mm"])
        if ispower:
            moved["dx"][i], moved["dy"][i] = dec * np.cos(th), dec * np.sin(th)
        if i < m - 1:
            moved["dt"][i] = rng.uniform(-1, 1) * (tol["ct_mm"] if isglass else tol["air_mm"])
        if isglass:
            moved["dn"][i + 1] = rng.uniform(-tol["nd"], tol["nd"])
    apply(L, moved)
    return L, moved


def apply(L, moved):
    L.c = L.c + moved["dc"]
    L.t = L.t + moved["dt"]
    L.dx, L.dy, L.ax, L.ay = L.dx + moved["dx"], L.dy + moved["dy"], L.ax + moved["ax"], L.ay + moved["ay"]
    L.irr = L.irr + moved["irr"]
    L.n = L.n + moved["dn"][None, :]
    return L


def score(L, intent, N=48):
    """Mean of sagittal and tangential MTF at the reference frequency over the weighted fields, after refocus."""
    fields = intent["half_field_deg"]
    f0 = intent.get("mc_freq", 30)
    shift = optics.best_focus(L, fields, N=24, weights=intent.get("field_weights"))
    vals, spot = [], []
    for f in fields:
        rs = optics.field_rays(L, f, N, image_shift=shift)
        ms, mt = optics.mtf_geom(rs, L, [f0])
        vals.append(0.5 * (ms[0] + mt[0]))
        spot.append(optics.spot_rms(rs, L) * 1e3)
    wts = np.array(intent.get("field_weights", np.ones(len(fields))), float)
    return float((wts * vals).sum() / wts.sum()), float((wts * spot).sum() / wts.sum()), shift, vals


def monte_carlo(d, trials=200, seed=1, threshold=None, N=48, lens=None):
    """Yield against a threshold on the MTF score. Threshold defaults to intent.mc_min, else 80 percent of nominal."""
    lens = lens if lens is not None else design.to_lens(d)
    it = d["intent"]
    nom, nom_spot, _, _ = score(lens, it, N)
    thr = it.get("mc_min", 0.8 * nom) if threshold is None else threshold
    rng = np.random.default_rng(seed)
    vals, spots, recs = [], [], []
    for _ in range(trials):
        L, moved = sample(lens, d, rng)
        v, s, _, _ = score(L, it, N)
        vals.append(v); spots.append(s); recs.append(moved)
    vals = np.array(vals)
    y = float((vals >= thr).mean())
    return dict(trials=trials, seed=seed, nominal=nom, nominal_spot_um=nom_spot, threshold=thr, yield_=y,
                yield_ci95=wilson(int((vals >= thr).sum()), trials), p10=float(np.quantile(vals, .1)), p50=float(np.quantile(vals, .5)),
                p90=float(np.quantile(vals, .9)), spot_p90_um=float(np.quantile(spots, .9)), sensitivity=sensitivities(lens, d, it, N))


def wilson(k, n, z=1.96):
    p = k / n
    den = 1 + z * z / n
    c = (p + z * z / (2 * n)) / den
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return [float(max(0, c - h)), float(min(1, c + h))]


def sensitivities(lens, d, it, N=48):
    """One-at-a-time drop in score from each tolerance at its limit, largest first. Names the first thing to tighten."""
    base = score(lens, it, N)[0]
    rows = []
    m = len(lens.c)
    z = lambda: dict(dc=np.zeros(m), dt=np.zeros(m), dx=np.zeros(m), dy=np.zeros(m), ax=np.zeros(m), ay=np.zeros(m), irr=np.zeros((m, 2)), dn=np.zeros(m + 1))
    for i in range(m):
        tol = design.tolerances(d, i)
        isglass = d["surfaces"][i].get("material") not in (None, "air")
        trials = []
        if d["surfaces"][i].get("stop") is not True:
            a = z(); a["dc"][i] = dc_from_fringes(tol["power_fringes"], lens.semi[i]); trials.append(("power", tol["power_fringes"], a))
            a = z(); a["ay"][i] = tol["tilt_arcmin"] * ARCMIN; trials.append(("tilt", tol["tilt_arcmin"], a))
            a = z(); a["dy"][i] = tol["decentre_mm"]; trials.append(("decentre", tol["decentre_mm"], a))
            a = z(); a["irr"][i, 0] = tol["irreg_fringes"] * design.LAMBDA_TEST_NM * 1e-6 / 2; trials.append(("irregularity", tol["irreg_fringes"], a))
        if i < m - 1:
            a = z(); a["dt"][i] = tol["ct_mm"] if isglass else tol["air_mm"]; trials.append(("thickness", a["dt"][i], a))
        if isglass:
            a = z(); a["dn"][i + 1] = tol["nd"]; trials.append(("index", tol["nd"], a))
        for name, val, mv in trials:
            L = apply(lens.copy(), mv)
            rows.append(dict(surface=i + 1, kind=name, at=float(val), drop=float(base - score(L, it, N)[0])))
    rows.sort(key=lambda r: -r["drop"])
    return rows[:12]
