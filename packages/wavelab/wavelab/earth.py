# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Planetary scale: the free oscillations of the Earth computed from PREM by radial shooting.

Spheroidal modes solve the six first-order equations of a self-gravitating, non-rotating, isotropic Earth
(U, R radial displacement and stress; V, S tangential; P potential; B = P' + 4 pi G rho U), reduced to four in
the fluid outer core where V is algebraic. Toroidal modes solve two equations in the mantle. PREM is tabulated
at 1 s; moduli are moved to the mode period with the constant-Q dispersion of Liu, Anderson and Kanamori
(1976). The anisotropic upper mantle enters as its Voigt average. Known answers: Masters and Widmer's observed
and PREM frequencies for 0S0, 0S2, 0S3, 0S4, 0T2 and 0T3. Planted errors: the Cowling approximation (no
potential perturbation) and the 1 s moduli without dispersion must both miss.
"""
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

from . import consts


class Prem:
    """PREM layers: each a list of (r, rho, kappa, mu, qkappa, qmu) between discontinuities."""

    def __init__(self, period=None, dispersion=True):
        cols = consts.media()["prem"]["columns"]
        a = np.array(consts.media()["prem"]["rows"], float)
        c = {k: a[:, i] for i, k in enumerate(cols)}
        A, C, L, N = (c["rho"] * c[k] ** 2 for k in ("vph", "vpv", "vsv", "vsh"))
        F = c["eta"] * (A - 2 * L)
        kappa = (4 * A + C + 4 * F - 4 * N) / 9
        mu = (A + C - 2 * F + 5 * N + 6 * L) / 15
        if dispersion and period:
            lnr = np.log(period / 1.0) * 2 / np.pi
            qmu = np.where(c["qmu"] > 0, c["qmu"], np.inf)  # fluid layers carry qmu = 0 and mu = 0
            mu = mu * (1 - lnr / qmu)
            kappa = kappa * (1 - lnr / c["qkappa"])
        self.r, self.rho, self.kappa, self.mu = c["r_m"], c["rho"], kappa, mu
        self.a = float(self.r[-1])
        cuts = np.flatnonzero(np.diff(self.r) == 0)
        self.layers = np.split(np.arange(len(self.r)), cuts + 1)
        self._gravity()

    def _gravity(self):
        m = np.zeros(len(self.r))
        for k, idx in enumerate(self.layers):
            r, rho = self.r[idx], self.rho[idx]
            start = m[self.layers[k - 1][-1]] if k else 0.0
            seg = np.concatenate([[0.0], np.cumsum(0.5 * (rho[1:] * r[1:] ** 2 + rho[:-1] * r[:-1] ** 2) * np.diff(r))])
            m[idx] = start + 4 * np.pi * seg
        self.mass = m
        self.g = np.where(self.r > 0, consts.G * m / np.where(self.r > 0, self.r, 1) ** 2, 0.0)

    def at(self, layer, r):
        idx = self.layers[layer]
        rr = self.r[idx]
        f = (lambda v: np.interp(r, rr, v[idx]))
        return f(self.rho), f(self.kappa), f(self.mu), f(self.g)

    def solid(self, layer):
        return bool(self.mu[self.layers[layer]].max() > 0)


def _solid_rhs(r, y, prem, layer, w2, k2, cowling):
    U, V, R, S, P, B = y
    rho, kap, mu, g = prem.at(layer, r)
    lam = kap - 2 * mu / 3
    beta = lam + 2 * mu
    X = 2 * U - k2 * V
    G4 = 4 * np.pi * consts.G
    dU = (R - lam * X / r) / beta
    dV = S / mu + (V - U) / r
    dR = (-w2 * rho * U - 4 * mu * R / (beta * r) + 2 * mu * (3 * lam + 2 * mu) * X / (beta * r * r) + k2 * S / r
          - 4 * rho * g * U / r + k2 * rho * g * V / r + (0 if cowling else rho * B))
    dS = (-w2 * rho * V - 3 * S / r - lam * R / (beta * r)
          - (2 * lam * mu * X / beta + 2 * mu * U + 2 * mu * V * (1 - k2)) / (r * r) + rho * g * U / r + (0 if cowling else rho * P / r))
    dP = 0 if cowling else B - G4 * rho * U
    dB = 0 if cowling else -2 * B / r + k2 * P / (r * r) + G4 * rho * k2 * V / r
    return [dU, dV, dR, dS, dP, dB]


def _fluid_V(r, U, R, P, prem, layer, w2, cowling):
    rho, _, _, g = prem.at(layer, r)
    return (rho * g * U + (0 if cowling else rho * P) - R) / (w2 * rho * r)


def _fluid_rhs(r, y, prem, layer, w2, k2, cowling):
    U, R, P, B = y
    rho, kap, _, g = prem.at(layer, r)
    V = _fluid_V(r, U, R, P, prem, layer, w2, cowling)
    G4 = 4 * np.pi * consts.G
    dU = R / kap - (2 * U - k2 * V) / r
    dR = -w2 * rho * U - 4 * rho * g * U / r + k2 * rho * g * V / r + (0 if cowling else rho * B)
    dP = 0 if cowling else B - G4 * rho * U
    dB = 0 if cowling else -2 * B / r + k2 * P / (r * r) + G4 * rho * k2 * V / r
    return [dU, dR, dP, dB]


def _integrate(fun, y0, r0, r1, args):
    sol = solve_ivp(fun, [r0, r1], y0, args=args, rtol=1e-9, atol=1e-30, method="DOP853")
    return sol.y[:, -1]


def _start_solid(r, l, prem, layer):
    rho, kap, mu, _ = prem.at(layer, r)
    lam = kap - 2 * mu / 3
    out = []
    for U, V, P in ((l * r ** (l - 1), r ** (l - 1), 0.0), (r ** (l + 1), 0.0, 0.0), (0.0, 0.0, r ** l)):
        dU = (l - 1) * U / r if U else 0.0
        dV = (l - 1) * V / r if V else 0.0
        X = 2 * U - l * (l + 1) * V
        R = (lam + 2 * mu) * dU + lam * X / r
        S = mu * (dV - V / r + U / r)
        out.append(np.array([U, V, R, S, P, l * P / r + 4 * np.pi * consts.G * rho * U]))
    return out


def _normalise(sols):
    s = max(np.abs(v).max() for v in sols)
    return [v / s for v in sols]


def spheroidal_det(f_hz, l, prem, cowling=False, r_start=1.0e5):
    """Surface boundary determinant for frequency f_hz (Hz), degree l >= 1."""
    w2, k2 = (2 * np.pi * f_hz) ** 2, l * (l + 1.0)
    sols, state, r = _start_solid(r_start, l, prem, 0), "solid", r_start
    for k, idx in enumerate(prem.layers):
        r1 = prem.r[idx[-1]]
        if prem.solid(k) and state == "fluid":  # fluid -> solid: V free on the solid side
            sols = [np.array([U, 0.0, R, 0.0, P, B]) for U, R, P, B in sols] + [np.array([0, 1.0, 0, 0, 0, 0])]
        if not prem.solid(k) and state == "solid":  # solid -> fluid: combine to S = 0
            s = np.array([v[3] for v in sols])
            basis = np.linalg.svd(s.reshape(1, -1))[2][1:]
            sols = [np.array([sum(c * v[i] for c, v in zip(b, sols)) for i in (0, 2, 4, 5)]) for b in basis]
        state = "solid" if prem.solid(k) else "fluid"
        fun = _solid_rhs if state == "solid" else _fluid_rhs
        sols = _normalise([_integrate(fun, v, max(r, prem.r[idx[0]]), r1, (prem, k, w2, k2, cowling)) for v in sols])
        r = r1
    a = prem.a
    M = np.array([[v[2], v[3], v[5] + (l + 1) * v[4] / a] for v in sols])
    return float(np.linalg.det(M))


def toroidal_det(f_hz, l, prem):
    """Toroidal surface traction for W = 1, T = 0 started at the core-mantle boundary."""
    w2, k2 = (2 * np.pi * f_hz) ** 2, l * (l + 1.0)
    first = next(k for k in range(len(prem.layers)) if prem.solid(k) and prem.r[prem.layers[k][0]] > 3e6)
    y = np.array([1.0, 0.0])
    for k in range(first, len(prem.layers)):
        idx = prem.layers[k]

        def rhs(r, y, k=k):
            rho, _, mu, _ = prem.at(k, r)
            return [y[0] / r + y[1] / mu, ((k2 - 2) * mu / r ** 2 - w2 * rho) * y[0] - 3 * y[1] / r]
        y = _integrate(rhs, y, prem.r[idx[0]], prem.r[idx[-1]], ())
    return float(y[1])


def _radial_rhs(r, y, prem, layer, w2):
    U, R = y
    rho, kap, mu, g = prem.at(layer, r)
    lam, beta = kap - 2 * mu / 3, kap + 4 * mu / 3
    return [(R - 2 * lam * U / r) / beta,
            (-w2 * rho - 4 * rho * g / r + 4 * mu * (3 * lam + 2 * mu) / (beta * r * r)) * U - 4 * mu * R / (beta * r)]


def radial_det(f_hz, prem, r_start=1.0e5):
    """0S0 and overtones: l = 0, where V drops out and regularity forces B = 0."""
    w2 = (2 * np.pi * f_hz) ** 2
    rho, kap, mu, _ = prem.at(0, r_start)
    y, r = np.array([r_start, 3 * kap]), r_start  # U = r: U' = 1, div = 3, R = 3 lambda + 2 mu = 3 kappa
    for k, idx in enumerate(prem.layers):
        y = _integrate(_radial_rhs, y, max(r, prem.r[idx[0]]), prem.r[idx[-1]], (prem, k, w2))
        y = y / np.abs(y).max()
        r = prem.r[idx[-1]]
    return float(y[1])


def find_mode(kind, l, lo, hi, cowling=False, dispersion=True, n=24):
    """Lowest root in [lo, hi] Hz; the PREM moduli are re-dispersed to the root's own period once."""
    prem = Prem(period=1 / ((lo + hi) / 2), dispersion=dispersion)
    for _ in range(2):
        det = {"S": lambda f: spheroidal_det(f, l, prem, cowling), "T": lambda f: toroidal_det(f, l, prem),
               "R": lambda f: radial_det(f, prem)}[kind]
        grid = np.linspace(lo, hi, n)
        vals = [det(f) for f in grid]
        i = next(i for i in range(n - 1) if np.sign(vals[i]) != np.sign(vals[i + 1]))
        f0 = brentq(det, grid[i], grid[i + 1], xtol=1e-12)
        if not dispersion:
            return f0
        prem = Prem(period=1 / f0, dispersion=True)
    return f0
