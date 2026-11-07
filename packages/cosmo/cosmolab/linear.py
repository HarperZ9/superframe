# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Linear matter power spectrum: the Eisenstein and Hu (1998, ApJ 496, 605) transfer function with baryon
acoustic oscillations, normalised to sigma8.

k is in h/Mpc and P(k) in (Mpc/h)^3 throughout. The fit is quoted by its authors as good to a few percent
for ordinary cosmologies; `tests/test_linear_halofit.py` holds it to a CAMB table.
"""
import numpy as np
from scipy import integrate


def _t_tilde(k, k_eq, alpha_c, beta_c):
    q = k / (13.41 * k_eq)
    l0 = np.log(np.e + 1.8 * beta_c * q)
    c = 14.2 / alpha_c + 386.0 / (1.0 + 69.9 * q ** 1.08)
    return l0 / (l0 + c * q * q)


def eh98_transfer(k_hmpc, cosmo):
    """Eisenstein-Hu 1998 transfer function T(k) with baryon wiggles; T -> 1 as k -> 0."""
    k = np.asarray(k_hmpc, dtype=float) * cosmo.h          # 1/Mpc, as in the paper
    omhh = cosmo.omega_m * cosmo.h ** 2
    obhh = cosmo.omega_b * cosmo.h ** 2
    fb = cosmo.omega_b / cosmo.omega_m
    fc = 1.0 - fb
    th = cosmo.t_cmb / 2.7

    z_eq = 2.50e4 * omhh / th ** 4
    k_eq = 0.0746 * omhh / th ** 2
    b1 = 0.313 * omhh ** -0.419 * (1 + 0.607 * omhh ** 0.674)
    b2 = 0.238 * omhh ** 0.223
    z_d = 1291 * omhh ** 0.251 / (1 + 0.659 * omhh ** 0.828) * (1 + b1 * obhh ** b2)
    r_d = 31.5 * obhh / th ** 4 * (1000.0 / (1 + z_d))
    r_eq = 31.5 * obhh / th ** 4 * (1000.0 / z_eq)
    s = 2.0 / (3 * k_eq) * np.sqrt(6.0 / r_eq) * np.log((np.sqrt(1 + r_d) + np.sqrt(r_d + r_eq)) / (1 + np.sqrt(r_eq)))
    k_silk = 1.6 * obhh ** 0.52 * omhh ** 0.73 * (1 + (10.4 * omhh) ** -0.95)

    a1 = (46.9 * omhh) ** 0.670 * (1 + (32.1 * omhh) ** -0.532)
    a2 = (12.0 * omhh) ** 0.424 * (1 + (45.0 * omhh) ** -0.582)
    alpha_c = a1 ** -fb * a2 ** -(fb ** 3)
    bb1 = 0.944 / (1 + (458 * omhh) ** -0.708)
    bb2 = (0.395 * omhh) ** -0.0266
    beta_c = 1.0 / (1 + bb1 * (fc ** bb2 - 1))

    y = z_eq / (1 + z_d)
    sq = np.sqrt(1 + y)
    g = y * (-6 * sq + (2 + 3 * y) * np.log((sq + 1) / (sq - 1)))
    alpha_b = 2.07 * k_eq * s * (1 + r_d) ** -0.75 * g
    beta_node = 8.41 * omhh ** 0.435
    beta_b = 0.5 + fb + (3 - 2 * fb) * np.sqrt((17.2 * omhh) ** 2 + 1)

    ks = k * s
    f = 1.0 / (1 + (ks / 5.4) ** 4)
    t_c = f * _t_tilde(k, k_eq, 1.0, beta_c) + (1 - f) * _t_tilde(k, k_eq, alpha_c, beta_c)
    s_tilde = s / (1 + (beta_node / np.maximum(ks, 1e-30)) ** 3) ** (1.0 / 3)
    x = k * s_tilde
    j0 = np.where(x > 1e-8, np.sin(x) / np.where(x > 1e-8, x, 1.0), 1.0)
    t_b = (_t_tilde(k, k_eq, 1.0, 1.0) / (1 + (ks / 5.2) ** 2)
           + alpha_b / (1 + (beta_b / np.maximum(ks, 1e-30)) ** 3) * np.exp(-(k / k_silk) ** 1.4)) * j0
    return fb * t_b + fc * t_c


def tophat_window(x):
    x = np.asarray(x, dtype=float)
    small = x < 1e-3
    xs = np.where(small, 1.0, x)
    w = 3.0 * (np.sin(xs) - xs * np.cos(xs)) / xs ** 3
    return np.where(small, 1.0 - x * x / 10.0, w)


def sigma_r(pk_func, r, kmin=1e-5, kmax=1e3, n=4096):
    """rms linear overdensity in a top-hat sphere of radius r (Mpc/h)."""
    lnk = np.linspace(np.log(kmin), np.log(kmax), n)
    k = np.exp(lnk)
    integrand = k ** 3 * pk_func(k) * tophat_window(k * r) ** 2 / (2 * np.pi ** 2)
    return float(np.sqrt(integrate.simpson(integrand, x=lnk)))


class LinearPower:
    """P_lin(k, a) = A k^n_s T(k)^2 D(a)^2 with A set so that sigma8 matches at a = 1."""

    def __init__(self, cosmo):
        self.cosmo = cosmo
        self.amp = 1.0
        s8 = sigma_r(lambda k: self._shape(k), 8.0)
        self.amp = (cosmo.sigma8 / s8) ** 2

    def _shape(self, k):
        return self.amp * k ** self.cosmo.n_s * eh98_transfer(k, self.cosmo) ** 2

    def __call__(self, k, a=1.0):
        d = 1.0 if a == 1.0 else self.cosmo.growth(a)
        return self._shape(np.asarray(k, dtype=float)) * d * d
