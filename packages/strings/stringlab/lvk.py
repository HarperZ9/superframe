# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A spectrum against the published LIGO-Virgo cross-correlation spectrum.

The O3 isotropic data release gives, per frequency bin, an estimator C(f) of Omega_gw(f) and its standard deviation
sigma(f) (normalised with H0 = 67.9 km/s/Mpc). The likelihood is Gaussian (Abbott et al. 2021, PRL 126 241102, eq. 13):
    ln L = -1/2 sum_f (C(f) - Omega(f))^2 / sigma(f)^2,
over a band (20 to 86 Hz for the cosmic-string search, 20 to 1726 Hz for the power-law limits). Bins with infinite or
non-positive sigma (notches) are dropped. Calibration uncertainty is not marginalised here.
The data arrays are passed in; this module ships none.
"""
import math

import numpy as np

H0_LVK = 67.9e3 / 3.0856775814913673e22     # 1/s, the normalisation of the published C(f)


class CrossSpectrum:
    def __init__(self, f, C, sigma, band=(20.0, 86.0)):
        f, C, s = (np.asarray(x, dtype=float) for x in (f, C, sigma))
        keep = (f >= band[0]) & (f <= band[1]) & np.isfinite(s) & (s > 0) & np.isfinite(C)
        self.f, self.C, self.w = f[keep], C[keep], 1.0 / s[keep] ** 2

    def loglike(self, omega, cal_sigma=0.0):
        """omega: (..., nbins) model on self.f; returns ln L relative to Omega = 0 (so zero signal gives 0).
        cal_sigma > 0 marginalises an overall amplitude calibration factor lam ~ N(1, cal_sigma^2) multiplying the
        model, in closed form: with a = sum w C Om and b = sum w Om^2, int N(lam) exp(lam a - lam^2 b / 2) dlam."""
        om = np.asarray(omega)
        a = np.sum(self.w * self.C * om, axis=-1)
        b = np.sum(self.w * om * om, axis=-1)
        if cal_sigma <= 0:
            return a - 0.5 * b
        s2 = cal_sigma ** 2
        P = b + 1 / s2
        return 0.5 * (a + 1 / s2) ** 2 / P - 0.5 / s2 - 0.5 * np.log(P * s2)

    def project(self, f_model, omega_model):
        """Interpolate a model tabulated on f_model (..., nm) to the data bins, log-log."""
        lo = np.log(np.maximum(omega_model, 1e-300))
        x = np.log(self.f)
        xm = np.log(f_model)
        return np.exp(np.apply_along_axis(lambda r: np.interp(x, xm, r), -1, lo))

    def powerlaw_upper(self, alpha=0.0, fref=25.0, lo=1e-13, hi=1e-5, n=40001, mass=0.95, cal_sigma=0.0):
        """95 percent upper limit on Omega_ref with a log-uniform prior on [lo, hi], optionally calibration-marginalised."""
        lw = np.linspace(math.log10(lo), math.log10(hi), n)
        shape = (self.f / fref) ** alpha
        a, b = np.sum(self.w * self.C * shape), np.sum(self.w * shape * shape)
        A = 10 ** lw
        if cal_sigma <= 0:
            ll = A * a - 0.5 * A * A * b
        else:
            s2 = cal_sigma ** 2
            P = A * A * b + 1 / s2
            ll = 0.5 * (A * a + 1 / s2) ** 2 / P - 0.5 / s2 - 0.5 * np.log(P * s2)
        return upper_from_loglike(lw, ll, mass)


def upper_from_loglike(x, ll, mass=0.95):
    """x is the log10 parameter on a uniform grid (log-uniform prior); returns 10^x at the given posterior mass."""
    p = np.exp(ll - ll.max())
    c = np.cumsum(p)
    c /= c[-1]
    return float(10 ** np.interp(mass, c, x))
