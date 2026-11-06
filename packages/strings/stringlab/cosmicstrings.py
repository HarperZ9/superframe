# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The gravitational-wave background from a network of cosmic strings and superstrings.

Units: c = 1, times and lengths in seconds, frequencies in Hz.

Background. Flat LambdaCDM with radiation; optionally the Standard Model degrees of freedom g_rho(T) and
g_s(T) from a table (Saikawa and Shirai 2020), so H^2 = H0^2 [Omega_r (g_rho/g_rho0)(g_s0/g_s)^(4/3)(1+z)^4
+ Omega_m (1+z)^3 + Omega_L].

Long strings. The velocity-dependent one-scale (VOS) model in e-folds N = ln a,
    dL/dN = L (1 + v^2) + c v / (2 H),   dv/dN = (1 - v^2) (k(v) / (L H) - 2 v),
    k(v) = (2 sqrt 2 / pi) (1 - 8 v^6) / (1 + 8 v^6),  c = 0.23 (loop chopping).
Loops. Formed at length alpha_L L (alpha_L = 0.37) at the rate F c v / (f_r alpha_L L^4) per volume, with
F = 0.1 and f_r = sqrt 2; they shrink as l = l_b - Gamma G mu (t - t_b). So
    n(l, t) = R(t_b) (a(t_b)/a(t))^3 / (d l_b/d t_b + Gamma G mu),   l_b(t_b) + Gamma G mu t_b = l + Gamma G mu t.
Emission. Omega(f) = (8 pi (G mu)^2 / (3 H0^2)) sum_k P_k I_1(f / k), P_k = Gamma k^-q / zeta(q),
    I_1(f) = (2/f) int dt (a/a0)^5 n(2 a / (f a0), t)   (I_k(f) = I_1(f/k) exactly).
Superstrings: the loop density, so Omega, is scaled by P^-beta for intercommutation probability P
(beta = 1 is the convention of NANOGrav 2023, eq. 52).
"""
import math

import numpy as np
from scipy.integrate import solve_ivp
from scipy.special import zeta

MPC = 3.0856775814913673e22    # m
T0_GEV = 2.7255 * 8.617333262e-14   # 2.7255 K in GeV


class Cosmology:
    """Expansion history on a grid of N = ln a from N_ini to 0."""

    def __init__(self, h=0.674, omega_m=0.3153, omega_r=9.2188e-5, gstar=None, z_max=1e20, n_grid=6000,
                 omega_l=None, g_model=None):
        """g_model "lvk2017": the piecewise G(z) of Abbott et al. 2018 (O1/O2 strings), Appendix A: 1 below z = 1e9,
        0.83 up to 2e12, 0.39 above; otherwise G(z) from the g*(T) table (or 1 without a table)."""
        self.h = h
        self.H0 = h * 100e3 / MPC                         # 1/s
        self.om, self.orad = omega_m, omega_r
        self.ol = 1.0 - omega_m - omega_r if omega_l is None else omega_l
        self.N = np.linspace(-math.log1p(z_max), 0.0, n_grid)
        z = np.expm1(-self.N)
        if g_model == "lvk2017":
            self.gfac = np.where(z < 1e9, 1.0, np.where(z < 2e12, 0.83, 0.39))
        else:
            self.gfac = self._gfactor(z, gstar)
        self.H = self.H0 * np.sqrt(self.orad * self.gfac * (1 + z) ** 4 + self.om * (1 + z) ** 3 + self.ol)
        # t(N): start with the radiation value 1/(2H), then integrate dt = dN / H (trapezoid)
        dt = 0.5 * (1 / self.H[1:] + 1 / self.H[:-1]) * np.diff(self.N)
        self.t = np.concatenate([[1 / (2 * self.H[0])], 1 / (2 * self.H[0]) + np.cumsum(dt)])
        self.a = np.exp(self.N)

    @staticmethod
    def _gfactor(z, table):
        if table is None:
            return np.ones_like(z)
        T, gs, gr = table[:, 0], table[:, 2], table[:, 3]
        gs0, gr0 = gs[0], gr[0]
        # T(z) from (1+z) = (T/T0) (g_s(T)/g_s0)^(1/3), by fixed-point iteration on the log table
        Tz = T0_GEV * (1 + z)
        for _ in range(30):
            gsz = np.interp(np.log(Tz), np.log(T), gs, left=gs0, right=gs[-1])
            Tz = T0_GEV * (1 + z) * (gs0 / gsz) ** (1 / 3)
        grz = np.interp(np.log(Tz), np.log(T), gr, left=gr0, right=gr[-1])
        gsz = np.interp(np.log(Tz), np.log(T), gs, left=gs0, right=gs[-1])
        return (grz / gr0) * (gs0 / gsz) ** (4 / 3)


def k_of_v(v):
    return (2 * math.sqrt(2) / math.pi) * (1 - 8 * v ** 6) / (1 + 8 * v ** 6)


def scaling_solution(beta, c=0.23):
    """xi = L/t and v for a ∝ t^beta: the VOS fixed point, solved by bisection on v."""
    def resid(v):
        k = k_of_v(v)
        return v * v - k * (1 - beta) / (beta * (k + c))
    lo, hi = 1e-3, 0.7
    for _ in range(200):
        mid = 0.5 * (lo + hi)
        if resid(lo) * resid(mid) <= 0:
            hi = mid
        else:
            lo = mid
    v = 0.5 * (lo + hi)
    k = k_of_v(v)
    return math.sqrt(k * (k + c) / (4 * beta * (1 - beta))), v


class Network:
    """VOS long-string network on a cosmology, and its loop number density."""

    def __init__(self, cosmo, c=0.23, alpha_L=0.37, F=0.1, fr=math.sqrt(2)):
        self.cosmo, self.c, self.alpha_L, self.F, self.fr = cosmo, c, alpha_L, F, fr
        xi0, v0 = scaling_solution(0.5, c)
        Hof = lambda N: np.interp(N, cosmo.N, cosmo.H)  # noqa: E731

        def rhs(N, y):
            L, v = y
            H = Hof(N)
            return [L * (1 + v * v) + c * v / (2 * H), (1 - v * v) * (k_of_v(v) / (L * H) - 2 * v)]
        y0 = [xi0 * cosmo.t[0], v0]
        sol = solve_ivp(rhs, (cosmo.N[0], 0.0), y0, t_eval=cosmo.N, method="LSODA", rtol=1e-8, atol=[1e-30, 1e-10])
        self.L, self.v = sol.y
        self.xi = self.L / cosmo.t
        self.lb = alpha_L * self.L                                     # loop size at birth
        self.rate = F * c * self.v / (fr * alpha_L * self.L ** 4)      # loops per volume per time
        self.dlb_dt = np.gradient(self.lb, cosmo.t)

    def density(self, l, t_idx, gmu, Gamma=50.0):
        """n(l, t) for an array l at the grid times cosmo.t[t_idx] (broadcast). Zero where no loop exists."""
        co = self.cosmo
        g = self.lb + Gamma * gmu * co.t                             # increasing in the birth time
        target = l + Gamma * gmu * co.t[t_idx]
        ok = (target >= g[0]) & (target <= g[t_idx]) & (l > 0)
        Nb = np.interp(target, g, co.N)
        rate = np.exp(np.interp(Nb, co.N, np.log(self.rate)))
        jac = np.interp(Nb, co.N, self.dlb_dt) + Gamma * gmu
        dil = np.exp(3 * (Nb - co.N[t_idx]))
        return np.where(ok, rate * dil / jac, 0.0)


def I1(net, f, gmu, Gamma=50.0, n_min=None):
    """I_1(f) for an array of frequencies; integral over N on the cosmology grid (trapezoid)."""
    co = net.cosmo
    f = np.atleast_1d(np.asarray(f, dtype=float))
    idx = np.arange(co.N.size)
    out = np.empty(f.size)
    w = np.exp(5 * co.N) / co.H
    for i, fi in enumerate(f):
        l = 2 * co.a / fi
        integ = w * net.density(l, idx, gmu, Gamma)
        out[i] = 2 / fi * np.trapezoid(integ, co.N)
    return out


def omega_gw(net, f, gmu, Gamma=50.0, q=4 / 3, kmax=100000, P=1.0, beta=1.0, fgrid=None):
    """Omega_gw(f) today. I_1 is tabulated on a log grid and summed over k by interpolation."""
    co = net.cosmo
    f = np.atleast_1d(np.asarray(f, dtype=float))
    if fgrid is None:
        fgrid = np.logspace(math.log10(f.min() / kmax) - 0.1, math.log10(f.max()) + 0.1, 700)
    i1 = I1(net, fgrid, gmu, Gamma)
    li = np.log(np.maximum(i1, 1e-300))
    k = np.arange(1, kmax + 1, dtype=float)
    pk = Gamma * k ** (-q) / zeta(q)
    out = np.empty(f.size)
    for j, fj in enumerate(f):
        vals = np.exp(np.interp(np.log(fj / k), np.log(fgrid), li, left=-690.0, right=li[-1]))
        out[j] = np.sum(pk * vals)
    return 8 * math.pi * gmu ** 2 / (3 * co.H0 ** 2) * out * P ** (-beta)


def plateau_radiation(net, gmu, Gamma=50.0):
    """Closed form for a pure-radiation universe: Omega = (128 pi / 9) B sqrt(G mu / Gamma),
    B = F C (alpha + Gamma G mu)^(3/2) / alpha with C = c v / (f_r xi^3), alpha = alpha_L xi."""
    xi, v = scaling_solution(0.5, net.c)
    C = net.c * v / (net.fr * xi ** 3)
    al = net.alpha_L * xi
    B = net.F * C * (al + Gamma * gmu) ** 1.5 / al
    return 128 * math.pi / 9 * B * math.sqrt(gmu / Gamma)
