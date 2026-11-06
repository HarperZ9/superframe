# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A bubble with a radially resolved gas temperature, so a centre temperature can be compared with gas dynamics.

Homobaric model (Prosperetti, Crum and Commander 1988): the gas pressure p is uniform, the temperature is not. The gas
is cut into n Lagrangian shells of fixed atom counts N_i (finer toward the wall, where the thermal boundary layer
sits), so the gas mass is conserved exactly. Ideal monatomic argon: shell volume V_i = N_i kB T_i / p, so
p = (3 / (4 pi R^3)) sum N_i kB T_i. Each shell obeys N_i c_p dT_i/dt = V_i dp/dt + Q_in - Q_out (c_p = 5/2 kB),
with conductive fluxes 4 pi r^2 K(T) dT/dr between shell centres, NIST argon conductivity, and the water a heat
bath at T0 at the wall. Summing the shells gives dp/dt = (3/R) [(gamma - 1) Q_wall / (4 pi R^2) - gamma p R'],
the homobaric pressure equation. The wall obeys the Keller-Miksis equation of bubble.Bubble. No van der Waals core.
Known answers: with K = 0 every shell follows the adiabat T V^(gamma - 1); the total atom count is constant; a slow
drive stays isothermal. A first version on a fixed Eulerian grid gained gas at each collapse (3 to 9 times over three
cycles) and was replaced by these shells.
"""
import numpy as np
from scipy.integrate import solve_ivp

from . import consts
from .thermal import conductivity_fit

GAMMA = 5 / 3


class ConductingBubble:
    def __init__(self, R0, n=60, ratio=1e-3, T=293.15, conduct=True):
        w = consts.water(T)
        self.R0, self.n, self.T0, self.conduct = R0, n, T, conduct
        self.rho, self.c, self.mu, self.sig, self.pv = w["rho"], w["c"], w["mu"], w["sigma"], w["pv"]
        self.p0 = consts.ATM
        self.pg0 = self.p0 + 2 * self.sig / R0 - self.pv
        Ntot = self.pg0 * 4 / 3 * np.pi * R0 ** 3 / (consts.KB * T)
        q = ratio ** (1 / max(n - 1, 1))
        frac = q ** np.arange(n)
        self.N = Ntot * frac / frac.sum()  # shell 0 at the centre, shell n - 1 at the wall
        self.Ntot = Ntot
        self.ka, self.kb = conductivity_fit()

    def K(self, T):
        return self.ka * np.abs(T) ** self.kb if self.conduct else 0.0 * T

    def geometry(self, R, T):
        kT = self.N * consts.KB * T
        p = 3 * kT.sum() / (4 * np.pi * R ** 3)
        r_out = (3 * np.cumsum(kT) / (4 * np.pi * p)) ** (1 / 3)
        r_in = np.concatenate([[0.0], r_out[:-1]])
        rc = ((r_out ** 3 + r_in ** 3) / 2) ** (1 / 3)
        return p, r_out, rc

    def rhs(self, t, s, Pa, f):
        R, U, T = s[0], s[1], s[2:]
        p, r_out, rc = self.geometry(R, T)
        Kf = self.K(0.5 * (T[1:] + T[:-1]))
        q_int = 4 * np.pi * r_out[:-1] ** 2 * Kf * (T[1:] - T[:-1]) / (rc[1:] - rc[:-1])  # into shell i from shell i + 1
        q_wall = 4 * np.pi * R * R * self.K(T[-1]) * (self.T0 - T[-1]) / (R - rc[-1])
        Q = np.zeros(self.n)
        Q[:-1] += q_int
        Q[1:] -= q_int
        Q[-1] += q_wall
        dp = 3 / R * ((GAMMA - 1) * q_wall / (4 * np.pi * R * R) - GAMMA * p * U)
        V = self.N * consts.KB * T / p
        dT = (V * dp + Q) / (self.N * 2.5 * consts.KB)
        pinf = self.p0 - Pa * np.sin(2 * np.pi * f * t)
        pB = p + self.pv - 2 * self.sig / R - 4 * self.mu * U / R
        dpB_noacc = dp + 2 * self.sig * U / R ** 2 + 4 * self.mu * U ** 2 / R ** 2
        num = (1 + U / self.c) * (pB - pinf) / self.rho + R * dpB_noacc / (self.rho * self.c) - 1.5 * (1 - U / (3 * self.c)) * U ** 2
        den = (1 - U / self.c) * R + 4 * self.mu / (self.rho * self.c)
        return np.concatenate([[U, num / den], dT])

    def run(self, Pa, f, cycles=3):
        s0 = np.concatenate([[self.R0, 0.0], np.full(self.n, self.T0)])
        sol = solve_ivp(self.rhs, [0, cycles / f], s0, args=(Pa, f), method="Radau", rtol=1e-8, atol=np.concatenate([[1e-15, 1e-10], np.full(self.n, 1e-6)]),
                        dense_output=True, max_step=1 / (400 * f))
        if sol.status != 0:
            raise RuntimeError(f"conducting bubble stopped at t = {sol.t[-1]:.3e} s: {sol.message}")
        return sol

    def volume_check(self, sol):
        """Largest relative mismatch between the shells' summed volume and 4/3 pi R^3 (a consistency check)."""
        p = np.array([self.geometry(R, T)[0] for R, T in zip(sol.y[0], sol.y[2:].T)])
        V = (self.N[:, None] * consts.KB * sol.y[2:]).sum(0) / p
        return float(np.max(np.abs(V / (4 / 3 * np.pi * sol.y[0] ** 3) - 1)))


def cycle_stats(b, Pa, f, cycles=3):
    """Rmax and Rmin of the last cycle, the peak centre temperature and the peak mass-averaged temperature."""
    sol = b.run(Pa, f, cycles=cycles)
    m = sol.t >= (cycles - 1) / f
    T = sol.y[2:, m]
    Tmean = (b.N[:, None] * T).sum(0) / b.Ntot
    tt = np.linspace(sol.t[m][0], sol.t[-1], 6000)
    Rr = sol.sol(tt)[0]
    return {"Rmax": float(max(sol.y[0][m].max(), Rr.max())), "Rmin": float(min(sol.y[0][m].min(), Rr.min())),
            "Tcentre": float(T[0].max()), "Tmean": float(Tmean.max())}
