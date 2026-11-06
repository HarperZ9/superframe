# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""SU(2) link fields on a 2D lattice and their interpolation to smooth continuum fields.

Conventions follow `nonabelian`: D = d + i A, A = A^a T^a, and a link U_mu(x) = P exp(i int_x^{x+mu} A) transforms as
U -> g(x) U g(x + mu)^dagger. The interpolation takes the logarithm of each link (unique when its rotation angle
stays below pi), places A^a_mu at the link midpoint, and Fourier-interpolates every component to a fine grid.
A covariant smoothing step (staple average projected back to SU(2)) tames rough fields, and the largest plaquette
angle is the admissibility measure: for an admissible field the logarithms are unique and the interpolation is
continuous. Links are stored as unit quaternions (w, x, y, z) for w + i (x, y, z).sigma.

Known answers. Links built from a smooth field interpolate back to it with an error falling as a^2; a smooth lattice
gauge transformation commutes with the interpolation up to the same order; the consistent anomaly computed on
interpolated fields scales with the Dynkin index.
"""
import math

import numpy as np

SIG = np.array([[[0, 1], [1, 0]], [[0, -1j], [1j, 0]], [[1, 0], [0, -1]]], dtype=complex)


def qexp(v):
    """exp(i v.sigma / 2) as a quaternion, v of shape (3, ...)."""
    r = np.sqrt(np.sum(v * v, axis=0))
    s = np.where(r > 1e-14, np.sin(r / 2) / np.where(r > 1e-14, r, 1.0), 0.5)
    return np.concatenate([np.cos(r / 2)[None], s[None] * v], axis=0)


def qlog(u):
    """Inverse of qexp on the principal branch (rotation angle below 2 pi): returns v of shape (3, ...)."""
    w = np.clip(u[0], -1.0, 1.0)
    half = np.arccos(w)
    s = np.sin(half)
    fac = np.where(s > 1e-14, 2 * half / np.where(s > 1e-14, s, 1.0), 2.0)
    return fac[None] * u[1:]


def qmul(a, b):
    w = a[0] * b[0] - np.sum(a[1:] * b[1:], axis=0)
    # i a.sigma i b.sigma = -(a.b) - i (a x b).sigma: the vector part of the product picks a minus sign on the cross term
    v = a[0] * b[1:] + b[0] * a[1:] - np.cross(a[1:], b[1:], axis=0)
    return np.concatenate([w[None], v], axis=0)


def qconj(a):
    return np.concatenate([a[:1], -a[1:]], axis=0)


def qnorm(a):
    return a / np.sqrt(np.sum(a * a, axis=0))[None]


def angle(u):
    """Rotation angle of an SU(2) element, 2 arccos(w), in [0, 2 pi]."""
    return 2 * np.arccos(np.clip(u[0], -1.0, 1.0))


def _spectral_eval(field, L, pts):
    """Evaluate a band-limited periodic field (M x M samples on [0, L)^2) at points pts (2, P) exactly."""
    M = field.shape[-1]
    c = np.fft.fft2(field) / M ** 2
    k = np.fft.fftfreq(M, d=1.0 / M)
    e1 = np.exp(2j * math.pi * np.outer(k, pts[0]) / L)
    e2 = np.exp(2j * math.pi * np.outer(k, pts[1]) / L)
    return np.real(np.einsum("ij,ip,jp->p", c, e1, e2))


def links_from_continuum(A, L, n, sub=8):
    """Lattice links (2, 4, n, n) from a continuum field A (2, 3, M, M): path-ordered products of sub small steps."""
    a = L / n
    x = np.arange(n) * a
    X1, X2 = np.meshgrid(x, x, indexing="ij")
    U = np.zeros((2, 4, n, n))
    for mu in range(2):
        acc = np.zeros((4, n, n))
        acc[0] = 1.0
        for s in range(sub):
            off = (s + 0.5) * a / sub
            P = np.stack([X1 + (off if mu == 0 else 0), X2 + (off if mu == 1 else 0)]).reshape(2, -1)
            v = np.stack([_spectral_eval(A[mu, c], L, P) for c in range(3)]).reshape(3, n, n) * (a / sub)
            acc = qmul(acc, qexp(v))
        U[mu] = acc
    return U


def interpolate(U, L, M):
    """Continuum components A^a_mu on an M x M grid: log of each link over a, at the link midpoint, Fourier-interpolated."""
    n = U.shape[-1]
    a = L / n
    k = np.fft.fftfreq(n, d=1.0 / n)
    out = np.zeros((2, 3, M, M))
    for mu in range(2):
        v = qlog(U[mu]) / a
        for c in range(3):
            C = np.fft.fft2(v[c]) / n ** 2
            # samples sit at x + a/2 along mu: shift back so the coefficients refer to the origin
            ph = np.exp(-2j * math.pi * k * 0.5 / n)
            C = C * (ph[:, None] if mu == 0 else ph[None, :])
            big = np.zeros((M, M), dtype=complex)
            h = n // 2
            idx = np.r_[0:h, M - h:M]
            src = np.r_[0:h, n - h:n]
            big[np.ix_(idx, idx)] = C[np.ix_(src, src)]
            if n % 2 == 0:                                  # drop the Nyquist row and column
                big[M - h, :] = 0
                big[:, M - h] = 0
            out[mu, c] = np.real(np.fft.ifft2(big) * M ** 2)
    return out


def gauge_lattice(U, g):
    """U_mu(x) -> g(x) U_mu(x) g(x + mu)^dagger; g as quaternions (4, n, n)."""
    out = np.empty_like(U)
    for mu in range(2):
        gs = np.roll(g, -1, axis=1 + mu)
        out[mu] = qmul(qmul(g, U[mu]), qconj(gs))
    return out


def _q2m(u):
    """Quaternion field (4, ...) to 2 x 2 matrices (..., 2, 2)."""
    m = u[0][..., None, None] * np.eye(2) + 1j * np.einsum("a...,aij->...ij", u[1:], SIG)
    return m


def gauge_continuum(A, chi, L):
    """A -> g A g^dagger - i g dg^dagger with g = exp(i chi.sigma/2), all on the M x M grid; returns components."""
    M = A.shape[-1]
    g = _q2m(qexp(chi))
    gd = np.conj(np.swapaxes(g, -1, -2))
    kk = 2 * math.pi * np.fft.fftfreq(M, d=L / M)
    out = np.zeros_like(A)
    for mu in range(2):
        Am = 0.5 * np.einsum("a...,aij->...ij", A[mu], SIG)
        K = kk[:, None] if mu == 0 else kk[None, :]
        dgd = np.fft.ifft2(1j * K[..., None, None] * np.fft.fft2(gd, axes=(0, 1)), axes=(0, 1))
        X = g @ Am @ gd - 1j * g @ dgd
        out[mu] = np.real(np.einsum("...ij,aji->a...", X, SIG))
    return out


def plaquette(U):
    """U_12(x) = U_1(x) U_2(x+1) U_1(x+2)^dagger U_2(x)^dagger."""
    return qmul(qmul(U[0], np.roll(U[1], -1, axis=1)), qmul(qconj(np.roll(U[0], -1, axis=2)), qconj(U[1])))


def max_plaquette_angle(U):
    p = angle(plaquette(U))
    return float(np.max(np.minimum(p, 4 * math.pi - p)))


def smooth(U, alpha=0.5, steps=1):
    """Covariant smoothing: each link mixed with its two staples and projected back to SU(2)."""
    U = U.copy()
    for _ in range(steps):
        new = np.empty_like(U)
        for mu in range(2):
            nu = 1 - mu
            Un = U[nu]
            Umu_nu = np.roll(U[mu], -1, axis=1 + nu)
            Un_mu = np.roll(Un, -1, axis=1 + mu)
            up = qmul(qmul(Un, Umu_nu), qconj(Un_mu))
            Und = np.roll(Un, 1, axis=1 + nu)
            Umu_d = np.roll(U[mu], 1, axis=1 + nu)
            Und_mu = np.roll(Und, -1, axis=1 + mu)
            dn = qmul(qmul(qconj(Und), Umu_d), Und_mu)
            new[mu] = qnorm((1 - alpha) * U[mu] + 0.5 * alpha * (up + dn))
        U = new
    return U


def noise(U, rng, amp):
    """Multiply each link by exp(i amp xi.sigma/2), xi standard normal: a rough lattice field near U."""
    return np.stack([qmul(U[mu], qexp(amp * rng.normal(size=(3,) + U.shape[2:]))) for mu in range(2)])
