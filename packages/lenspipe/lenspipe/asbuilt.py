# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""As-built check: fit a perturbed model to measurements, say whether the built part meets the stated standard, name the error.

All measured data in this prototype are SYNTHETIC, from planted errors. No real part has been measured. The verdict words are
MEETS, FAILS, INDETERMINATE and UNEXPLAINED, each for the listed measurements and within the stated uncertainty. There is no
verdict above MEETS: the tool reports a measured gap to the bound, and refuses any wording that claims more.
"""
import numpy as np

from . import optics, tolerance
from .design import tolerances

VERDICTS = ("MEETS", "FAILS", "INDETERMINATE", "UNEXPLAINED")
BANNED = ("perfect", "flawless", "ideal part", "guaranteed")
ZN = 15


def zernike_basis(u, v):
    """First 15 Noll-style terms on the unit disc, unnormalised polynomials are enough for a fit vector."""
    r2 = u * u + v * v
    return np.stack([np.ones_like(u), u, v, 2 * r2 - 1, u * u - v * v, 2 * u * v, (3 * r2 - 2) * u, (3 * r2 - 2) * v, 6 * r2 * r2 - 6 * r2 + 1,
                     u ** 3 - 3 * u * v * v, 3 * u * u * v - v ** 3, (4 * r2 - 3) * (u * u - v * v), (4 * r2 - 3) * 2 * u * v, (10 * r2 * r2 - 12 * r2 + 3) * u, (10 * r2 * r2 - 12 * r2 + 3) * v], 1)


def zernike_fit(r, nm, region=None):
    """Coefficients in waves. Piston, tilt and focus are dropped: those depend on bench alignment. Reference is the ray centroid, which keeps
    the off-axis tilt out of the fit. region (cx, cy, rad), fixed from the nominal lens, keeps the fit off the vignetted edge, whose
    steps with small parameter changes otherwise swamp the noise (found in the first run, seed 31, where 73 percent read UNEXPLAINED)."""
    m = r["live"]
    if m.sum() < 40:
        return np.full(ZN - 4, np.nan)
    if region is None:
        gx, gy = r["gx"][m], r["gy"][m]
        region = (float(gx.mean()), float(gy.mean()), float(0.6 * np.minimum(np.ptp(gx), np.ptp(gy)) / 2))
    cx, cy, rad = region
    inside = m & ((r["gx"] - cx) ** 2 + (r["gy"] - cy) ** 2 <= rad * rad)
    if inside.sum() < 30:
        return np.full(ZN - 4, np.nan)
    px, py = optics.centroid(r)
    W = optics.wavefront(r, px, py, nm)[inside]
    return np.linalg.lstsq(zernike_basis((r["gx"][inside] - cx) / rad, (r["gy"][inside] - cy) / rad), W - W.mean(), rcond=None)[0][4:]


def regions(lens, d, fld):
    """Fit discs per field from the nominal lens, chosen once."""
    out = {}
    for ang in (0.0, fld, -fld):
        r = optics.field_rays(lens, ang, 48)[lens.primary]
        gx, gy = r["gx"][r["live"]], r["gy"][r["live"]]
        out[ang] = (float(gx.mean()), float(gy.mean()), float(0.6 * min(np.ptp(gx), np.ptp(gy)) / 2))
    return out


CHANNELS = {"metrology": 1, "interferogram_axis": 1, "interferogram_field": 1, "mtf_axis": 1, "mtf_field": 1}


def measure(lens, d, channels, freqs=(5, 10, 20), fld=None, focus_steps=(-0.1, 0.0, 0.1)):
    """Forward model. Returns the measurement vector and a noise sigma for each entry, in the channel's own units."""
    it = d["intent"]
    fld = it["half_field_deg"][1] if fld is None else fld
    w0 = lens.primary
    y, sig = [], []
    if "metrology" in channels:
        for i in range(len(lens.c)):
            if not d["surfaces"][i].get("stop"):
                y.append(lens.c[i] * 1e3); sig.append(1e3 * tolerance.dc_from_fringes(0.25, lens.semi[i]))
            if d["surfaces"][i].get("material") not in (None, "air"):
                y.append(lens.t[i]); sig.append(0.002)
    for name, angles in (("interferogram_axis", [0.0]), ("interferogram_field", [fld, -fld])):
        if name in channels:
            for ang in angles:
                r = optics.field_rays(lens, ang, 48)[w0]
                z = zernike_fit(r, lens.wl[w0], (lens.meta.get("zreg") or {}).get(ang))
                y += list(z); sig += [0.02] * len(z)
    for name, angles in (("mtf_axis", [0.0]), ("mtf_field", [fld, -fld])):
        if name in channels:
            for ang in angles:
                for fs in focus_steps:
                    rs = optics.field_rays(lens, ang, 24, image_shift=fs)
                    ms, mt = optics.mtf_geom(rs, lens, list(freqs))
                    y += list(ms) + list(mt); sig += [0.01] * (2 * len(freqs))
    return np.array(y, float), np.array(sig, float)


def params(lens, d, prior_scale=3.0):
    """Fit parameters and prior widths: tolerance limits inflated, so a real fault does not get pulled back to nominal."""
    out = []
    m = len(lens.c)
    for i in range(m):
        s = d["surfaces"][i]
        tol = tolerances(d, i)
        if s.get("stop"):
            continue
        out.append(dict(kind="power", i=i, sd=tolerance.dc_from_fringes(tol["power_fringes"], lens.semi[i]) * prior_scale))
        if s.get("material") not in (None, "air"):
            out.append(dict(kind="ct", i=i, sd=tol["ct_mm"] * prior_scale))
            out.append(dict(kind="index", i=i, sd=tol["nd"] * prior_scale))
        elif i < m - 1:
            out.append(dict(kind="air", i=i, sd=tol["air_mm"] * prior_scale))
    for a, b in _groups(d):
        tol = tolerances(d, a)
        out.append(dict(kind="dec_y", i=a, j=b, sd=tol["decentre_mm"] * prior_scale))
        out.append(dict(kind="dec_x", i=a, j=b, sd=tol["decentre_mm"] * prior_scale))
        out.append(dict(kind="tilt_y", i=a, j=b, sd=tol["tilt_arcmin"] * tolerance.ARCMIN * prior_scale))
    return out


def _groups(d):
    from .design import elements
    return elements(d)


def apply_params(lens, ps, theta):
    L = lens.copy()
    L.c, L.t, L.dx, L.dy, L.ax, L.n = L.c.copy(), L.t.copy(), L.dx.copy(), L.dy.copy(), L.ax.copy(), L.n.copy()
    for p, v in zip(ps, theta):
        if v == 0:
            continue
        i = p["i"]
        if p["kind"] == "power":
            L.c[i] += v
        elif p["kind"] in ("ct", "air"):
            L.t[i] += v
        elif p["kind"] == "index":
            L.n[:, i + 1] += v
        elif p["kind"] == "dec_y":
            L.dy[i:p["j"] + 1] += v
        elif p["kind"] == "dec_x":
            L.dx[i:p["j"] + 1] += v
        elif p["kind"] == "tilt_y":
            L.ax[i:p["j"] + 1] += v
    return L


def standard_metric(lens, d, N=48, shift=None):
    """The standard's metric: MTF at the reference frequency per spec field, geometric model, refocused with the bench."""
    it = d["intent"]
    f0 = it.get("mc_freq", 10)
    shift = optics.best_focus(lens, it["half_field_deg"], N=24) if shift is None else shift
    out = []
    for f in it["half_field_deg"]:
        rs = optics.field_rays(lens, f, N, image_shift=shift)
        ms, mt = optics.mtf_geom(rs, lens, [f0])
        out.append(0.5 * (ms[0] + mt[0]))
    return np.array(out)


class Fitter:
    """Holds the Jacobian at nominal. Refit per case is a linear step plus one relinearised forward correction."""

    def __init__(self, lens, d, channels):
        self.lens, self.d, self.channels = lens, d, channels
        lens.meta["zreg"] = regions(lens, d, d["intent"]["half_field_deg"][1])
        self.ps = params(lens, d)
        self.sd = np.array([p["sd"] for p in self.ps])
        self.y0, self.sig = measure(lens, d, channels)
        J = np.zeros((len(self.y0), len(self.ps)))
        Jm = np.zeros((len(d["intent"]["half_field_deg"]), len(self.ps)))
        self.m0 = standard_metric(lens, d)
        for k in range(len(self.ps)):
            e = np.zeros(len(self.ps))
            e[k] = self.sd[k] * 0.1
            L = apply_params(lens, self.ps, e)
            J[:, k] = (measure(L, d, channels)[0] - self.y0) / e[k]
            Jm[:, k] = (standard_metric(L, d) - self.m0) / e[k]
        self.J, self.Jm = J, Jm
        A = (J / self.sig[:, None])
        H = A.T @ A + np.diag(1 / self.sd ** 2)
        self.cov = np.linalg.inv(H)
        self.A = A

    def fit(self, y):
        """MAP step, one Gauss-Newton refinement of the residual, returns theta and a reduced chi-square."""
        bad = ~np.isfinite(y)
        y = np.where(bad, self.y0, y)
        theta = self.cov @ (self.A.T @ ((y - self.y0) / self.sig))
        for _ in range(2):
            pred = measure(apply_params(self.lens, self.ps, theta), self.d, self.channels)[0]
            pred = np.where(np.isfinite(pred), pred, self.y0)
            theta = theta + self.cov @ (self.A.T @ ((y - pred) / self.sig) - theta / self.sd ** 2)
        pred = measure(apply_params(self.lens, self.ps, theta), self.d, self.channels)[0]
        pred = np.where(np.isfinite(pred), pred, self.y0)
        chi2 = float((((y - pred) / self.sig) ** 2).sum() / max(len(y) - 1, 1))
        return theta, chi2, int(bad.sum())


def assess(fit, y, spec, bound_metric, chi2_limit=4.0, z=1.96):
    """Verdict on one measurement set. spec, per field. bound_metric: the diffraction envelope at the same frequency."""
    theta, chi2, nbad = fit.fit(y)
    L = apply_params(fit.lens, fit.ps, theta)
    m = standard_metric(L, fit.d)
    sd = np.sqrt(np.maximum((fit.Jm @ fit.cov * fit.Jm).sum(1), 0))
    lo, hi = m - z * sd, m + z * sd
    if chi2 > chi2_limit or nbad:
        v = "UNEXPLAINED"
    elif np.all(lo >= spec):
        v = "MEETS"
    elif np.any(hi < spec):
        v = "FAILS"
    else:
        v = "INDETERMINATE"
    # Attribution: the parameter standing furthest outside its prior, and its evidence against the posterior width.
    # The first run ranked by effect on the metric and flagged confidence alone; it was right on 4 of 47 cases while calling all confident.
    z_prior = np.abs(theta) / fit.sd
    order = np.argsort(z_prior)[::-1]
    top = fit.ps[order[0]]
    sig_rat = abs(theta[order[0]]) / np.sqrt(fit.cov[order[0], order[0]])
    clear_lead = z_prior[order[0]] >= 2 * z_prior[order[1]]
    rec = dict(verdict=v, measured=list(fit.channels), metric=[float(x) for x in m], metric_sd=[float(x) for x in sd], spec=[float(x) for x in np.broadcast_to(spec, m.shape)],
               gap_to_spec=[float(x) for x in m - spec], gap_to_bound=[float(bound_metric - x) for x in m], reduced_chi2=chi2,
               responsible=dict(kind=top["kind"], surface=top["i"] + 1, estimate=float(theta[order[0]]), sigma_ratio=float(sig_rat), confident=bool(sig_rat >= 3 and clear_lead and z_prior[order[0]] >= 1)),
               runner_up=dict(kind=fit.ps[order[1]]["kind"], surface=fit.ps[order[1]]["i"] + 1),
               note="synthetic data with planted errors; applies to the listed measurements only")
    refuse_overclaim(rec)
    return rec


def refuse_overclaim(rec):
    txt = str(rec).lower()
    for w in BANNED:
        if w in txt:
            raise ValueError(f"refusing verdict text containing {w!r}")
    if rec["verdict"] not in VERDICTS:
        raise ValueError("unknown verdict word")
    return rec


FAULTS = ("power", "ct", "air", "index", "dec_y", "dec_x", "tilt_y")


def plant(lens, d, rng, ps, fault=None, scale=None):
    """A truth lens: small within-tolerance errors, an unmodelled zonal error, and one dominant fault if asked."""
    theta = rng.uniform(-1, 1, len(ps)) * np.array([p["sd"] for p in ps]) / 3 / 3
    truth = dict(fault=None, scale=0.0)
    extras = dict(unmodelled=None)
    if fault == "zone":
        extras["unmodelled"] = float(scale)
        truth = dict(fault="zone", scale=float(scale))
    elif fault is not None:
        cand = [k for k, p in enumerate(ps) if p["kind"] == fault]
        k = int(rng.choice(cand))
        theta[k] = float(rng.choice([-1, 1])) * ps[k]["sd"] * scale
        truth = dict(fault=fault, scale=float(scale), surface=ps[k]["i"] + 1, value=float(theta[k]))
    L = apply_params(lens, ps, theta)
    # always a small unmodelled zonal figure error, so the data never come from the fit model alone
    L.irr = L.irr.copy()
    amp = 0.1 * 0.3164e-3
    L.irr[:, 1] += rng.uniform(-amp, amp, len(L.c))
    if extras["unmodelled"] is not None:
        idx = int(rng.integers(0, len(L.c)))
        L.irr[idx, 1] += extras["unmodelled"] * 0.3164e-3
        truth["surface"] = idx + 1
    return L, truth


def noisy(y, sig, rng, bias_scale=0.25):
    """Add noise and a small correlated instrument bias, so that the noise model is not simply correct."""
    return y + rng.normal(0, sig) + bias_scale * sig * rng.normal(0, 1)
