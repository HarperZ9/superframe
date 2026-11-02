# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 1: central force F = -k r^-n in a plane, and the d-dimensional Gauss-law line n = d - 1.

Units are dimensionless: mass 1, k 1, circular radius 1. A single particle in a central force moves in a
plane whatever the number of spatial dimensions, so d enters only through the force exponent (Gauss's
law gives n = d - 1). The apsidal angle psi is the angle swept from periapsis to apoapsis; an orbit
closes for every bound start only when psi / pi is one fixed rational for all amplitudes.
"""
import numpy as np

_GL = {}


def _gauss_legendre(m):
    if m not in _GL:
        _GL[m] = np.polynomial.legendre.leggauss(m)
    return _GL[m]


def potential(r, n, k=1.0):
    """V with V' = k r^-n (attractive). n = 1 is the logarithm."""
    if abs(n - 1.0) < 1e-12:
        return k * np.log(r)
    return k * r ** (1.0 - n) / (1.0 - n)


def turning_state(n, e, r0=1.0):
    """Angular momentum squared and energy for an orbit with r_min = r0 (1 - e), r_max = r0 (1 + e)."""
    a, b = r0 * (1 - e), r0 * (1 + e)
    L2 = 2.0 * (potential(b, n) - potential(a, n)) / (1.0 / a ** 2 - 1.0 / b ** 2)
    return L2, potential(a, n) + L2 / (2 * a * a)


def apsidal_angle(n, e, m=200):
    """psi by quadrature in u = 1/r with u = c + h sin(theta), which removes both endpoint singularities."""
    if e < 1e-9:
        return np.pi / np.sqrt(3.0 - n)
    L2, E = turning_state(n, e)
    ua, ub = 1.0 / (1 - e), 1.0 / (1 + e)
    c, h = 0.5 * (ua + ub), 0.5 * (ua - ub)
    x, w = _gauss_legendre(m)
    th = 0.5 * np.pi * x
    u = c + h * np.sin(th)
    q = 2.0 * (E - potential(1.0 / u, n)) - L2 * u * u
    q = np.maximum(q, 1e-300)
    g = np.sqrt(L2) * h * np.cos(th) / np.sqrt(q)
    return float(0.5 * np.pi * np.sum(w * g))


def precession_near_circular(n):
    """Closed form in 3-D language: delta phi per radial period = 2 pi (1 / sqrt(3 - n) - 1)."""
    return 2 * np.pi * (1.0 / np.sqrt(3.0 - n) - 1.0)


def closure_spread(n, amps=(0.05, 0.2, 0.4, 0.6)):
    """(max psi - min psi) / pi over amplitudes: zero means the apsidal angle does not depend on amplitude."""
    ps = [apsidal_angle(n, e) for e in amps]
    return (max(ps) - min(ps)) / np.pi


def radial_rhs(n, L2):
    return lambda r: L2 / r ** 3 - r ** (-n)


def stays_bound(n, delta=0.01, t_end=200.0, dt=0.01, lo=0.5, hi=2.0):
    """Perturbed circular orbit (r = 1 + delta, L^2 = 1) integrated by RK4 in r; bound if r stays in [lo, hi]."""
    f = radial_rhs(n, 1.0)
    r, v = 1.0 + delta, 0.0
    for _ in range(int(t_end / dt)):
        k1r, k1v = v, f(r)
        k2r, k2v = v + 0.5 * dt * k1v, f(r + 0.5 * dt * k1r)
        k3r, k3v = v + 0.5 * dt * k2v, f(r + 0.5 * dt * k2r)
        k4r, k4v = v + dt * k3v, f(r + dt * k3r)
        r += dt / 6 * (k1r + 2 * k2r + 2 * k3r + k4r)
        v += dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
        if not (lo < r < hi):
            return False
    return True


def leapfrog(n, e=0.3, steps=20000, dt=0.002, leak=0.0, temp=0.0, gamma=0.05, rng=None):
    """2-D orbit by velocity Verlet from periapsis. leak scales the velocity by (1 + leak) each step (breaks
    the first law); temp adds Langevin noise at that temperature with friction gamma (the noise transplant).
    Returns x, y (every 10th step) and the energy series."""
    L2, _ = turning_state(n, e)
    pos = np.array([1 - e, 0.0])
    vel = np.array([0.0, np.sqrt(L2) / (1 - e)])
    acc = _acc(pos, n)
    xs, es = [], []
    kick = np.sqrt(2 * gamma * temp * dt) if temp > 0 else 0.0
    for i in range(steps):
        vel = vel + 0.5 * dt * acc
        pos = pos + dt * vel
        acc = _acc(pos, n)
        vel = vel + 0.5 * dt * acc
        if leak:
            vel = vel * (1.0 + leak)
        if kick:
            vel = vel * (1 - gamma * dt) + kick * rng.standard_normal(2)
        if i % 10 == 0:
            r = np.hypot(*pos)
            xs.append(pos.copy())
            es.append(0.5 * vel @ vel + potential(r, n))
            if r > 50 or r < 1e-3:
                break
    return np.array(xs), np.array(es)


def _acc(pos, n):
    r = np.hypot(*pos)
    return -pos * r ** (-n - 1)


def apsidal_from_path(xy):
    """Mean apsidal angle measured from a sampled path: angle between successive radius extrema."""
    r = np.hypot(xy[:, 0], xy[:, 1])
    ph = np.unwrap(np.arctan2(xy[:, 1], xy[:, 0]))
    ext = [i for i in range(1, len(r) - 1) if (r[i] - r[i - 1]) * (r[i + 1] - r[i]) < 0]
    if len(ext) < 3:
        return float("nan"), float("nan")
    d = np.abs(np.diff(ph[ext]))
    return float(d.mean()), float(d.std())
