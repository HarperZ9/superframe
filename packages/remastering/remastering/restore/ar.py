# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Autoregressive tools shared by declip, declick and gap filling.

AR fit: Yule-Walker on the samples around a gap. LSAR interpolation (Janssen, Veldhuis and
Vries 1986; Godsill and Rayner 1998): with the AR polynomial a, the prediction error e = A x is linear in the
unknown samples x_u, so the x_u that minimise |e|^2 solve (A_u^T A_u) x_u = -A_u^T A_k x_k. The filled samples
are an inference from the surrounding signal, not recovered data.
"""
import numpy as np
from scipy.linalg import solve_toeplitz


def fit(x, order):
    """AR coefficients a (a[0] = 1) by Yule-Walker (biased autocorrelation, Levinson solve via solve_toeplitz)."""
    x = np.asarray(x, np.float64)
    if len(x) <= 2 * order:
        order = max(1, len(x) // 3)
    x = x - x.mean()
    n = len(x)
    nfft = 1 << int(np.ceil(np.log2(2 * n)))
    X = np.fft.rfft(x, nfft)
    r = np.fft.irfft(X * np.conj(X), nfft)[: order + 1] / n
    if r[0] <= 0:
        return np.concatenate([[1.0], np.zeros(order)])
    r[0] *= 1 + 1e-9                                      # white-noise floor keeps the solve well posed
    coef = solve_toeplitz(r[:order], r[1:order + 1])
    return np.concatenate([[1.0], -coef])


def lsar(seg, missing, order=32, a=None):
    """Fill seg[missing] (boolean mask) by LSAR; returns a copy.

    A is banded Toeplitz, so A_u^T A_u is the AR polynomial's autocorrelation r at the lags between missing
    samples, and A_u^T A_k x_k is r convolved with the known samples (zeros at the gaps), read at the gaps. Exact
    when every missing sample is at least `order` samples inside the segment."""
    seg = np.asarray(seg, np.float64).copy()
    if not missing.any():
        return seg
    if a is None:
        a = fit(seg[~missing] if (~missing).sum() > 3 * order else seg, order)
    p = len(a) - 1
    r = np.correlate(a, a, mode="full")                    # lags -p..p
    u = np.flatnonzero(missing)
    lag = np.abs(u[:, None] - u[None, :])
    R = np.where(lag <= p, r[p + np.minimum(lag, p)], 0.0)
    known = np.where(missing, 0.0, seg)
    b = np.convolve(known, r, mode="same")[u]
    xu = np.linalg.solve(R + 1e-9 * np.eye(len(u)), -b)
    seg[u] = xu
    return seg


def runs(mask):
    """(start, stop) of every run of True."""
    d = np.diff(np.concatenate([[0], mask.astype(np.int8), [0]]))
    return list(zip(np.flatnonzero(d == 1), np.flatnonzero(d == -1)))


def fill_runs(x, mask, order=None, context=None, max_run=2048):
    """LSAR over every run in mask, each with its own context window. Returns (filled, list of runs filled).
    order None picks min(128, max(32, 3 L)) per run: dense music needs a high order once a gap is longer than a
    few samples (a held chord with its harmonics is dozens of sinusoids, two poles each)."""
    x = np.asarray(x, np.float64).copy()
    done = []
    for s, e in runs(mask):
        L = e - s
        if L > max_run:
            continue
        p = order or min(128, max(32, 3 * L))
        c = context or min(4096, max(32 * p, 3 * L))
        a0, b0 = max(0, s - c), min(len(x), e + c)
        m = mask[a0:b0].copy()
        x[a0:b0] = lsar(x[a0:b0], m, p)
        done.append((int(s), int(e)))
    return x, done
