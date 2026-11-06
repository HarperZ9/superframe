# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Computing with a vibrating medium: a mass-spring chain as a physical reservoir with a linear readout.

The chain (n masses, nearest-neighbour springs k1 x + k2 x^2 + k3 x^3, damping g, fixed ends) is driven at mass 0 by a
force s * u(t), held for tau per input step; the readout is the displacement and velocity of every mass at the
end of each step, fitted by ridge regression on a training stretch and scored on a held-out stretch.

Measures. Linear memory capacity MC = sum_k r^2(u(t-k), y_k(t)) (Jaeger 2001), each r^2 on held-out data and
zeroed below a shuffled-target floor: the largest of 200 shuffles, taken separately for single and product
targets, so a sum over many targets does not collect chance passes. Quadratic capacity: the same sum for the
products u(t-i) u(t-j). XOR for binary inputs: the target u(t-1) u(t-2).
Known answers. A linear medium with a linear readout has zero quadratic capacity and XOR r2 near zero (sign
accuracy at most 3/4), however strong the drive, and MC cannot exceed the number of readout features. A spring law
with only odd powers (k1, k3) keeps the response odd in the input and cannot make products of two inputs; the even
term k2 can. Planted controls: shuffled targets, and the input taps themselves as the only features.
"""
import numpy as np


def simulate(u, n=24, k1=1.0, k2=0.0, k3=0.0, g=0.02, s=1.0, tau=6.0, dt=0.05, seed=0):
    """Velocity-Verlet integration; returns features (len(u), 2n)."""
    rng = np.random.default_rng(seed)
    m = 1.0 + 0.3 * rng.random(n)  # unequal masses spread the modes and break degeneracies
    x, v = np.zeros(n), np.zeros(n)
    sub = int(round(tau / dt))

    def force(x, v, drive):
        d = np.diff(np.concatenate([[0.0], x, [0.0]]))  # extensions of the n + 1 springs
        f_s = k1 * d + k2 * d ** 2 + k3 * d ** 3
        f = f_s[1:] - f_s[:-1] - g * v * m
        f[0] += drive
        return f / m
    out = np.zeros((len(u), 2 * n))
    a = force(x, v, 0.0)
    for t, ut in enumerate(u):
        for _ in range(sub):
            x = x + dt * v + 0.5 * dt * dt * a
            v_half = v + 0.5 * dt * a
            a = force(x, v_half, s * ut)
            v = v_half + 0.5 * dt * a
        out[t, :n], out[t, n:] = x, v
    return out


def ridge(Xtr, ytr, Xte, lam=1e-6):
    mu, sd = Xtr.mean(0), Xtr.std(0) + 1e-12
    A, B = (Xtr - mu) / sd, (Xte - mu) / sd
    A1 = np.column_stack([A, np.ones(len(A))])
    B1 = np.column_stack([B, np.ones(len(B))])
    w = np.linalg.solve(A1.T @ A1 + lam * len(A) * np.eye(A1.shape[1]), A1.T @ ytr)
    return B1 @ w


def r2(y, yhat):
    c = np.corrcoef(y, yhat)[0, 1]
    return 0.0 if not np.isfinite(c) else float(c * c)


def capacities(X, u, washout=200, train=0.7, kmax=40, quad_max=6, seed=0, shuffle=False):
    """Held-out linear memory capacity, quadratic capacity, and the floor from shuffled targets."""
    rng = np.random.default_rng(seed)
    T = len(u)
    idx = np.arange(washout + kmax, T)
    cut = idx[int(train * len(idx))]
    tr, te = idx[idx < cut], idx[idx >= cut]

    def score(target):
        y = target.copy()
        if shuffle:
            y[tr] = rng.permutation(y[tr])
        return r2(y[te], ridge(X[tr], y[tr], X[te]))
    def floor_of(target):
        return np.quantile([r2(rng.permutation(target[te]), ridge(X[tr], target[tr], X[te])) for _ in range(200)], 1.0)
    floor = floor_of(u)
    floor_q = floor_of(np.roll(u, 1) * np.roll(u, 2))
    lin = [score(np.roll(u, k)) for k in range(1, kmax + 1)]
    quad = [score(np.roll(u, i) * np.roll(u, j)) for i in range(1, quad_max + 1) for j in range(i + 1, quad_max + 1)]
    keep = (lambda v, fl: [x if x > fl else 0.0 for x in v])
    return {"mc": float(sum(keep(lin, floor))), "qc": float(sum(keep(quad, floor_q))), "lin": lin, "quad": quad,
            "floor": float(floor), "floor_quad": float(floor_q)}


def xor_score(X, u, washout=200, train=0.7):
    """Binary input u in {-1, 1}, target u(t-1) u(t-2) (XOR in sign form), linear readout, held-out data.
    Returns r2 of the target and the sign accuracy. A linear separator can reach 3/4 on XOR's four points and
    no more, so a linear feature set sits at r2 near 0 with accuracy up to 0.75; solving XOR means accuracy
    near 1."""
    T = len(u)
    y = np.roll(u, 1) * np.roll(u, 2)
    idx = np.arange(washout, T)
    cut = idx[int(train * len(idx))]
    tr, te = idx[idx < cut], idx[idx >= cut]
    yhat = ridge(X[tr], y[tr], X[te])
    return {"r2": r2(y[te], yhat), "acc": float(np.mean(np.sign(yhat) == y[te]))}


def taps(u, k=6):
    """Control features: the last k inputs themselves (perfect short memory, no nonlinearity)."""
    return np.column_stack([np.roll(u, i) for i in range(1, k + 1)])


def regime(name):
    """The study's preregistered regimes: drive scale s (brute force), cubic stiffness k3, damping g (finesse)."""
    return {"linear": dict(s=0.05, k3=0.0, g=0.02), "linear_loud": dict(s=5.0, k3=0.0, g=0.02),
            "nonlinear": dict(s=1.5, k3=1.0, g=0.02), "nonlinear_quiet": dict(s=0.05, k3=1.0, g=0.02),
            "resonant": dict(s=0.05, k3=0.0, g=0.002), "resonant_nonlinear": dict(s=1.5, k3=1.0, g=0.002),
            "lossy": dict(s=0.05, k3=0.0, g=0.2), "asymmetric": dict(s=0.5, k2=1.0, k3=1.0, g=0.02),
            "asymmetric_resonant": dict(s=0.5, k2=1.0, k3=1.0, g=0.002)}[name]
