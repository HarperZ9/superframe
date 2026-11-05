# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Continuum Weyl fermions on a two-torus coupled to a lattice U(1) field interpolated to the continuum.

A small 2D version of the construction of Craig (arXiv:2610.09093), Hsu (arXiv:2610.29019) and Witten
(arXiv:2611.05051): lattice links -> continuum connection -> continuum chiral fermions, no lattice fermions.

Interpolation (abelian, torus of side L in lattice units). Lattice angles are split by a lattice Hodge
decomposition into a harmonic part (one constant per direction), a gauge part grad(lambda) and a coexact part
fixed by the plaquette field. The continuum field is A = h + grad(lambda_c) + curl-part of phi, with lambda_c and
the field strength F_c the band-limited (Fourier) interpolations of lambda and of the plaquette angles placed at
plaquette centres, and Laplacian(phi) = -F_c. A lattice gauge transformation g maps to lambda_c -> lambda_c + g_c,
an exact continuum gauge transformation, so the interpolation is gauge covariant by construction.

Fermions. Antiperiodic plane waves k = (2 pi / L)(n + 1/2), |n_i + 1/2| <= N (a square, symmetric cutoff).
Left mover of charge q:  D_L = (d1 + i d2) + i q (A1 + i A2);  right mover:  D_R = (d1 - i d2) + i q (A1 - i A2).
Both are square matrices on the truncated space, normalised by their free values. The modulus of the full product
is taken in Coulomb gauge (lambda = 0), where it is gauge invariant by construction; the phase is computed in any
gauge and its gauge dependence is the measured anomaly. For a theory with sum_L q^2 = sum_R q^2 (for example the
3-4-5 model: left 3, 4; right 5, 0) the phase is gauge invariant up to cutoff effects; otherwise it moves in
proportion to sum_L q^2 - sum_R q^2.
"""
import math

import numpy as np


class Torus:
    def __init__(self, L, N):
        self.L = L
        n = np.arange(-N, N) + 0.5
        n1, n2 = np.meshgrid(n, n, indexing="ij")
        self.k1 = (2 * math.pi / L * n1).ravel()
        self.k2 = (2 * math.pi / L * n2).ravel()
        self.n = np.stack([n1.ravel(), n2.ravel()], 1)
        self.size = self.k1.size

    def multiplier(self, fhat, M):
        """Matrix of multiplication by a periodic function with Fourier coefficients fhat (M x M, numpy fft order)."""
        d = (self.n[:, None, :] - self.n[None, :, :]).round().astype(int)      # k - k' in units of 2 pi / L
        ok = (np.abs(d[..., 0]) < M // 2) & (np.abs(d[..., 1]) < M // 2)
        out = np.zeros((self.size, self.size), dtype=complex)
        out[ok] = fhat[d[..., 0][ok] % M, d[..., 1][ok] % M]
        return out

    def weyl(self, A1hat, A2hat, q, chirality, M):
        if chirality == "L":
            kin = 1j * self.k1 - self.k2
            pot = 1j * q * (A1hat + 1j * A2hat)
        else:
            kin = 1j * self.k1 + self.k2
            pot = 1j * q * (A1hat - 1j * A2hat)
        return np.diag(kin) + self.multiplier(pot, M), kin

    def logdet(self, A1, A2, q, chirality):
        """log det(D / D_free) for a field sampled on an M x M grid over the torus (complex; imaginary part = phase)."""
        M = A1.shape[0]
        A1h, A2h = np.fft.fft2(A1) / M ** 2, np.fft.fft2(A2) / M ** 2
        D, kin = self.weyl(A1h, A2h, q, chirality, M)
        sgn, ld = np.linalg.slogdet(D / kin[:, None])
        return ld + 1j * np.angle(sgn)


def hodge(th):
    """Lattice Hodge pieces of link angles th (2, L, L): harmonic h (2,), gauge lambda (L, L), plaquettes F (L, L)."""
    from .u1 import plaquettes
    L = th.shape[1]
    h = np.array([th[0].sum() / L ** 2, th[1].sum() / L ** 2])      # mean angle per link, per direction
    # gauge part: lattice divergence of theta equals the lattice Laplacian of lambda
    div = (th[0] - np.roll(th[0], 1, axis=0)) + (th[1] - np.roll(th[1], 1, axis=1))
    p = 2 * math.pi * np.fft.fftfreq(L)
    lap = -(2 - 2 * np.cos(p))[:, None] - (2 - 2 * np.cos(p))[None, :]
    lap[0, 0] = 1.0
    lam_hat = np.fft.fft2(div) / lap
    lam_hat[0, 0] = 0.0
    lam = np.real(np.fft.ifft2(lam_hat))
    return h, lam, plaquettes(th)


def band_limited(values, M, shift):
    """Fourier interpolation of an L x L lattice function to an M x M grid; shift = (s1, s2) in lattice units
    (0 for sites, 0.5 for plaquette centres)."""
    L = values.shape[0]
    vh = np.fft.fft2(values) / L ** 2
    p = np.fft.fftfreq(L) * L                                     # integer wave numbers
    x = np.arange(M) * L / M
    e1 = np.exp(2j * math.pi * np.outer(x - shift[0], p) / L)    # (M, L)
    e2 = np.exp(2j * math.pi * np.outer(x - shift[1], p) / L)
    return np.real(e1 @ vh @ e2.T)


def interpolate(th, M, coulomb=False):
    """Continuum (A1, A2) on an M x M grid (torus side L lattice units) from lattice link angles; Q = 0 sector."""
    L = th.shape[1]
    h, lam, F = hodge(th)
    Fc = band_limited(F, M, (0.5, 0.5))
    kk = 2 * math.pi * np.fft.fftfreq(M, d=L / M)
    K1, K2 = np.meshgrid(kk, kk, indexing="ij")
    k2 = K1 ** 2 + K2 ** 2
    k2[0, 0] = 1.0
    phih = np.fft.fft2(Fc) / k2                                   # -Laplacian(phi) = F, so phi_hat = F_hat / k^2
    phih[0, 0] = 0.0
    A1 = np.real(np.fft.ifft2(1j * K2 * phih)) + h[0]               # A = (d2 phi, -d1 phi): d1 A2 - d2 A1 = F
    A2 = np.real(np.fft.ifft2(-1j * K1 * phih)) + h[1]
    if not coulomb:
        lc = band_limited(lam, M, (0.0, 0.0))
        lh = np.fft.fft2(lc)
        A1 = A1 + np.real(np.fft.ifft2(1j * K1 * lh))
        A2 = A2 + np.real(np.fft.ifft2(1j * K2 * lh))
    return A1, A2


def link_mismatch(th, M):
    """Largest difference, mod 2 pi, between a lattice link angle and the line integral of the interpolated field."""
    L = th.shape[1]
    A1, A2 = interpolate(th, M)
    s = M // L
    worst = 0.0
    for a in range(L):
        for b in range(L):
            i1 = (np.arange(s) + a * s)
            line1 = np.sum(A1[i1 % M, b * s]) * L / M
            line2 = np.sum(A2[a * s, (np.arange(s) + b * s) % M]) * L / M
            for v, t in ((line1, th[0, a, b]), (line2, th[1, a, b])):
                d = (v - t + math.pi) % (2 * math.pi) - math.pi
                worst = max(worst, abs(d))
    return worst


def total_logdet(torus, A1, A2, left, right):
    return sum(torus.logdet(A1, A2, q, "L") for q in left if q) + sum(torus.logdet(A1, A2, q, "R") for q in right if q)


def smooth_gauge(M, L, rng, amp=0.5, modes=3):
    """A smooth periodic gauge function chi on the M x M grid, and its gradient."""
    x = np.arange(M) * L / M
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    chi = np.zeros((M, M))
    g1 = np.zeros((M, M))
    g2 = np.zeros((M, M))
    for _ in range(modes):
        m1, m2 = rng.integers(-2, 3, 2)
        if m1 == 0 and m2 == 0:
            continue
        a, ph = amp * rng.normal(), rng.uniform(0, 2 * math.pi)
        arg = 2 * math.pi * (m1 * X1 + m2 * X2) / L + ph
        chi += a * np.sin(arg)
        g1 += a * np.cos(arg) * 2 * math.pi * m1 / L
        g2 += a * np.cos(arg) * 2 * math.pi * m2 / L
    return chi, g1, g2


def spectral_flow_circle(A, L, q, N, steps=81):
    """Right-moving Weyl Hamiltonian H = -i d/dx + q A(x) on a circle of length L, Fourier-truncated to |n| <= N.
    A(x) (sampled on M points) is shifted by a constant c from 0 to 2 pi / L (one flux quantum); returns the net
    number of eigenvalues that cross zero upward, which must be q (the gauge charge pumped is then q^2)."""
    M = A.size
    Ah = np.fft.fft(A) / M
    n = np.arange(-N, N + 1)
    d = n[:, None] - n[None, :]
    V = np.where(np.abs(d) < M // 2, Ah[d % M], 0.0)
    crossings = 0
    prev = None
    for c in np.linspace(0, 2 * math.pi / L, steps):
        H = np.diag(2 * math.pi * n / L) + q * (V + c * np.eye(n.size))
        ev = np.linalg.eigvalsh(0.5 * (H + H.conj().T))
        neg = int(np.sum(ev < 0))      # the matrix size is fixed, so this count changes only at zero crossings
        if prev is not None:
            crossings += prev - neg
        prev = neg
    return crossings
