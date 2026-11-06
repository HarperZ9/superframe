# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Time reversal in a reverberant 2D cavity: record, reverse, re-emit, and the wave finds its way back.

Scalar wave equation u_tt = c^2 lap u on a grid with rigid walls (u = 0) and a few hard scatterers that make the
cavity chaotic. A pulse from one point is recorded at a few receivers; the recordings, time-reversed, are
re-emitted from the receivers. Known answers (Draeger and Fink 1997): the field refocuses at the source at the
time-reversed instant, with a focal spot near half a wavelength, even from one receiver. Planted control: the
same recordings, each circularly shifted by a random delay, do not refocus.
"""
import numpy as np


def cavity(n=160, seed=0, n_scat=25, r_scat=3):
    rng = np.random.default_rng(seed)
    wall = np.zeros((n, n), bool)
    wall[0, :] = wall[-1, :] = wall[:, 0] = wall[:, -1] = True
    yy, xx = np.mgrid[:n, :n]
    for _ in range(n_scat):
        cy, cx = rng.integers(15, n - 15, 2)
        wall |= (yy - cy) ** 2 + (xx - cx) ** 2 <= r_scat ** 2
    return wall


def ricker(t, f0, t0):
    a = (np.pi * f0 * (t - t0)) ** 2
    return (1 - 2 * a) * np.exp(-a)


def run(wall, sources, signals, steps, record=None, courant=0.5, snapshot=None):
    """Leapfrog FDTD (c = 1, dx = 1). sources: list of (y, x); signals: array (n_src, steps) added to u.
    Returns recordings at `record` points and the snapshots of u at the steps listed in `snapshot`."""
    n = wall.shape[0]
    u0, u1 = np.zeros((n, n)), np.zeros((n, n))
    c2 = courant ** 2
    rec = np.zeros((len(record or []), steps))
    snaps = {}
    for s in range(steps):
        lap = np.zeros_like(u1)
        lap[1:-1, 1:-1] = u1[2:, 1:-1] + u1[:-2, 1:-1] + u1[1:-1, 2:] + u1[1:-1, :-2] - 4 * u1[1:-1, 1:-1]
        u2 = 2 * u1 - u0 + c2 * lap
        for (y, x), sig in zip(sources, signals):
            u2[y, x] += sig[s]
        u2[wall] = 0.0
        u0, u1 = u1, u2
        for i, (y, x) in enumerate(record or []):
            rec[i, s] = u1[y, x]
        if snapshot and s in snapshot:
            snaps[s] = u1.copy()
    return rec, snaps


def experiment(n=160, receivers=1, steps=6000, f0=0.05, seed=0, scramble=False):
    """Forward pass from the source, then time-reversed re-emission. Returns the refocused peak position,
    its contrast (peak |u| at the source over the rms of |u| elsewhere at that instant) and the focal width."""
    wall = cavity(n, seed)
    rng = np.random.default_rng(seed + 7)
    src = (n // 2 + 7, n // 2 - 11)
    free = np.argwhere(~wall)
    rcv = [tuple(free[i]) for i in rng.choice(len(free), receivers, replace=False)]
    t = np.arange(steps) * 0.5
    t0 = 1.5 / f0
    pulse = ricker(t, f0, t0)
    rec, _ = run(wall, [src], [pulse], steps, record=rcv)
    back = rec[:, ::-1].copy()
    if scramble:
        back = np.stack([np.roll(b, rng.integers(steps // 4, 3 * steps // 4)) for b in back])
    t_focus = steps - 1 - int(round(t0 / 0.5))
    _, snaps = run(wall, rcv, back, steps, snapshot={t_focus})
    u = np.abs(snaps[t_focus])
    u[wall] = 0
    peak = np.unravel_index(np.argmax(u), u.shape)
    mask = np.ones_like(u, bool)
    mask[max(src[0] - 6, 0):src[0] + 7, max(src[1] - 6, 0):src[1] + 7] = False
    mask &= ~wall
    contrast = float(u[src] / np.sqrt(np.mean(u[mask] ** 2)))
    line = u[src[0], src[1] - 15:src[1] + 16]
    above = np.flatnonzero(line >= line.max() / 2)
    wavelength = 1.0 / f0  # c = 1 cell per unit time, so the Ricker peak frequency f0 has wavelength 1 / f0 cells
    return {"source": src, "peak": tuple(int(p) for p in peak), "hit": bool(np.hypot(*(np.subtract(peak, src))) <= 2),
            "contrast": contrast, "fwhm_wavelengths": float((above[-1] - above[0] + 1) / wavelength),
            "field": u, "wall": wall}
