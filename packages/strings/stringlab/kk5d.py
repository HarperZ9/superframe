# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Kaluza-Klein on a circle: a 5D scalar and a 5D U(1) compactified on S^1 of radius R (circumference 2 pi R).

Scalar. A 5D field phi(x, y) with mass m5 and charge q under a 5D U(1) whose fifth component is a constant Wilson line
A_5 = theta / (2 pi R) decomposes into modes e^{i n y / R}; the 4D masses are m_n^2 = m5^2 + ((n - q theta / 2 pi) / R)^2.
`tower_fd` gets them from a finite-difference covariant Laplacian on N points of the circle (links e^{-i q A_5 dy}).
Charge quantisation: the Wilson line is a phase, so theta -> theta + 2 pi is a gauge transformation; the spectrum is
invariant under it exactly when q is an integer.

Gauge coupling. A 5D Maxwell field with coupling g5 has a static point charge potential on R^3 x S^1 equal to the sum
over images in y, or over KK modes: phi(r, 0) = (g5^2 / (8 pi^2 R r)) coth(r / (2 R)). Far away (r >> R) this is
g4^2 / (4 pi r) with g4^2 = g5^2 / (2 pi R); close in (r << R) it is the 5D law g5^2 / (4 pi^2 r^2). `poisson_fft`
solves the 4D Poisson equation on a periodic lattice (R^3 box times the circle) independently of that formula.
"""
import math

import numpy as np


def tower_exact(R, m5=0.0, q=0.0, theta=0.0, nmax=6):
    """Sorted 4D masses for n = -nmax..nmax."""
    n = np.arange(-nmax, nmax + 1)
    return np.sort(np.sqrt(m5 ** 2 + ((n - q * theta / (2 * math.pi)) / R) ** 2))


def tower_fd(N, R, m5=0.0, q=0.0, theta=0.0):
    """Masses from the covariant finite-difference Laplacian on N points of the circle, sorted."""
    dy = 2 * math.pi * R / N
    A5 = theta / (2 * math.pi * R)
    link = np.exp(-1j * q * A5 * dy)
    H = np.zeros((N, N), dtype=complex)
    for i in range(N):
        H[i, i] = 2 / dy ** 2
        H[i, (i + 1) % N] = -link / dy ** 2
        H[(i + 1) % N, i] = -np.conj(link) / dy ** 2
    ev = np.linalg.eigvalsh(H)
    return np.sort(np.sqrt(np.maximum(ev, 0) + m5 ** 2))


def large_gauge_mismatch(R, q, nmax=6, N=400, theta=0.37):
    """Largest change in the lowest 2 nmax + 1 masses under theta -> theta + 2 pi (finite differences)."""
    a = tower_fd(N, R, q=q, theta=theta)[:2 * nmax + 1]
    b = tower_fd(N, R, q=q, theta=theta + 2 * math.pi)[:2 * nmax + 1]
    return float(np.max(np.abs(a - b)))


def potential_closed(r, R, g5=1.0):
    """Point-charge potential at y = 0 on R^3 x S^1 (sum over the images in y)."""
    return g5 ** 2 / (8 * math.pi ** 2 * R * r) / np.tanh(r / (2 * R))


def potential_kk_sum(r, R, g5=1.0, nmax=200):
    """The same potential as a sum over KK modes: the zero mode is massless 4D Coulomb, mode n a Yukawa of mass |n|/R."""
    n = np.arange(-nmax, nmax + 1)
    return g5 ** 2 / (2 * math.pi * R) * np.sum(np.exp(-np.abs(n)[:, None] * np.atleast_1d(r)[None, :] / R), axis=0) / (4 * math.pi * np.atleast_1d(r))


def g4_squared(R, g5=1.0):
    return g5 ** 2 / (2 * math.pi * R)


def poisson_fft(n3, ny, L, R, g5=1.0):
    """Solve -Laplacian phi = g5^2 delta on a periodic lattice: n3^3 sites over a box of side L times ny sites around the
    circle of circumference 2 pi R. The k = 0 mode is dropped (a neutralising background). Returns (phi, spacings) with
    phi on the axis through the charge at y = 0: phi[i] at r = i a."""
    a = L / n3
    b = 2 * math.pi * R / ny
    kx = 2 * np.pi * np.fft.fftfreq(n3, d=a)
    ky = 2 * np.pi * np.fft.fftfreq(ny, d=b)
    # the lattice Laplacian symbol (second differences)
    sx = (2 - 2 * np.cos(kx * a)) / a ** 2
    sy = (2 - 2 * np.cos(ky * b)) / b ** 2
    S = sx[:, None, None, None] + sx[None, :, None, None] + sx[None, None, :, None] + sy[None, None, None, :]
    src = np.zeros((n3, n3, n3, ny))
    src[0, 0, 0, 0] = g5 ** 2 / (a ** 3 * b)
    F = np.fft.fftn(src)
    S[0, 0, 0, 0] = 1.0
    G = F / S
    G[0, 0, 0, 0] = 0.0
    phi = np.real(np.fft.ifftn(G))
    return phi[:, 0, 0, 0], (a, b)
