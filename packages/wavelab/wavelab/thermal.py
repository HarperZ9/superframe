# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A bubble whose gas exchanges heat with the water, so it is isothermal when slow and adiabatic when fast.

Round 3 found the polytropic bubble (kappa = 5/3 throughout) expanding to about half of the literature radius:
an adiabatic gas cools as it expands and pulls the wall back. Here the gas temperature is a state variable
(after Toegel, Gompf, Pecha and Lohse 2000): N (3/2) kB dT/dt = -p dV/dt + 4 pi R^2 lambda(T) (T0 - T) / l_th,
p = N kB T / V with the van der Waals excluded volume V = 4/3 pi (R^3 - h^3), and the thermal boundary layer
l_th = min(sqrt(R chi / |R'|), R / pi), chi = lambda V / (N (5/2) kB). lambda(T) is a power law fitted to the NIST
argon conductivity at 1 atm (200 to 2000 K), extrapolated above 2000 K (an approximation). The wall obeys the same
Keller-Miksis equation as bubble.Bubble, with the vapour pressure in the wall pressure.
Known answers: with the heat flux off it is exactly the adiabatic polytrope T = T0 (V0 / V)^(2/3); with the heat
flux on, a slow drive keeps T within a fraction of a percent of T0. Literature: Brenner, Hilgenfeldt and Lohse
2002, Fig. 4 (R0 4.5 um, 1.2 atm, 26.5 kHz: Rmax about 30 um) and Fig. 20 (R0 2 um, 1.0 to 1.3 atm).
"""
from functools import lru_cache

import numpy as np
from scipy.integrate import solve_ivp

from . import consts
from .bubble import Bubble


@lru_cache(None)
def conductivity_fit():
    """lambda = a T^b fitted in log space to the NIST argon isobar (W m^-1 K^-1)."""
    cols, tab = consts.nist_table("argon_1atm")
    T, lam = tab[:, 0], tab[:, cols.index("Therm. Cond. (W/m*K)")]
    b, loga = np.polyfit(np.log(T), np.log(lam), 1)
    return float(np.exp(loga)), float(b)


class ThermalBubble(Bubble):
    def __init__(self, R0, heat=True, **kw):
        kw.setdefault("kappa", 5 / 3)
        super().__init__(R0, **kw)
        self.heat = heat
        self.N = self.pg0 * self._vol(R0) / (consts.KB * self.T0)
        self.lam_a, self.lam_b = conductivity_fit()

    def _vol(self, R):
        return 4 / 3 * np.pi * (R ** 3 - self.h ** 3)

    def gas_T(self, R, T):
        return self.N * consts.KB * T / self._vol(R)

    def rhs3(self, t, y, Pa, f):
        R, U, T = y
        V = self._vol(R)
        dV = 4 * np.pi * R * R * U
        pg = self.N * consts.KB * T / V
        q = 0.0
        if self.heat:
            lam = self.lam_a * T ** self.lam_b
            chi = lam * V / (self.N * 2.5 * consts.KB)
            lth = min(np.sqrt(R * chi / max(abs(U), 1e-12)), R / np.pi)
            q = 4 * np.pi * R * R * lam * (self.T0 - T) / lth
        dT = (-pg * dV + q) / (1.5 * self.N * consts.KB)
        dpg = pg * (dT / T - dV / V)
        pinf = self.p0 - Pa * np.sin(2 * np.pi * f * t)
        pB = pg + self.pv - 2 * self.sig / R - 4 * self.mu * U / R
        dpB_noacc = dpg + 2 * self.sig * U / R ** 2 + 4 * self.mu * U ** 2 / R ** 2
        num = (1 + U / self.c) * (pB - pinf) / self.rho + R * dpB_noacc / (self.rho * self.c) - 1.5 * (1 - U / (3 * self.c)) * U ** 2
        den = (1 - U / self.c) * R + 4 * self.mu / (self.rho * self.c)
        return [U, num / den, dT]

    def run3(self, Pa, f, cycles=3, pts=4000):
        T_end = cycles / f
        sol = solve_ivp(self.rhs3, [0, T_end], [self.R0, 0.0, self.T0], args=(Pa, f), method="Radau", rtol=1e-9,
                        atol=[1e-15, 1e-10, 1e-6], dense_output=True, max_step=1 / (400 * f))
        if sol.status != 0:
            raise RuntimeError(f"thermal bubble integration stopped at t = {sol.t[-1]:.3e} s: {sol.message}")
        t = np.linspace(0, T_end, pts * cycles)
        y = sol.sol(t)
        return t, y[0], y[2], sol


def cycle_stats(b, Pa, f, cycles=4):
    """Rmax, Rmin and Tmax over the last cycle, the minimum and maximum read from the solver's own steps."""
    t, R, T, sol = b.run3(Pa, f, cycles=cycles)
    m = t >= (cycles - 1) / f
    ms = sol.t >= (cycles - 1) / f
    return {"Rmax": float(max(R[m].max(), sol.y[0][ms].max())), "Rmin": float(sol.y[0][ms].min()),
            "Tmax": float(max(T[m].max(), sol.y[2][ms].max()))}
