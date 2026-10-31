# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Discrete Gabor frames on rectangular and hexagonal time-frequency lattices, plus chirplets.

Signal length L, periodic. An atom at time n a and frequency bin m b + shift_n is
g(t - n a) exp(2 pi i f (t - n a) / L), with a periodised Gaussian g of width sigma samples.
'rect': shift 0. 'hex': shift b/2 on odd columns (a quincunx lattice; with sigma free it becomes
the equilateral, hexagonal lattice after the time-frequency rescaling the window sets).
Density (redundancy) is L / (a b) for both, so rect and hex at the same (a, b) are equal-count.
A chirplet adds a first-order field inside the tile: phase pi c (t - n a)^2 / L, c in bins per
sample, so frequency drifts linearly across the atom.
"""
import math

import numpy as np


def window(L, sigma):
    t = np.arange(L)
    t = np.minimum(t, L - t).astype(float)
    g = np.exp(-0.5 * (t / sigma) ** 2)
    return g / np.linalg.norm(g)


def lattice(L, a, b, kind):
    if L % a or L % b:
        raise ValueError("a and b must divide L")
    if kind == "hex" and (b % 2 or (L // a) % 2):
        raise ValueError("hex needs b even and an even column count")
    pts = []
    for n in range(L // a):
        shift = (b / 2 if kind == "hex" and n % 2 else 0.0)
        for m in range(L // b):
            pts.append((n * a, m * b + shift))
    return np.array(pts)


def atoms(L, sigma, pts, chirp=0.0):
    """Synthesis matrix (L x K): one column per (time, frequency) point."""
    t = np.arange(L)
    g = window(L, sigma)
    T0, F0 = pts[:, 0].astype(int), pts[:, 1]
    tt = (t[:, None] - T0[None, :]) % L
    tc = np.where(tt > L / 2, tt - L, tt).astype(float)       # centred time
    G = g[tt] * np.exp(2j * np.pi * F0[None, :] * tc / L + 1j * np.pi * chirp * tc ** 2 / L)
    return G / np.linalg.norm(G, axis=0, keepdims=True)


def frame_operator(L, sigma, a, b, kind):
    """Frame operator S = G G^H of the (non-chirped) lattice system, by the Walnut structure.

    sum_m exp(2 pi i m b D / L) is L / b when D = 0 mod L / b and 0 otherwise, so S has only
    b nonzero cyclic diagonals; the hex shift b/2 (an integer) adds a sign per odd column.
    """
    g = window(L, sigma)
    t = np.arange(L)
    shifts = np.array([(b // 2 if kind == "hex" and n % 2 else 0) for n in range(L // a)], float)
    Gs = np.stack([np.roll(g, n * a) for n in range(L // a)])   # (columns, L)
    S = np.zeros((L, L), complex)
    for j in range(b):
        D = j * (L // b)
        ph = np.exp(2j * np.pi * shifts * D / L)
        diag = (L / b) * np.sum(Gs * np.roll(Gs, D, axis=1) * ph[:, None], axis=0)   # S[t, t - D]
        S[t, (t - D) % L] += diag
    return S


def bounds_fast(L, sigma, a, b, kind):
    ev = np.linalg.eigvalsh(frame_operator(L, sigma, a, b, kind))
    return float(ev.min()), float(ev.max())


def frame_bounds(G):
    ev = np.linalg.eigvalsh(G @ G.conj().T)
    return float(ev.min()), float(ev.max())


def best_sigma(L, a, b, kind, sigmas):
    """Window width that minimises the condition number B / A; returns (sigma, A, B, table)."""
    rows = []
    for s in sigmas:
        A, B = bounds_fast(L, s, a, b, kind)
        rows.append((s, A, B, B / A if A > 1e-12 else math.inf))
    s, A, B, _ = min(rows, key=lambda r: r[3])
    return s, A, B, rows


def canonical_dual_rebuild(G, x, noise_rel, rng):
    """Analyse with G^H, add white noise at noise_rel of the coefficient RMS, rebuild by S^-1 G."""
    c = G.conj().T @ x
    rms = np.sqrt(np.mean(np.abs(c) ** 2))
    c = c + noise_rel * rms * (rng.normal(size=c.shape) + 1j * rng.normal(size=c.shape)) / math.sqrt(2)
    S = G @ G.conj().T
    return np.linalg.solve(S, G @ c)


def snr_db(x, xh):
    return 10 * math.log10(np.sum(np.abs(x) ** 2) / max(np.sum(np.abs(x - xh) ** 2), 1e-300))


def omp(D, x, k, DH=None):
    """Orthogonal matching pursuit with k atoms from unit-norm dictionary columns D.

    DH, the conjugate transpose of D, can be passed in to avoid recomputing it per call.
    """
    DH = np.ascontiguousarray(D.conj().T) if DH is None else DH
    r = x.copy()
    sel = []
    for _ in range(k):
        j = int(np.argmax(np.abs(DH @ r)))
        sel.append(j)
        coef, *_ = np.linalg.lstsq(D[:, sel], x, rcond=None)
        r = x - D[:, sel] @ coef
    return x - r, sel


def analytic(x):
    X = np.fft.fft(x)
    h = np.zeros(len(x))
    h[0] = 1
    h[1:(len(x) + 1) // 2] = 2
    if len(x) % 2 == 0:
        h[len(x) // 2] = 1
    return np.fft.ifft(X * h)


def tf_axis_alignment(x, nfft=64, hop=8, wedge_deg=7.5):
    """Axis alignment of the log spectrogram's own 2-D spectrum (same index as for images)."""
    from .imagerep import axis_alignment
    w = np.hanning(nfft)
    frames = [x[i:i + nfft] * w for i in range(0, len(x) - nfft + 1, hop)]
    Sg = np.log(np.abs(np.fft.rfft(np.array(frames), axis=1)) ** 2 + 1e-8).T
    return axis_alignment(Sg, wedge_deg, kmin=2)
