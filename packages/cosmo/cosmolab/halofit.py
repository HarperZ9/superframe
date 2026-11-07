# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Nonlinear matter power by halofit, with the Takahashi et al. (2012, ApJ 761, 152) coefficients for w = -1.

Takahashi et al. quote the fit as good to 5 percent for k < 1 h/Mpc at 0 <= z <= 10, and 10 percent for
1 < k < 10 h/Mpc at 0 <= z <= 3, against their simulation suite. That is the limit on any comparison made
against it. `tests/test_linear_halofit.py` holds this code to CAMB's halofit (version "takahashi").
"""
import numpy as np
from scipy import optimize


def _sigma2_gauss(lnk, d2, r):
    """sigma^2(R) with a Gaussian window, and its first two log derivatives in R."""
    k = np.exp(lnk)
    y2 = (k * r) ** 2
    w = np.exp(-y2)
    s0 = np.trapezoid(d2 * w, lnk)
    s1 = np.trapezoid(d2 * w * y2, lnk)           # int D2 y^2 e^{-y^2}
    s2 = np.trapezoid(d2 * w * y2 * y2, lnk)
    dlns_dlnr = -2.0 * s1 / s0
    d2lns_dlnr2 = -4.0 * s1 / s0 + 4.0 * s2 / s0 - dlns_dlnr ** 2
    return s0, dlns_dlnr, d2lns_dlnr2


def halofit(k, plin_func, omega_m_z, kmin=1e-5, kmax=1e3, n=8192):
    """Nonlinear P(k) from a linear P(k) at the same epoch. omega_m_z = Omega_m(z) for flat LambdaCDM.

    plin_func(k) -> P_lin(k), k in h/Mpc. Returns P_nl(k) in (Mpc/h)^3.
    """
    lnk = np.linspace(np.log(kmin), np.log(kmax), n)
    kk = np.exp(lnk)
    d2 = kk ** 3 * plin_func(kk) / (2 * np.pi ** 2)

    def f(lnr):
        return np.log(_sigma2_gauss(lnk, d2, np.exp(lnr))[0])

    lnr = optimize.brentq(f, np.log(1e-4), np.log(1e3), xtol=1e-12)
    r_sigma = np.exp(lnr)
    _, dlns, d2lns = _sigma2_gauss(lnk, d2, r_sigma)
    n_eff = -3.0 - dlns
    c = -d2lns
    k_sigma = 1.0 / r_sigma

    ne = n_eff
    an = 10 ** (1.5222 + 2.8553 * ne + 2.3706 * ne ** 2 + 0.9903 * ne ** 3 + 0.2250 * ne ** 4 - 0.6038 * c)
    bn = 10 ** (-0.5642 + 0.5864 * ne + 0.5716 * ne ** 2 - 1.5474 * c)
    cn = 10 ** (0.3698 + 2.0404 * ne + 0.8161 * ne ** 2 + 0.5869 * c)
    gam = 0.1971 - 0.0843 * ne + 0.8460 * c
    alpha = abs(6.0835 + 1.3373 * ne - 0.1959 * ne ** 2 - 5.5274 * c)
    beta = 2.0379 - 0.7354 * ne + 0.3157 * ne ** 2 + 1.2490 * ne ** 3 + 0.3980 * ne ** 4 - 0.1682 * c
    nu = 10 ** (5.2105 + 3.6902 * ne)
    f1 = omega_m_z ** -0.0307
    f2 = omega_m_z ** -0.0585
    f3 = omega_m_z ** 0.0743

    k = np.asarray(k, dtype=float)
    dl = k ** 3 * plin_func(k) / (2 * np.pi ** 2)
    y = k / k_sigma
    fy = y / 4.0 + y * y / 8.0
    dq = dl * (1 + dl) ** beta / (1 + alpha * dl) * np.exp(-fy)
    dh_prime = an * y ** (3 * f1) / (1 + bn * y ** f2 + (cn * f3 * y) ** (3 - gam))
    dh = dh_prime / (1 + nu / (y * y))
    return (dq + dh) * 2 * np.pi ** 2 / k ** 3
