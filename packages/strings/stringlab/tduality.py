# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Closed bosonic strings with one dimension on a circle of radius R: spectrum, partition function, T-duality.

Spectrum (no noncompact momentum): alpha' M^2 = alpha' (n/R)^2 + (w R)^2/alpha' + 2 (N + Nt - 2), with
level matching N - Nt = n w. A level (N, Nt) holds p24(N) p24(Nt) states (24 transverse oscillators).

Partition function of the compact boson, two independent ways:
  Hamiltonian   Z_H = |eta|^-2 sum_{n,w} q^{(alpha'/4)(n/R + wR/alpha')^2} qbar^{(alpha'/4)(n/R - wR/alpha')^2}
  Lagrangian    Z_L = R / sqrt(alpha' tau2) |eta|^-2 sum_{m,w} exp(-pi R^2 |m - w tau|^2 / (alpha' tau2))
They agree only through Poisson resummation, so Z_H = Z_L is a check of the code, and Z(R) = Z(alpha'/R),
Z(-1/tau) = Z(tau) and Z(tau + 1) = Z(tau) are the physics.
"""
import cmath
import math

import numpy as np


def partitions_power(k, n_max):
    """Coefficients of prod_{n>=1} (1 - q^n)^-k up to q^n_max, exact integers (N a_N = k sum sigma(j) a_{N-j})."""
    sig = [0] * (n_max + 1)
    for d in range(1, n_max + 1):
        for mlt in range(d, n_max + 1, d):
            sig[mlt] += d
    a = [1] + [0] * n_max
    for n in range(1, n_max + 1):
        a[n] = k * sum(sig[j] * a[n - j] for j in range(1, n + 1)) // n
    return a


def spectrum(R, alpha_p=1.0, m2_max=8.0, nw_max=12):
    """Sorted list of (alpha' M^2, degeneracy, n, w, N, Nt) with alpha' M^2 <= m2_max."""
    lev = int(m2_max / 2) + 3
    p24 = partitions_power(24, lev + nw_max * nw_max)
    out = []
    for n in range(-nw_max, nw_max + 1):
        for w in range(-nw_max, nw_max + 1):
            base = alpha_p * (n / R) ** 2 + (w * R) ** 2 / alpha_p
            for N in range(0, lev + abs(n * w) + 1):
                Nt = N - n * w
                if Nt < 0:
                    continue
                m2 = base + 2 * (N + Nt - 2)
                if m2 <= m2_max + 1e-12:
                    out.append((m2, p24[N] * p24[Nt], n, w, N, Nt))
    if any(abs(r[2]) == nw_max or abs(r[3]) == nw_max for r in out):
        raise ValueError("nw_max too small for this radius and mass cutoff")
    out.sort()
    return out


def spectrum_mismatch(R1, R2, alpha_p=1.0, m2_max=8.0):
    """Largest |difference| between the two mass lists after matching degeneracy-weighted levels."""
    s1 = sorted((round(m, 9), d) for m, d, *_ in spectrum(R1, alpha_p, m2_max))
    s2 = sorted((round(m, 9), d) for m, d, *_ in spectrum(R2, alpha_p, m2_max))
    a = np.repeat([m for m, d in s1], [min(d, 10 ** 6) for m, d in s1])
    b = np.repeat([m for m, d in s2], [min(d, 10 ** 6) for m, d in s2])
    if a.size != b.size:
        return float("inf"), int(a.size), int(b.size)
    return float(np.abs(a - b).max()), int(a.size), int(b.size)


def exact_spectrum_mismatch(R1, R2, alpha_p=1.0, m2_max=8.0):
    """Unrounded comparison: masses as floats, sorted with degeneracy as weights."""
    s1 = sorted((m, d) for m, d, *_ in spectrum(R1, alpha_p, m2_max))
    s2 = sorted((m, d) for m, d, *_ in spectrum(R2, alpha_p, m2_max))
    if [d for _, d in s1] != [d for _, d in s2] or len(s1) != len(s2):
        return float("inf")
    return max(abs(x - y) for (x, _), (y, _) in zip(s1, s2))


def massless_count(R, alpha_p=1.0):
    return sum(d for m, d, *_ in spectrum(R, alpha_p, 0.5) if abs(m) < 1e-9)


def eta(tau, terms=400):
    q = cmath.exp(2j * math.pi * tau)
    prod = 1.0 + 0j
    for n in range(1, terms):
        prod *= 1 - q ** n
        if abs(q ** n) < 1e-18:
            break
    return cmath.exp(2j * math.pi * tau / 24) * prod


def z_hamiltonian(tau, R, alpha_p=1.0, cut=40):
    t1, t2 = tau.real, tau.imag
    s = 0.0
    for n in range(-cut, cut + 1):
        for w in range(-cut, cut + 1):
            pl = alpha_p / 4 * (n / R + w * R / alpha_p) ** 2
            pr = alpha_p / 4 * (n / R - w * R / alpha_p) ** 2
            # q^pl qbar^pr = exp(2 pi i tau1 (pl - pr)) exp(-2 pi tau2 (pl + pr)), and pl - pr = n w
            s += math.cos(2 * math.pi * t1 * n * w) * math.exp(-2 * math.pi * t2 * (pl + pr))
    return s / abs(eta(tau)) ** 2


def z_lagrangian(tau, R, alpha_p=1.0, cut=40):
    t2 = tau.imag
    s = 0.0
    for m in range(-cut, cut + 1):
        for w in range(-cut, cut + 1):
            s += math.exp(-math.pi * R ** 2 * abs(m - w * tau) ** 2 / (alpha_p * t2))
    return R / math.sqrt(alpha_p * t2) * s / abs(eta(tau)) ** 2


def partition_checks(tau, R, alpha_p=1.0):
    zh = z_hamiltonian(tau, R, alpha_p)
    return {"Z_H": zh,
            "poisson": abs(zh - z_lagrangian(tau, R, alpha_p)) / zh,
            "t_duality": abs(zh - z_hamiltonian(tau, alpha_p / R, alpha_p)) / zh,
            "s_modular": abs(zh - z_hamiltonian(-1 / tau, R, alpha_p)) / zh,
            "t_modular": abs(zh - z_hamiltonian(tau + 1, R, alpha_p)) / zh}
