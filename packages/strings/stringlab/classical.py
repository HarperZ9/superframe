# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The classical relativistic open string (Nambu-Goto in conformal and light-cone gauge).

Transverse coordinates X^i(sigma, tau), sigma in [0, pi], obey the free wave equation with Neumann ends.
The mode expansion (p^i = 0) is
    X^i = i sqrt(2 alpha') sum_{n != 0} (alpha^i_n / n) e^{-i n tau} cos(n sigma),  alpha_{-n} = conj(alpha_n).
The constraints fix X^- (light-cone gauge X^+ = 2 alpha' p^+ tau) and give the mass
    M^2 = 2 p^+ p^- = 1/(4 pi alpha'^2) int_0^pi (Xdot^2 + X'^2) d sigma,
and the angular momentum in the 1-2 plane is J = 1/(2 pi alpha') int_0^pi (X^1 Xdot^2 - X^2 Xdot^1) d sigma.
Planted truths: the lattice spectrum tends to omega_n = n; M^2 = (1/alpha') sum_{n>=1} |alpha_n|^2 summed over
i (the classical level); the rigidly rotating rod (only n = 1, circular) has J = alpha' M^2 exactly, and every
other solution has J < alpha' M^2 (the classical Regge bound).
"""
import numpy as np


def lattice_frequencies(n_sites, count=5):
    """Normal-mode frequencies of the Neumann wave equation on n_sites points of [0, pi] (cell-centred)."""
    h = np.pi / n_sites
    lap = np.zeros((n_sites, n_sites))
    for i in range(n_sites):
        lap[i, i] = -2.0
        if i > 0:
            lap[i, i - 1] = 1.0
        if i < n_sites - 1:
            lap[i, i + 1] = 1.0
    lap[0, 0] = lap[-1, -1] = -1.0  # Neumann ghost cells
    w2 = np.sort(-np.linalg.eigvalsh(lap / h ** 2))
    return np.sqrt(np.clip(w2[1:count + 1], 0, None))


def richardson_frequencies(sizes=(64, 128, 256), count=5):
    """Second-order lattice error removed by Richardson extrapolation on doubling grids."""
    w = [lattice_frequencies(n, count) for n in sizes]
    r1 = [(4 * b - a) / 3 for a, b in zip(w[:-1], w[1:])]
    return (16 * r1[-1] - r1[-2]) / 15 if len(r1) > 1 else r1[-1]


def random_modes(rng, n_modes=4, dims=2, scale=1.0):
    """alpha^i_n for n = 1..n_modes, complex Gaussian with amplitude falling as 1/n."""
    a = (rng.normal(size=(dims, n_modes)) + 1j * rng.normal(size=(dims, n_modes)))
    return scale * a / np.arange(1, n_modes + 1)[None, :]


def rod_modes(amplitude, dims=2):
    """The rotating rod X^1 = A cos tau cos sigma, X^2 = A sin tau cos sigma, as alpha^i_1."""
    a = np.zeros((dims, 1), dtype=complex)
    # X^i = i sqrt(2a') (alpha_1 e^{-i tau} - conj(alpha_1) e^{i tau}) cos sigma = -2 sqrt(2a') Im(alpha_1 e^{-i tau}) cos sigma
    # choose alpha^1_1 = i A / (2 sqrt(2a')) and alpha^2_1 = -A / (2 sqrt(2a')) with a' set in fields()
    a[0, 0] = 1j * amplitude
    a[1, 0] = -amplitude
    return a


def fields(modes, sigma, tau, alpha_p=0.5):
    """X, Xdot, X' on the grid (dims, len(sigma)) at time tau, from the mode amplitudes."""
    dims, nm = modes.shape
    n = np.arange(1, nm + 1)[:, None]
    ph = np.exp(-1j * n * tau)
    c, s = np.cos(n * sigma[None, :]), np.sin(n * sigma[None, :])
    k = np.sqrt(2 * alpha_p)
    X = np.zeros((dims, sigma.size))
    Xd = np.zeros_like(X)
    Xp = np.zeros_like(X)
    for i in range(dims):
        z = modes[i][:, None] * ph
        X[i] = (k * 2 * np.real(1j * z / n * c)).sum(0)
        Xd[i] = (k * 2 * np.real(z * c)).sum(0)
        Xp[i] = (k * 2 * np.real(-1j * z * s)).sum(0)
    return X, Xd, Xp


def _simpson(y, x):
    h = x[1] - x[0]
    return h / 3 * (y[0] + y[-1] + 4 * y[1:-1:2].sum() + 2 * y[2:-1:2].sum())


def observables(modes, tau=0.0, alpha_p=0.5, n_grid=2049):
    """M^2, J and the classical level from the fields on a grid (Simpson's rule)."""
    sigma = np.linspace(0, np.pi, n_grid)
    X, Xd, Xp = fields(modes, sigma, tau, alpha_p)
    m2 = _simpson((Xd ** 2 + Xp ** 2).sum(0), sigma) / (4 * np.pi * alpha_p ** 2)
    j = _simpson(X[0] * Xd[1] - X[1] * Xd[0], sigma) / (2 * np.pi * alpha_p) if modes.shape[0] >= 2 else 0.0
    level = (np.abs(modes) ** 2).sum()  # classical level: sum over i and n >= 1 of alpha^i_{-n} alpha^i_n
    return {"M2": float(m2), "J": float(j), "M2_from_modes": float(level / alpha_p), "alpha_p": alpha_p}


def evolve_lattice(modes, alpha_p=0.5, n_sites=512, periods=1.0, steps_per_unit=2048):
    """Leapfrog the discretised wave equation from the mode initial data; returns drift of M^2 and J and
    the largest pointwise deviation from the exact solution after the run."""
    h = np.pi / n_sites
    sigma = (np.arange(n_sites) + 0.5) * h
    X, Xd, _ = fields(modes, sigma, 0.0, alpha_p)
    dt = 1.0 / steps_per_unit
    t_end = 2 * np.pi * periods
    nsteps = int(round(t_end / dt))
    dt = t_end / nsteps

    def lap(Y):
        Yp = np.concatenate([Y[:, :1], Y, Y[:, -1:]], axis=1)
        return (Yp[:, 2:] - 2 * Yp[:, 1:-1] + Yp[:, :-2]) / h ** 2

    def obs(Y, V):
        Yp = np.diff(np.concatenate([Y[:, :1], Y, Y[:, -1:]], axis=1), axis=1) / h
        Yp = 0.5 * (Yp[:, 1:] + Yp[:, :-1])
        m2 = h * (V ** 2 + Yp ** 2).sum() / (4 * np.pi * alpha_p ** 2)
        j = h * (Y[0] * V[1] - Y[1] * V[0]).sum() / (2 * np.pi * alpha_p)
        return m2, j

    V = Xd.copy()
    m20, j0 = obs(X, V)
    V = V + 0.5 * dt * lap(X)
    for _ in range(nsteps):
        X = X + dt * V
        V = V + dt * lap(X)
    V = V - 0.5 * dt * lap(X)
    m21, j1 = obs(X, V)
    Xex, _, _ = fields(modes, sigma, t_end, alpha_p)
    return {"M2_drift": float(abs(m21 - m20) / m20), "J_drift": float(abs(j1 - j0) / max(abs(j0), 1e-300)),
            "max_dev": float(np.abs(X - Xex).max() / np.abs(Xex).max()), "steps": nsteps}


def regge_scan(rng, n_random=200, alpha_p=0.5):
    """J / (alpha' M^2) for rods of several sizes and for random solutions."""
    rods = []
    for amp in (0.25, 0.5, 1.0, 2.0, 4.0):
        o = observables(rod_modes(amp), alpha_p=alpha_p)
        rods.append({"amp": amp, "M2": o["M2"], "J": o["J"], "ratio": o["J"] / (alpha_p * o["M2"])})
    ratios = []
    for _ in range(n_random):
        md = random_modes(rng, n_modes=int(rng.integers(1, 6)))
        o = observables(md, alpha_p=alpha_p)
        ratios.append(abs(o["J"]) / (alpha_p * o["M2"]))
    return {"rods": rods, "random_ratios": ratios}
