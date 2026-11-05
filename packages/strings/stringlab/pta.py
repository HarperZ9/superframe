# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Gravitational-wave background spectra against pulsar-timing and LIGO-Virgo-KAGRA limits.

PTA likelihood by refitting a free spectrum (the method of Lamb, Taylor and van Haasteren 2023): for each
frequency bin i the data give a log posterior density p_i(log10 rho_i), where
    rho_i^2 = h_c(f_i)^2 / (12 pi^2 f_i^3 T) = H0^2 Omega(f_i) / (8 pi^4 f_i^5 T),
and the log likelihood of a spectrum is sum_i p_i(log10 rho_i(model)). Values below the density grid take the
lowest grid value (the noise floor); values above it take the highest. The densities are data and are passed in.

LVK: a spectrum flat across 20 to 76.6 Hz is compared with the O3 isotropic limit Omega(25 Hz) < 5.8e-9
(95 percent, spectral index 0; Abbott et al. 2021, PRD 104 022004).
"""
import math

import numpy as np

FYR = 1.0 / (365.25 * 86400.0)
LVK_O3_FLAT = 5.8e-9
LVK_FREF = 25.0


def log10_rho(omega, f, H0, T):
    return 0.5 * np.log10(H0 ** 2 * np.asarray(omega) / (8 * math.pi ** 4 * np.asarray(f) ** 5 * T))


def powerlaw_log10_rho(log10_A, gamma, f, T):
    """rho for h_c = A (f / f_yr)^((3 - gamma)/2)."""
    rho2 = 10 ** (2 * np.asarray(log10_A)) / (12 * math.pi ** 2) * FYR ** (gamma - 3) * np.asarray(f) ** (-gamma) / T
    return 0.5 * np.log10(rho2)


class FreeSpectrum:
    """Per-bin log densities on a common log10 rho grid; uses the first n_bins bins."""

    def __init__(self, freqs, grid, logdens, n_bins=14, smooth_dex=0.0):
        self.f = np.asarray(freqs)[:n_bins]
        self.grid = np.asarray(grid)
        self.ld = np.asarray(logdens).reshape(-1, self.grid.size)[:n_bins]
        self.T = 1.0 / freqs[0]
        if smooth_dex > 0:
            self.ld = smooth_logdens(self.ld, self.grid[1] - self.grid[0], smooth_dex)

    def loglike(self, lrho):
        """lrho: (..., n_bins) model log10 rho; returns (...) log likelihood."""
        lrho = np.clip(np.asarray(lrho), self.grid[0], self.grid[-1])
        idx = (lrho - self.grid[0]) / (self.grid[1] - self.grid[0])
        i0 = np.clip(np.floor(idx).astype(int), 0, self.grid.size - 2)
        w = idx - i0
        rows = np.arange(self.f.size)
        return np.sum(self.ld[rows, i0] * (1 - w) + self.ld[rows, i0 + 1] * w, axis=-1)


def smooth_logdens(ld, step, width):
    """Gaussian-smooth each row in linear density (width in dex), renormalise, return log density.
    The published densities are sample histograms whose bin-to-bin noise is far narrower than any posterior."""
    half = int(4 * width / step)
    x = np.arange(-half, half + 1) * step
    k = np.exp(-0.5 * (x / width) ** 2)
    k /= k.sum()
    p = np.exp(ld - ld.max(axis=1, keepdims=True))
    out = np.array([np.convolve(row, k, mode="same") for row in p])
    out /= out.sum(axis=1, keepdims=True) * step
    return np.log(np.maximum(out, 1e-300))


def credible(x, logpost, mass=0.9):
    """Median and central interval of a 1D posterior on a grid (trapezoid CDF)."""
    p = np.exp(logpost - logpost.max())
    cdf = np.concatenate([[0], np.cumsum(0.5 * (p[1:] + p[:-1]) * np.diff(x))])
    cdf /= cdf[-1]
    q = lambda u: float(np.interp(u, cdf, x))  # noqa: E731
    return q(0.5), q((1 - mass) / 2), q((1 + mass) / 2)


def hpd_upper(x, logpost, mass=0.95):
    """Upper end of the highest-density interval holding `mass`, found by lowering a density threshold."""
    p = np.exp(logpost - logpost.max())
    dx = np.gradient(x)
    order = np.argsort(-p)
    cum = np.cumsum(p[order] * dx[order])
    cum /= cum[-1]
    keep = order[: np.searchsorted(cum, mass) + 1]
    return float(x[keep].max())


def k_ratio_limit(x, loglike_marg, plateau_from=None):
    """Where the marginal likelihood falls to 1/10 of its small-x plateau (NANOGrav 2023, eq. 10)."""
    ref = loglike_marg[0] if plateau_from is None else plateau_from
    below = np.where(loglike_marg < ref - math.log(10))[0]
    if below.size == 0:
        return None
    j = below[0]
    return float(np.interp(ref - math.log(10), [loglike_marg[j], loglike_marg[j - 1]], [x[j], x[j - 1]]))
