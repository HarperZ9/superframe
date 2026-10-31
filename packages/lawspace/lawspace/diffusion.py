# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 4: anomalous diffusion, MSD ~ t^alpha, and mixing at a fresh/salt interface.

alpha < 1: continuous-time random walk with Pareto waiting times (tail exponent alpha), unit Gaussian
           jumps; the propagator is cusped and non-Gaussian.
alpha = 1: Brownian walk.
alpha > 1: Levy walk at unit speed with Pareto flight durations (tail exponent g = 3 - alpha, 1 < g < 2).
Transplant: `polar=True` gives each tracer a polarization angle. A birefringent medium resolves each
tracer onto its fast axis (angle 0) with probability cos^2(theta) or its slow axis otherwise (Malus),
with step scales s_fast and s_slow; a polarizer at x = 0 with axis phi passes a crossing tracer with
probability cos^2(theta - phi) and sets theta = phi, and reflects it otherwise.
"""
import numpy as np


def positions(alpha, n, times, rng, x0=None):
    """Tracer positions at each requested time (array times). x0: starting positions (default 0)."""
    x0 = np.zeros(n) if x0 is None else np.asarray(x0, float)
    if abs(alpha - 1.0) < 1e-9:
        return _brownian(x0, times, rng)
    if alpha < 1.0:
        return _ctrw(alpha, x0, times, rng)
    return _levy_walk(alpha, x0, times, rng)


def _brownian(x0, times, rng):
    out, x, t_prev = [], x0.copy(), 0.0
    for t in times:
        x = x + np.sqrt(2 * (t - t_prev)) * rng.standard_normal(len(x))
        out.append(x.copy())
        t_prev = t
    return np.array(out)


def _pareto(a, size, rng):
    return (1.0 - rng.random(size)) ** (-1.0 / a)  # minimum 1, tail exponent a


def _ctrw(alpha, x0, times, rng):
    n = len(x0)
    x, clock = x0.copy(), _pareto(alpha, n, rng)
    out = []
    for t in times:
        live = clock <= t
        while live.any():
            x[live] += np.sqrt(2.0) * rng.standard_normal(live.sum())
            clock[live] += _pareto(alpha, live.sum(), rng)
            live = clock <= t
        out.append(x.copy())
    return np.array(out)


def _levy_walk(alpha, x0, times, rng):
    g = 3.0 - alpha
    n = len(x0)
    x, t_cur = x0.copy(), np.zeros(n)
    d = _pareto(g, n, rng)
    v = rng.choice([-1.0, 1.0], n)
    out = []
    for t in times:
        end = t_cur + d
        done = end <= t
        while done.any():
            x[done] += v[done] * d[done]
            t_cur[done] = end[done]
            d[done] = _pareto(g, done.sum(), rng)
            v[done] = rng.choice([-1.0, 1.0], done.sum())
            end = t_cur + d
            done = end <= t
        out.append(x + v * (t - t_cur))
    return np.array(out)


def msd_exponent(alpha, rng, n=20000, times=None):
    times = np.geomspace(10, 1000, 12) if times is None else times
    X = positions(alpha, n, times, rng)
    msd = (X ** 2).mean(axis=1)
    slope = np.polyfit(np.log(times), np.log(msd), 1)[0]
    kurt = (X[-1] ** 4).mean() / (X[-1] ** 2).mean() ** 2
    return float(slope), float(kurt), msd


def mixing_width(alpha, rng, n=20000, times=None, lo=0.1, hi=0.9, L=None):
    """Fresh (x < 0) and salt (x > 0) tracers start uniform on [-L, L]; salinity at x is the salt share.
    The mixing zone is the span of x where salinity lies in [lo, hi]. Returns times and widths."""
    times = np.geomspace(10, 1000, 10) if times is None else times
    L = L or 4 * np.sqrt(2 * times[-1]) ** max(alpha, 1.0)
    x0 = rng.uniform(-L, L, n)
    salt = x0 > 0
    X = positions(alpha, n, times, rng, x0=x0)
    widths = [_zone(X[i], salt, lo, hi, L) for i in range(len(times))]
    return times, np.array(widths)


def _zone(x, salt, lo, hi, L, bins=200):
    edges = np.linspace(-L / 2, L / 2, bins + 1)
    a, _ = np.histogram(x[salt], edges)
    b, _ = np.histogram(x[~salt], edges)
    s = a / np.maximum(a + b, 1)
    c = 0.5 * (edges[1:] + edges[:-1])
    inside = (s >= lo) & (s <= hi)
    return float(c[inside].max() - c[inside].min()) if inside.sum() > 1 else 0.0


def polar_walk(n, steps, rng, s_fast=1.0, s_slow=0.3, phi=None, theta0=None, polar=True):
    """Brownian tracers from x < 0 toward a polarizer at x = 0. Returns final x, theta and the fraction
    that crossed. polar=False is the untransplanted control (no state, scale (s_fast + s_slow) / 2, no
    filter)."""
    x = -rng.uniform(0, 20, n)
    th = rng.uniform(0, np.pi, n) if theta0 is None else np.full(n, theta0)
    if not polar:
        s = 0.5 * (s_fast + s_slow)
        for _ in range(steps):
            x = x + s * rng.standard_normal(n)
        return x, th, float((x > 0).mean())
    fast = rng.random(n) < np.cos(th) ** 2
    th = np.where(fast, 0.0, np.pi / 2)
    for _ in range(steps):
        new = x + np.where(np.abs(np.cos(th)) > 0.5, s_fast, s_slow) * rng.standard_normal(n)
        cross = (x < 0) & (new >= 0) if phi is not None else np.zeros(n, bool)
        if cross.any():
            ok = rng.random(cross.sum()) < np.cos(th[cross] - phi) ** 2
            idx = np.where(cross)[0]
            th[idx[ok]] = phi
            new[idx[~ok]] = -new[idx[~ok]]
            # after the polarizer the tracer meets the birefringent medium again
            f2 = rng.random(ok.sum()) < np.cos(th[idx[ok]]) ** 2
            th[idx[ok]] = np.where(f2, 0.0, np.pi / 2)
        x = new
    return x, th, float((x > 0).mean())
