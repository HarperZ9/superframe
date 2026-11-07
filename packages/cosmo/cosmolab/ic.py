# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Initial conditions: first- and second-order Lagrangian displacements from a linear power spectrum.

Zel'dovich: x = q + D(a) Psi(q),  Psi_k = i k / k^2 delta_k (so delta = -div Psi),  p = a^2 E(a) f(a) D(a) Psi.
Second order (2LPT; Scoccimarro 1998, MNRAS 299, 1097; Crocce, Pueblas and Scoccimarro 2006, MNRAS 373, 369):
    x = q + D1 Psi1 + D2 grad phi2,   lap phi2 = sum_{i<j} (phi1_ii phi1_jj - phi1_ij^2),   lap phi1 = delta
with D2 = -3/7 D1^2 Omega_m(a)^(-1/143) and p gaining a^2 E f2 D2 grad phi2, f2 = 2 Omega_m(a)^(6/11).
delta_k is drawn on the particle lattice with numpy's FFT convention, P(k) = V / N^6 <|delta_k|^2>.
`fixed=True` sets |delta_k| to its expected value and keeps only the random phase (Angulo and Pontzen
2016), which removes most of the cosmic variance from a single box's P(k) on large scales.
"""
import numpy as np


def _kgrid(n, box):
    k = 2 * np.pi * np.fft.fftfreq(n, d=box / n)
    kz = 2 * np.pi * np.fft.rfftfreq(n, d=box / n)
    return k.reshape(-1, 1, 1), k.reshape(1, -1, 1), kz.reshape(1, 1, -1)


def linear_delta_k(plin, box, n, seed, fixed=False):
    """delta_k at a = 1 on an n^3 lattice (rfftn layout), from a real white-noise field."""
    rng = np.random.default_rng(seed)
    w = np.fft.rfftn(rng.standard_normal((n, n, n)))
    kx, ky, kz = _kgrid(n, box)
    k = np.sqrt(kx * kx + ky * ky + kz * kz)
    p = np.zeros_like(k)
    nz = k > 0
    p[nz] = plin(k[nz])
    vol = box ** 3
    if fixed:
        amp = np.abs(w)
        w = w / np.where(amp > 0, amp, 1.0) * np.sqrt(n ** 3)
    return w * np.sqrt(p * n ** 3 / vol)


def displacement(delta_k, box, n):
    """Psi(q) on the lattice, shape (n^3, 3), from delta_k at a = 1. Nyquist planes are dropped."""
    kx, ky, kz = _kgrid(n, box)
    k2 = kx * kx + ky * ky + kz * kz
    k2[0, 0, 0] = 1.0
    keep = _nyquist_keep(kx, ky, kz, box, n)
    out = np.empty((n, n, n, 3))
    for axis, kk in enumerate((kx, ky, kz)):
        out[..., axis] = np.fft.irfftn(1j * kk / k2 * delta_k * keep, s=(n, n, n), axes=(0, 1, 2))
    return out.reshape(-1, 3)


def _nyquist_keep(kx, ky, kz, box, n):
    kn = np.pi * n / box
    return (np.abs(kx) < kn * (1 - 1e-9)) & (np.abs(ky) < kn * (1 - 1e-9)) & (np.abs(kz) < kn * (1 - 1e-9))


def second_order_displacement(delta_k, box, n):
    """grad phi2 on the lattice, shape (n^3, 3): the 2LPT displacement before the factor D2(a).

    phi1_ij = k_i k_j / k^2 delta_k (since lap phi1 = delta); the source is the sum over the three pairs
    i < j of phi1_ii phi1_jj - phi1_ij^2, and phi2_k = -source_k / k^2."""
    kx, ky, kz = _kgrid(n, box)
    ks = (kx, ky, kz)
    k2 = kx * kx + ky * ky + kz * kz
    k2[0, 0, 0] = 1.0
    dk = delta_k * _nyquist_keep(kx, ky, kz, box, n) / k2
    shape = (n, n, n)
    diag = [np.fft.irfftn(ks[i] * ks[i] * dk, s=shape) for i in range(3)]
    src = np.zeros(shape)
    for i, j in ((0, 1), (0, 2), (1, 2)):
        src += diag[i] * diag[j] - np.fft.irfftn(ks[i] * ks[j] * dk, s=shape) ** 2
    del diag
    phi2 = -np.fft.rfftn(src) / k2
    phi2[0, 0, 0] = 0.0
    phi2 *= _nyquist_keep(kx, ky, kz, box, n)
    out = np.empty((n, n, n, 3))
    for axis, kk in enumerate(ks):
        out[..., axis] = np.fft.irfftn(1j * kk * phi2, s=shape)
    return out.reshape(-1, 3)


def growth2(cosmo, a):
    """Second-order growth D2(a) and its rate f2 (Bouchet et al. 1995 fits, good to well under a percent)."""
    om = float(cosmo.omega_m_a(a))
    return -3.0 / 7.0 * cosmo.growth(a) ** 2 * om ** (-1.0 / 143.0), 2.0 * om ** (6.0 / 11.0)


def from_delta_k(cosmo, delta_k, box, n, a, order=1, d2_sign=1.0):
    """Positions and momenta at a from delta_k (a = 1 normalisation) to first or second Lagrangian order.
    d2_sign = -1 flips the second-order term: kept only as a planted wrong input for the tests."""
    psi = displacement(delta_k, box, n)
    d, f = cosmo.growth(a), cosmo.growth_rate(a)
    e = float(cosmo.E(a))
    pos = lattice(box, n) + d * psi
    mom = a ** 2 * e * f * d * psi
    psi2 = None
    if order >= 2:
        psi2 = second_order_displacement(delta_k, box, n)
        d2, f2 = growth2(cosmo, a)
        d2 *= d2_sign
        pos += d2 * psi2
        mom += a ** 2 * e * f2 * d2 * psi2
    return np.mod(pos, box), mom, psi, psi2


def lattice(box, n):
    g = (np.arange(n) + 0.0) * box / n
    q = np.stack(np.meshgrid(g, g, g, indexing="ij"), axis=-1)
    return q.reshape(-1, 3)


def zeldovich(cosmo, plin, box, n, a_init, seed, fixed=False, order=1):
    """Positions and momenta (numpy, float64) at a_init; also returns Psi for checks. order=2 adds 2LPT."""
    pos, mom, psi, _ = from_delta_k(cosmo, linear_delta_k(plin, box, n, seed, fixed), box, n, a_init, order)
    return pos, mom, psi


def pancake(cosmo, box, n, a_cross, a):
    """A plane-wave Zel'dovich pancake along x that shell-crosses at a_cross: exact positions and momenta
    at a (before crossing the Zel'dovich solution is exact for plane-parallel collapse)."""
    q = lattice(box, n)
    k = 2 * np.pi / box
    amp = cosmo.growth(a) / cosmo.growth(a_cross)
    pos = q.copy()
    pos[:, 0] = q[:, 0] - amp * np.sin(k * q[:, 0]) / k
    mom = np.zeros_like(q)
    mom[:, 0] = -a ** 2 * float(cosmo.E(a)) * cosmo.growth_rate(a) * amp * np.sin(k * q[:, 0]) / k
    return np.mod(pos, box), mom, q
