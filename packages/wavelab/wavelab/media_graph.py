# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Vibrating media beyond one chain: mass-spring graphs (chains, square membranes) with several input sites, and
the NARMA-10 benchmark.

Each edge (i, j) carries the spring law k1 d + k2 d^2 + k3 d^3 with d = x_j - x_i; boundary nodes are tied to a
fixed wall by the same law. The input s u(t) enters at `sites` nodes with fixed random signs. Readout: every
node's displacement and velocity at the end of each input step, ridge regression (reservoir.ridge), held out.
NARMA-10 (Atiya and Parlos 2000): y(t+1) = 0.3 y + 0.05 y sum_{i=0}^{9} y(t-i) + 1.5 u(t-9) u(t) + 0.1 with u
uniform on [0, 0.5]; scored by NRMSE on held-out steps (1 is the score of predicting the mean).
"""
import numpy as np

from .reservoir import r2, ridge


def geometry(kind, size):
    """Edges and wall ties: ("chain", n) or ("grid", side). Returns n_nodes, edges (E, 2), wall node list."""
    if kind == "chain":
        n = size
        edges = np.array([[i, i + 1] for i in range(n - 1)])
        return n, edges, np.array([0, n - 1])
    if kind == "grid":
        n = size * size
        idx = np.arange(n).reshape(size, size)
        e = [[idx[r, c], idx[r, c + 1]] for r in range(size) for c in range(size - 1)]
        e += [[idx[r, c], idx[r + 1, c]] for r in range(size - 1) for c in range(size)]
        rim = np.unique(np.concatenate([idx[0], idx[-1], idx[:, 0], idx[:, -1]]))
        return n, np.array(e), rim
    raise ValueError(kind)


def simulate(u, kind="chain", size=24, sites=1, k1=1.0, k2=0.0, k3=0.0, g=0.02, s=1.0, tau=6.0, dt=0.05, seed=0):
    """Velocity Verlet on the graph; returns features (len(u), 2 n)."""
    rng = np.random.default_rng(seed)
    n, edges, wall = geometry(kind, size)
    m = 1.0 + 0.3 * rng.random(n)
    where = rng.choice(n, sites, replace=False)
    sign = rng.choice([-1.0, 1.0], sites)
    drive_vec = np.zeros(n)
    drive_vec[where] = sign / np.sqrt(sites)
    a_i, b_i = edges[:, 0], edges[:, 1]

    def law(d):
        return k1 * d + k2 * d * d + k3 * d ** 3

    def force(x, v, drive):
        fe = law(x[b_i] - x[a_i])
        f = np.zeros(n)
        np.add.at(f, a_i, fe)
        np.add.at(f, b_i, -fe)
        f[wall] -= law(x[wall])  # tie to the wall: extension x_i - 0
        return (f - g * v * m + drive * drive_vec) / m
    x, v = np.zeros(n), np.zeros(n)
    sub = int(round(tau / dt))
    out = np.zeros((len(u), 2 * n))
    a = force(x, v, 0.0)
    for t, ut in enumerate(u):
        for _ in range(sub):
            x = x + dt * v + 0.5 * dt * dt * a
            vh = v + 0.5 * dt * a
            a = force(x, vh, s * ut)
            v = vh + 0.5 * dt * a
        if not np.all(np.isfinite(x)):
            raise FloatingPointError(f"diverged at step {t}")
        out[t, :n], out[t, n:] = x, v
    return out


def narma10(u):
    y = np.zeros(len(u))
    for t in range(9, len(u) - 1):
        y[t + 1] = 0.3 * y[t] + 0.05 * y[t] * y[t - 9: t + 1].sum() + 1.5 * u[t - 9] * u[t] + 0.1
    return y


def nrmse(y, yhat):
    return float(np.sqrt(np.mean((y - yhat) ** 2)) / np.std(y))


def split(T, washout=200, train=0.7):
    idx = np.arange(washout, T)
    cut = idx[int(train * len(idx))]
    return idx[idx < cut], idx[idx >= cut]


def narma_score(X, y, shuffle_seed=None):
    """Predict y(t + 1) from the state after input u(t), the usual alignment."""
    X, y = X[:-1], y[1:]
    tr, te = split(len(y))
    yt = y.copy()
    if shuffle_seed is not None:
        yt[tr] = np.random.default_rng(shuffle_seed).permutation(yt[tr])
    return nrmse(y[te], ridge(X[tr], yt[tr], X[te]))


def xor_r2(X, u):
    y = np.roll(u, 1) * np.roll(u, 2)
    tr, te = split(len(u))
    return r2(y[te], ridge(X[tr], y[tr], X[te]))


def input_taps(u, k=10):
    return np.column_stack([np.roll(u, i) for i in range(0, k)])
