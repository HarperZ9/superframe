# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Physics limits on a driven bubble: shape instability and an ionisation energy sink.

Shape. A distortion R + a_n Y_n obeys a_n'' + B_n a_n' - A_n a_n = 0 with, in the boundary-layer approximation
(Brenner, Hilgenfeldt and Lohse 2002, eqs. 59 to 63, after Prosperetti and Hilgenfeldt et al. 1996),
  A_n = (n - 1) R''/R - beta_n sigma / (rho R^3) - (2 nu R'/R^3) [(n - 1)(n + 2) + 2 n (n + 2)(n - 1) delta / R],
  B_n = 3 R'/R + (2 nu / R^2) [(n + 2)(2n + 1) - 2 n (n + 2)^2 delta / R],
beta_n = (n - 1)(n + 1)(n + 2), delta = min(sqrt(nu / omega), R / (2n)). Parametric instability: the largest Floquet
multiplier over one drive period exceeds 1. Rayleigh-Taylor: a thermal-size start (sqrt(kB T / sigma)) grows to
|a_n| > R within one period. Known answer: a static bubble rings at Lamb's omega_n^2 = beta_n sigma / (rho R^3).
Ionisation. Monatomic argon compressed adiabatically from the moment the collapsing wall passes R0 (where the polytropic
model has T = T0), with Saha ionisation: U = N [3/2 (1 + x) kB T + x I], p = (1 + x) N kB T / V, dU = -p dV. With I set very large it
reduces to the polytropic T = T0 (V0 / V)^(2/3). The radial dynamics is not fed back (an approximation).
"""
import numpy as np
from scipy.integrate import solve_ivp
from scipy.optimize import brentq

from . import consts

EV = consts.gen().e
ME = consts.gen().me


def lamb_frequency(R, n, sigma, rho):
    return float(np.sqrt((n - 1) * (n + 1) * (n + 2) * sigma / (rho * R ** 3)))


def _coeffs(b, R, U, Racc, n, omega_d):
    nu = b.mu / b.rho
    delta = min(np.sqrt(nu / omega_d), R / (2 * n))
    beta = (n - 1) * (n + 1) * (n + 2)
    A = (n - 1) * Racc / R - beta * b.sig / (b.rho * R ** 3) - 2 * nu * U / R ** 3 * ((n - 1) * (n + 2) + 2 * n * (n + 2) * (n - 1) * delta / R)
    B = 3 * U / R + 2 * nu / R ** 2 * ((n + 2) * (2 * n + 1) - 2 * n * (n + 2) ** 2 * delta / R)
    return A, B


def _augmented(b, Pa, f, modes):
    w = 2 * np.pi * f

    def rhs(t, y):
        dR = b.rhs(t, y[:2], Pa, f)
        out = list(dR)
        for k, n in enumerate(modes):
            A, B = _coeffs(b, y[0], y[1], dR[1], n, w)
            for j in range(2):
                a, ad = y[2 + 4 * k + 2 * j], y[3 + 4 * k + 2 * j]
                out += [ad, -B * ad + A * a]
        return out
    return rhs


def shape_stability(b, Pa, f, modes=(2, 3, 4, 5), settle=8):
    """Settle the radial motion, then integrate shape modes over one more period.
    Returns per mode the largest Floquet multiplier and the Rayleigh-Taylor amplification max |a| / R from a
    thermal-size start, plus whether either instability fires."""
    t, R, sol = b.run(Pa, f, cycles=settle)
    y0 = list(sol.sol(settle / f))
    T = 1 / f
    for n in modes:
        y0 += [1.0, 0.0, 0.0, 1.0 / T]  # basis 1: a = 1; basis 2: a' = 1 / T (scaled)
    s = solve_ivp(_augmented(b, Pa, f, modes), [settle / f, settle / f + T], y0, method="Radau", rtol=1e-8,
                  atol=1e-14, max_step=T / 400)
    if s.status != 0:
        raise RuntimeError(f"shape integration stopped: {s.message}")
    a0 = np.sqrt(consts.KB * b.T0 / b.sig)
    out = {}
    for k, n in enumerate(modes):
        i = 2 + 4 * k
        M = np.array([[s.y[i, -1], s.y[i + 2, -1]], [s.y[i + 1, -1] * T, s.y[i + 3, -1] * T]])
        lam = float(np.abs(np.linalg.eigvals(M)).max())
        rt = float((a0 * np.abs(s.y[i]) / s.y[0]).max())
        out[n] = {"floquet": lam, "rt_amp": rt}
    out["parametric"] = bool(any(out[n]["floquet"] > 1 for n in modes))
    out["rayleigh_taylor"] = bool(any(out[n]["rt_amp"] > 1 for n in modes))
    out["stable"] = not (out["parametric"] or out["rayleigh_taylor"])
    return out


def _g_ion(T):
    ar = consts.media()["argon"]
    return sum(lv["g"] * np.exp(-lv["eV"] * EV / (consts.KB * T)) for lv in ar["ion_levels"])


def saha_fraction(T, n_tot, I_eV=None):
    """Ionised fraction x of argon at temperature T and total heavy-particle density n_tot (m^-3)."""
    I = (consts.media()["argon"]["ionization_eV"] if I_eV is None else I_eV) * EV
    h = consts.gen().h
    S = 2 * _g_ion(T) / consts.media()["argon"]["g_atom"] * (2 * np.pi * ME * consts.KB * T / h ** 2) ** 1.5 * np.exp(-I / (consts.KB * T)) / n_tot
    return float((-S + np.sqrt(S * S + 4 * S)) / 2)


def _energy(T, V, N, I):
    x = saha_fraction(T, N / V, I / EV)
    return N * (1.5 * (1 + x) * consts.KB * T + x * I), x


def compress(N, V, T0, I_eV=None, sink=True):
    """Adiabatic compression along the volume path V (decreasing), with or without the ionisation energy in U.
    Returns T and x along the path. sink=False keeps the extra particles but drops the energy x I (planted)."""
    I = (consts.media()["argon"]["ionization_eV"] if I_eV is None else I_eV) * EV
    Ieff = I if sink else 0.0
    T, xs = [T0], [saha_fraction(T0, N / V[0], I / EV)]

    def U(Tk, Vk):
        x = saha_fraction(Tk, N / Vk, I / EV)
        return N * (1.5 * (1 + x) * consts.KB * Tk + x * Ieff), x
    for k in range(1, len(V)):
        U0, x0 = U(T[-1], V[k - 1])
        p0 = (1 + x0) * N * consts.KB * T[-1] / V[k - 1]
        guess = T[-1] * (V[k - 1] / V[k]) ** (2 / 3)
        target = U0 - p0 * (V[k] - V[k - 1])
        for _ in range(2):  # trapezoid in p: refine with the end-point pressure
            Tn = brentq(lambda Tt: U(Tt, V[k])[0] - target, T[-1] * 0.5, guess * 2 + 1)
            p1 = (1 + U(Tn, V[k])[1]) * N * consts.KB * Tn / V[k]
            target = U0 - 0.5 * (p0 + p1) * (V[k] - V[k - 1])
        Tn = brentq(lambda Tt: U(Tt, V[k])[0] - target, T[-1] * 0.5, guess * 2 + 1)
        T.append(Tn)
        xs.append(U(Tn, V[k])[1])
    return np.array(T), np.array(xs)


def collapse_temperature(b, Pa, f, settle=8, pts=3000, I_eV=None):
    """Peak temperature of the last collapse: polytropic from R0 (the radial model's own gas law), and the same
    adiabatic compression with the Saha ionisation sink, started where the collapsing wall passes R0 at T0.
    Without the sink the second reproduces the first. Also the peak ionised fraction."""
    t, R, sol = b.run(Pa, f, cycles=settle, pts=4000 * settle)
    m = t >= (settle - 1) / f
    tt, RR = t[m], R[m]
    i_max = int(np.argmax(RR))
    ts, Rs = sol.t, sol.y[0]
    w = (ts > tt[i_max]) & (ts < tt[-1])
    j = int(np.argmin(np.where(w, Rs, np.inf)))
    t_min = ts[j]
    t0 = brentq(lambda x: sol.sol(x)[0] - b.R0, tt[i_max], t_min)  # the wall passes R0 on its way in
    Rmin = float(sol.sol(t_min)[0])
    # Adiabatic compression depends only on the volume path, so step in volume (geometric), never in time: a time
    # grid takes volume steps of 6x near the core and breaks the energy update (found in the first w10 run).
    V = np.geomspace(4 / 3 * np.pi * (b.R0 ** 3 - b.h ** 3), 4 / 3 * np.pi * (Rmin ** 3 - b.h ** 3), pts)
    Rp = np.array([Rmin])
    N = b.pg0 * V[0] / (consts.KB * b.T0)
    T_ion, x = compress(N, V, b.T0, I_eV)
    return {"Rmax": float(RR.max()), "Rmin": float(Rp[-1]), "T_poly": float(b.temperature(Rp[-1])),
            "T_ionised": float(T_ion.max()), "x_max": float(x.max())}
