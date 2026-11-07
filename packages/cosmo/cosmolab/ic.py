# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Initial conditions: Zel'dovich (first-order Lagrangian) displacements from a linear power spectrum.

x = q + D(a) Psi(q),  Psi_k = i k / k^2 delta_k (so delta = -div Psi),  p = a^2 E(a) f(a) D(a) Psi.
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
    kn = np.pi * n / box
    keep = (np.abs(kx) < kn * (1 - 1e-9)) & (np.abs(ky) < kn * (1 - 1e-9)) & (np.abs(kz) < kn * (1 - 1e-9))
    out = np.empty((n, n, n, 3))
    for axis, kk in enumerate((kx, ky, kz)):
        out[..., axis] = np.fft.irfftn(1j * kk / k2 * delta_k * keep, s=(n, n, n), axes=(0, 1, 2))
    return out.reshape(-1, 3)


def lattice(box, n):
    g = (np.arange(n) + 0.0) * box / n
    q = np.stack(np.meshgrid(g, g, g, indexing="ij"), axis=-1)
    return q.reshape(-1, 3)


def zeldovich(cosmo, plin, box, n, a_init, seed, fixed=False):
    """Positions and momenta (numpy, float64) at a_init; also returns Psi for checks."""
    psi = displacement(linear_delta_k(plin, box, n, seed, fixed), box, n)
    d = cosmo.growth(a_init)
    f = cosmo.growth_rate(a_init)
    pos = np.mod(lattice(box, n) + d * psi, box)
    mom = a_init ** 2 * float(cosmo.E(a_init)) * f * d * psi
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
