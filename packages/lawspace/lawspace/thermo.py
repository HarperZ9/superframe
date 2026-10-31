# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 6: the laws of thermodynamics as switchable toy worlds. Units: k_B = 1.

zeroth   three bodies with heat capacities and pairwise couplings (Newtonian conduction).
first    energy ledgers live in orbits.leapfrog (leak knob) and lake.simulate (leak knob).
second   a soft-disk gas in a box: coarse-grained entropy, velocity reversal (Loschmidt), noise.
         Szilard engine and Landauer erasure ledger. Maxwell's demon with a record of its decisions.
third    two-level system and Einstein solid; a ground-state degeneracy knob breaks S(0) = 0.
"""
import numpy as np


# zeroth law -----------------------------------------------------------------------------------------
def three_bodies(T0, C, k12, k23, k13, t_end=50.0, dt=0.01):
    T = np.array(T0, float)
    C = np.array(C, float)
    K = np.array([[0, k12, k13], [k12, 0, k23], [k13, k23, 0]], float)
    hist = [T.copy()]
    for _ in range(int(t_end / dt)):
        q = (K * (T[None, :] - T[:, None])).sum(axis=1)  # heat into each body
        T = T + dt * q / C
        hist.append(T.copy())
    return np.array(hist)


# second law: soft-disk gas --------------------------------------------------------------------------
def gas_init(n, rng, sigma=0.05, half=True):
    """Positions on a jittered grid in the left half (or the whole box), Maxwell velocities, T = 1."""
    m = int(np.ceil(np.sqrt(n)))
    g = (np.indices((m, m)).reshape(2, -1).T + 0.5) / m
    g = g[rng.permutation(len(g))[:n]]
    x = np.c_[g[:, 0] * (0.5 if half else 1.0), g[:, 1]]
    v = rng.standard_normal((n, 2))
    v -= v.mean(axis=0)
    return x, v


def _forces(x, sigma, eps=50.0):
    d = x[:, None, :] - x[None, :, :]
    r = np.sqrt((d ** 2).sum(-1)) + np.eye(len(x))
    over = np.clip(sigma - r, 0, None)
    f = (2 * eps * over / sigma ** 2 / r)[:, :, None] * d
    return f.sum(axis=1)


def gas_run(x, v, steps, dt=0.002, sigma=0.05, record=20):
    """Velocity Verlet with specular walls (time reversible). Returns final x, v and entropy series."""
    x, v = x.copy(), v.copy()
    f = _forces(x, sigma)
    ent = []
    for s in range(steps):
        v = v + 0.5 * dt * f
        x = x + dt * v
        for ax in (0, 1):
            lo, hi = x[:, ax] < 0, x[:, ax] > 1
            x[lo, ax] = -x[lo, ax]
            x[hi, ax] = 2 - x[hi, ax]
            v[lo | hi, ax] = -v[lo | hi, ax]
        f = _forces(x, sigma)
        v = v + 0.5 * dt * f
        if s % record == 0:
            ent.append(coarse_entropy(x))
    return x, v, np.array(ent)


def coarse_entropy(x, cells=4):
    """Shannon entropy (nats) of the occupation of a cells x cells grid; maximum ln(cells^2)."""
    i = np.clip((x * cells).astype(int), 0, cells - 1)
    counts = np.bincount(i[:, 0] * cells + i[:, 1], minlength=cells * cells)
    p = counts[counts > 0] / len(x)
    return float(-(p * np.log(p)).sum())


def loschmidt(n, steps, noise, rng, dt=0.002):
    """Run forward, reverse every velocity (plus relative Gaussian noise), run back. Returns the mean
    distance of each particle from its start, and the entropy at the start, the turn and the end."""
    x0, v0 = gas_init(n, rng)
    x1, v1, e1 = gas_run(x0, v0, steps, dt)
    vr = -v1 * (1 + noise * rng.standard_normal(v1.shape))
    x2, _, e2 = gas_run(x1, vr, steps, dt)
    return (float(np.sqrt(((x2 - x0) ** 2).sum(1)).mean()), coarse_entropy(x0), coarse_entropy(x1),
            coarse_entropy(x2))


# second law: Szilard and Landauer -------------------------------------------------------------------
def szilard_ledger(T=1.0, error=0.0, grid=20001):
    """One-molecule engine. Isothermal expansion work from V/2 to V by quadrature of p = T / V gives
    T ln 2 when the side is known. With measurement error e the best extractable work is
    T (ln 2 - H(e)) (Sagawa-Ueda); erasing the one-bit record costs at least T ln 2 (Landauer)."""
    V = np.linspace(0.5, 1.0, grid)
    w_ideal = float(np.trapezoid(T / V, V))
    He = 0.0 if error <= 0 or error >= 1 else -(error * np.log(error) + (1 - error) * np.log(1 - error))
    w = T * (np.log(2) - He)
    erase = T * np.log(2)
    return {"work_known_side": w_ideal, "work_with_error": w, "erase_min": erase, "net_max": w - erase}


# second law: Maxwell's demon ------------------------------------------------------------------------
def demon(n, steps, bias, rng, dt=0.002, v_thr=None):
    """Ideal 2-D gas in two chambers split at x = 0.5. Each partition hit is one demon decision. With
    probability `bias` the demon sorts (fast left-to-right and slow right-to-left pass); otherwise the
    door opens at random with probability 1/2. Returns the gas entropy change (re-equilibrated on each
    side, Maxwell form) and the Shannon entropy of the decision record (nats, i.i.d. estimate)."""
    x = rng.random((n, 2))
    v = rng.standard_normal((n, 2))
    v_thr = np.sqrt(2 * np.log(2)) if v_thr is None else v_thr  # median speed of a 2-D Maxwell gas, T 1
    S0 = _two_box_entropy(x, v)
    decisions = []
    for _ in range(steps):
        xn = x + dt * v
        hit = (x[:, 0] - 0.5) * (xn[:, 0] - 0.5) < 0
        if hit.any():
            sp = np.hypot(v[hit, 0], v[hit, 1])
            left = x[hit, 0] < 0.5
            want = np.where(left, sp > v_thr, sp < v_thr)
            sort = rng.random(hit.sum()) < bias
            open_ = np.where(sort, want, rng.random(hit.sum()) < 0.5)
            decisions.extend(open_.tolist())
            idx = np.where(hit)[0][~open_]
            v[idx, 0] = -v[idx, 0]
            xn[idx] = x[idx]
        x = xn
        for ax in (0, 1):
            out = (x[:, ax] < 0) | (x[:, ax] > 1)
            v[out, ax] = -v[out, ax]
            x[:, ax] = np.clip(x[:, ax], 0, 1)
    d = np.array(decisions, bool)
    p = d.mean() if len(d) else 0.5
    h = 0.0 if p in (0, 1) else -(p * np.log(p) + (1 - p) * np.log(1 - p))
    return {"dS_gas": _two_box_entropy(x, v) - S0, "record_nats": h * len(d), "decisions": len(d),
            "T_left": _side_T(x, v, True), "T_right": _side_T(x, v, False)}


def _side_T(x, v, left):
    m = (x[:, 0] < 0.5) == left
    return float((v[m] ** 2).sum() / max(2 * m.sum(), 1))


def _two_box_entropy(x, v):
    """Sum over sides of N ln(V / N) + N ln(E / N) (2-D ideal gas, constants dropped, V = 1/2 each)."""
    S = 0.0
    for left in (True, False):
        m = (x[:, 0] < 0.5) == left
        N = m.sum()
        if N:
            E = 0.5 * (v[m] ** 2).sum()
            S += N * np.log(0.5 / N) + N * np.log(E / N)
    return float(S)


# third law ------------------------------------------------------------------------------------------
def two_level(T, gap=1.0, g0=1, g1=1):
    """Closed forms for levels 0 and gap with degeneracies g0, g1: entropy S and heat capacity C."""
    T = np.asarray(T, float)
    x = gap / T
    w = (g1 / g0) * np.exp(-x)
    S = np.log(g0) + np.log1p(w) + x * w / (1 + w)
    C = x ** 2 * w / (1 + w) ** 2
    return S, C


def einstein(T, theta=1.0):
    """Per oscillator (1-D, multiply by 3N): S and C in units of k_B."""
    x = theta / np.asarray(T, float)
    S = x / np.expm1(x) - np.log1p(-np.exp(-x))
    C = x ** 2 * np.exp(x) / np.expm1(x) ** 2
    return S, C


def from_levels(T, energies, degeneracy):
    """Numerical S and C from a list of levels (no closed form): the check on the closed forms."""
    T = np.atleast_1d(np.asarray(T, float))
    E = np.asarray(energies, float)[None, :]
    g = np.asarray(degeneracy, float)[None, :]
    b = 1.0 / T[:, None]
    w = g * np.exp(-b * (E - E.min()))
    Z = w.sum(1)
    U = (w * E).sum(1) / Z
    U2 = (w * E ** 2).sum(1) / Z
    S = np.log(Z) + (U - E.min()) / T
    return S, (U2 - U ** 2) / T ** 2
