# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Brute force to light: a single gas bubble driven by sound, from the Rayleigh cavity to sonoluminescence.

Known answers: Rayleigh's empty-cavity collapse time t_c = 0.914681 R0 sqrt(rho / dp); Minnaert's frequency
f = sqrt(3 kappa p0 / rho) / (2 pi R0), with the surface-tension correction. The driven bubble uses the
Keller-Miksis equation (first order in the liquid Mach number) with a van der Waals hard core and a polytropic
gas; the collapse temperature is the adiabatic estimate and the light model is a black body, both approximate.
Water properties come from the NIST tables in packages/measured.
"""
import numpy as np
from scipy.integrate import solve_ivp

from . import consts

def rayleigh_factor():
    """Closed form of Rayleigh's constant: sqrt(3/2) * integral_0^1 x^(3/2) / sqrt(1 - x^3) dx."""
    from scipy.special import beta
    return float(np.sqrt(1.5) * beta(5 / 6, 0.5) / 3)


def rayleigh_collapse(R0=1e-3, dp=None, rho=None, coeff=1.5, rstop=1e-4):
    """Integrate R R'' + coeff R'^2 = -dp / rho from rest; return the time to reach rstop * R0.
    coeff = 1.5 is the equation; any other value is a planted error."""
    w = consts.water()
    dp = consts.ATM - w["pv"] if dp is None else dp
    rho = w["rho"] if rho is None else rho

    def f(t, y):
        return [y[1], (-dp / rho - coeff * y[1] ** 2) / y[0]]

    def hit(t, y):
        return y[0] - rstop * R0
    hit.terminal = True
    sol = solve_ivp(f, [0, 10 * R0 * np.sqrt(rho / dp)], [R0, 0.0], events=hit, rtol=1e-11, atol=1e-16, method="DOP853")
    return {"t": float(sol.t_events[0][0]), "t_rayleigh": rayleigh_factor() * R0 * np.sqrt(rho / dp)}


def minnaert(R0, kappa=1.4, p0=None, sigma=0.0, rho=None):
    w = consts.water()
    p0 = consts.ATM if p0 is None else p0
    rho = w["rho"] if rho is None else rho
    return float(np.sqrt((3 * kappa * (p0 + 2 * sigma / R0) - 2 * sigma / R0) / rho) / (2 * np.pi * R0))


class Bubble:
    """Keller-Miksis bubble. kappa: polytropic exponent; hcore: van der Waals radius as a fraction of R0."""

    def __init__(self, R0, kappa=5 / 3, hcore=1 / 8.86, T=293.15, p0=None, liquid=None, vapour=True):
        w = liquid or consts.water(T)
        self.R0, self.kappa, self.h = R0, kappa, hcore * R0
        self.rho, self.c, self.mu, self.sig = w["rho"], w["c"], w["mu"], w["sigma"]
        self.pv = w["pv"] if vapour else 0.0
        self.p0 = consts.ATM if p0 is None else p0
        self.T0 = T
        self.pg0 = self.p0 + 2 * self.sig / R0 - self.pv

    def gas(self, R):
        return self.pg0 * ((self.R0 ** 3 - self.h ** 3) / (R ** 3 - self.h ** 3)) ** self.kappa

    def temperature(self, R):
        """Adiabatic gas temperature relative to the equilibrium state (approximate)."""
        return self.T0 * ((self.R0 ** 3 - self.h ** 3) / (R ** 3 - self.h ** 3)) ** (self.kappa - 1)

    def rhs(self, t, y, Pa, f):
        R, U = y
        pg = self.gas(R)
        pinf = self.p0 - Pa * np.sin(2 * np.pi * f * t)
        pB = pg + self.pv - 2 * self.sig / R - 4 * self.mu * U / R
        dpg = -3 * self.kappa * pg * R ** 2 * U / (R ** 3 - self.h ** 3)
        dpB_noacc = dpg + 2 * self.sig * U / R ** 2 + 4 * self.mu * U ** 2 / R ** 2
        num = (1 + U / self.c) * (pB - pinf) / self.rho + R * dpB_noacc / (self.rho * self.c) - 1.5 * (1 - U / (3 * self.c)) * U ** 2
        den = (1 - U / self.c) * R + 4 * self.mu / (self.rho * self.c)
        return [U, num / den]

    def run(self, Pa, f, cycles=3, R_init=None, pts=4000):
        T = cycles / f
        sol = solve_ivp(self.rhs, [0, T], [R_init or self.R0, 0.0], args=(Pa, f), method="Radau", rtol=1e-10,
                        atol=[1e-15, 1e-10], dense_output=True, max_step=1 / (200 * f))
        t = np.linspace(0, T, pts)
        return t, sol.sol(t)[0], sol


def ring_frequency(R0, eps=1e-3, kappa=1.4, cycles=20):
    """Free small oscillation of an air bubble (no surface tension, viscosity or vapour): the measured frequency."""
    liquid = dict(consts.water(), sigma=0.0, mu=0.0)
    b = Bubble(R0, kappa=kappa, hcore=0.0, liquid=liquid, vapour=False)
    b.c = 1e12  # incompressible limit: Rayleigh-Plesset
    f0 = minnaert(R0, kappa)
    sol = solve_ivp(b.rhs, [0, cycles / f0], [R0 * (1 + eps), 0.0], args=(0.0, 1.0), rtol=1e-11, atol=[1e-16, 1e-12],
                    dense_output=True, method="DOP853")
    t = np.linspace(0, cycles / f0, 200 * cycles)
    x = sol.sol(t)[0] - R0
    up = np.where((x[:-1] < 0) & (x[1:] >= 0))[0]
    tz = t[up] - x[up] * (t[up + 1] - t[up]) / (x[up + 1] - x[up])
    return float(1 / np.mean(np.diff(tz)))


def collapse_stats(b, Pa, f, cycles=3, skip=1):
    """Max expansion, min radius, compression ratio and adiabatic peak temperature over cycles after `skip`."""
    t, R, sol = b.run(Pa, f, cycles=cycles)
    m = t >= skip / f
    ts, Rs = sol.t, sol.y[0]  # the solver's own steps crowd into the collapse; a uniform grid can step over it
    ms = ts >= skip / f
    i = int(np.argmin(Rs[ms]))
    j = int(np.flatnonzero(ms)[i])
    tt = np.linspace(ts[max(j - 2, 0)], ts[min(j + 2, len(ts) - 1)], 4001)  # refine between neighbouring steps
    Rr = sol.sol(tt)[0]
    Rmin = float(Rr.min())
    rmax = max(float(R[m].max()), float(Rs[ms].max()))
    return {"Rmax": rmax, "Rmin": Rmin, "ratio": rmax / Rmin,
            "Tmax": float(b.temperature(Rmin)), "t_min": float(tt[np.argmin(Rr)])}


def concentration(b, Pa, f, stats):
    """Energy concentration of the collapse, two ways (both approximate):
    per_quantum: Wien peak photon energy at Tmax (2.821 kB Tmax) over the driving phonon energy hbar omega;
    per_volume: thermal energy density of the gas at Rmin (3/2 n kB Tmax) over the acoustic energy density
    Pa^2 / (2 rho c^2) of the drive."""
    kB, hbar = consts.KB, consts.HBAR
    n0 = b.pg0 / (kB * b.T0)
    n_min = n0 * (b.R0 / stats["Rmin"]) ** 3
    e_gas = 1.5 * n_min * kB * stats["Tmax"]
    e_ac = Pa ** 2 / (2 * b.rho * b.c ** 2)
    return {"per_quantum": 2.821 * kB * stats["Tmax"] / (hbar * 2 * np.pi * f), "per_volume": e_gas / e_ac}


def blackbody_flash(b, Pa, f, stats, window=None):
    """Approximate light: black-body power 4 pi R^2 sigma_SB T^4 integrated around the collapse, in photons
    (mean photon energy 2.70 kB T). A model, not a prediction of the measured spectrum."""
    _, _, sol = b.run(Pa, f, cycles=int(np.ceil(stats["t_min"] * f)) + 1)
    w = window or 2e-4 / f
    tt = np.linspace(stats["t_min"] - w, stats["t_min"] + w, 20001)
    R = sol.sol(tt)[0]
    T = b.temperature(R)
    P = 4 * np.pi * R ** 2 * consts.gen().sigma * T ** 4
    photons = np.trapezoid(P / (2.70 * consts.KB * T), tt)
    half = tt[P >= P.max() / 2]
    return {"energy_J": float(np.trapezoid(P, tt)), "photons": float(photons), "fwhm_s": float(half[-1] - half[0])}
