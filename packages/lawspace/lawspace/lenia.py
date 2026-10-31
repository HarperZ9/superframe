# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 2: Lenia, a continuous cellular automaton (after Chan 2019), batched on numpy FFTs.

A(t + dt) = clip(A + dt G(K * A), 0, 1), with a smooth ring kernel K of radius R (Chan's exponential
core exp(4 - 1 / (r (1 - r))), unit sum) and growth G(u) = 2 exp(-(u - mu)^2 / (2 sigma^2)) - 1.
Each world in a batch carries its own (mu, sigma). Optional transplant: `conserve=True` rescales every
world after each step so its total mass stays at the starting value (a conserved charge).
"""
import numpy as np
from scipy import fft as sfft
from scipy import ndimage


def kernel_fft(size, R):
    y, x = np.indices((size, size))
    y = np.minimum(y, size - y)
    x = np.minimum(x, size - x)
    r = np.sqrt(x * x + y * y) / R
    k = np.zeros_like(r)
    m = (r > 0) & (r < 1)
    k[m] = np.exp(4 - 1 / (r[m] * (1 - r[m])))
    k /= k.sum()
    return sfft.rfft2(k.astype(np.float32))


def growth(u, mu, sigma):
    return 2.0 * np.exp(-((u - mu) ** 2) / (2 * sigma ** 2)) - 1.0


def seed_worlds(batch, size, R, rng, side=None, density=1.0):
    """Random patch in the centre of each world: uniform values in a square of side about 2 R."""
    side = side or int(2 * R)
    A = np.zeros((batch, size, size))
    o = size // 2 - side // 2
    A[:, o:o + side, o:o + side] = density * rng.random((batch, side, side))
    return A


def run(mu, sigma, rng, size=128, R=13, T=10, steps=500, conserve=False, record=10, A0=None, side=None,
        density=1.0):
    """Run a batch; mu and sigma are arrays of equal length. Returns the final field and a history of
    (mass, occupancy, centroid y, centroid x) every `record` steps."""
    mu = np.asarray(mu, np.float32)[:, None, None]
    sigma = np.asarray(sigma, np.float32)[:, None, None]
    B = mu.shape[0]
    K = kernel_fft(size, R)
    A = (seed_worlds(B, size, R, rng, side, density) if A0 is None else A0.copy()).astype(np.float32)
    m0 = A.sum(axis=(1, 2))
    hist = []
    for t in range(steps):
        U = sfft.irfft2(sfft.rfft2(A, workers=-1) * K, s=(size, size), workers=-1)
        A = np.clip(A + growth(U, mu, sigma) / np.float32(T), 0.0, 1.0)
        if conserve:
            s = A.sum(axis=(1, 2))
            A = np.clip(A * (m0 / np.maximum(s, 1e-12))[:, None, None], 0.0, 1.0)
        if t % record == 0 or t == steps - 1:
            hist.append(_stats(A))
    return A, np.array(hist)  # hist shape (frames, 4, B)


def _stats(A):
    B, n, _ = A.shape
    mass = A.sum(axis=(1, 2))
    occ = (A > 0.1).mean(axis=(1, 2))
    ang = 2 * np.pi * np.arange(n) / n
    wy = A.sum(axis=2)
    wx = A.sum(axis=1)
    cy = np.angle((wy * np.exp(1j * ang)).sum(axis=1)) % (2 * np.pi) * n / (2 * np.pi)
    cx = np.angle((wx * np.exp(1j * ang)).sum(axis=1)) % (2 * np.pi) * n / (2 * np.pi)
    return np.stack([mass, occ, cy, cx])


def classify(A, hist, R=13, size=128):
    """Per world: 'dies', 'fills', 'persists_static', 'persists_moving' or 'unsteady', plus metrics.

    persists: alive at the end, occupancy below 0.25, mass coefficient of variation over the last 40%
    of frames below 0.25. moving: centroid path length over the last 40% above R / 2 (periodic).
    conc: share of the mass in cells above 0.1. A uniform low haze passes the persistence rule with conc
    near 0; a localized creature has conc near 1 (added after run 20261030T063500Z, which lacked it)."""
    mass, occ, cy, cx = hist[:, 0], hist[:, 1], hist[:, 2], hist[:, 3]
    tail = slice(int(0.6 * len(hist)), None)
    out = []
    for b in range(A.shape[0]):
        m_end, o_end = mass[-1, b], occ[-1, b]
        mt = mass[tail, b]
        cv = mt.std() / max(mt.mean(), 1e-9)
        dy = _wrap(np.diff(cy[tail, b]), size)
        dx = _wrap(np.diff(cx[tail, b]), size)
        travel = float(np.hypot(dy, dx).sum())
        comps = int(ndimage.label(A[b] > 0.1)[1])
        conc = float(A[b][A[b] > 0.1].sum() / max(A[b].sum(), 1e-9))  # share of mass in cells above 0.1
        if m_end < 1.0:
            lab = "dies"
        elif o_end > 0.25:
            lab = "fills"
        elif cv < 0.25:
            lab = "persists_moving" if travel > R / 2 else "persists_static"
        else:
            lab = "unsteady"
        out.append({"label": lab, "mass": float(m_end), "occ": float(o_end), "cv": float(cv),
                    "travel": travel, "components": comps,
                    "conc": conc})
    return out


def _wrap(d, n):
    return (d + n / 2) % n - n / 2


def persists(label):
    return label.startswith("persists")
