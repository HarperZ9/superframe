# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sound in other media and other worlds, the acoustic horizon, and the frequency scaling of planetary motion.

Mars: CO2's vibrational modes hold heat only when the sound is slow enough to share it, so the sound speed has
a relaxed (low-frequency) and a frozen (high-frequency) value. The frozen value uses gamma = 7/5 (translation
and rotation of a linear molecule); the relaxed value adds the Einstein heat capacity of CO2's bending (667
cm^-1, twice degenerate) and stretching (1388, 2349 cm^-1) modes. Perseverance measured both (Maurice et al.
2022). The NIST reference equation gives the relaxed value independently.
Acoustic horizon: in a 1D flow v(x) crossing the sound speed, upstream rays peel away from the horizon as
exp(kappa t) with kappa = |d(v - c)/dx| at the horizon, and Unruh's analog Hawking temperature is
T = hbar kappa / (2 pi kB).
"""
import numpy as np
from scipy.integrate import solve_ivp

from . import consts

CO2_MODES_CM = (667.4, 667.4, 1388.2, 2349.1)  # cm^-1, from memory (Herzberg); Fermi resonance ignored


def second_radiation_cm_k():
    return consts.codata("second radiation constant") * 100.0  # m K -> cm K


def co2_vib_cv(T):
    """Vibrational heat capacity of CO2 in units of R (Einstein modes)."""
    c2 = second_radiation_cm_k()
    tot = 0.0
    for nu in CO2_MODES_CM:
        x = c2 * nu / T
        tot += x * x * np.exp(x) / np.expm1(x) ** 2
    return tot


def co2_speeds(T, M=None):
    """Frozen and relaxed ideal-gas sound speeds of CO2 at T (K)."""
    M = consts.media()["ussa1976"]["air_M_kg_per_kmol"][3] / 1000 if M is None else M  # CO2, 1976 Table 3
    cv_frozen = 2.5
    cv_relaxed = 2.5 + co2_vib_cv(T)
    return {"frozen": consts.ideal_sound_speed(T, M, (cv_frozen + 1) / cv_frozen),
            "relaxed": consts.ideal_sound_speed(T, M, (cv_relaxed + 1) / cv_relaxed),
            "gamma_relaxed": (cv_relaxed + 1) / cv_relaxed, "M": M}


def media_table():
    """Model sound speeds against the measured or reference values, each row labelled."""
    nist = (lambda name, T: consts.nist_at(name, T, "Sound Spd. (m/s)"))
    rows = []
    for T in (232.0, 236.0, 240.0):
        s = co2_speeds(T)
        rows.append({"medium": f"Mars CO2 {T:.0f} K, below 240 Hz", "model": s["relaxed"], "kind": "model: relaxed ideal gas",
                     "check": nist("co2_mars", T), "check_kind": "NIST reference EOS (relaxed)"})
        rows.append({"medium": f"Mars CO2 {T:.0f} K, above 240 Hz", "model": s["frozen"], "kind": "model: frozen gamma 7/5",
                     "check": None, "check_kind": "measured 246 to 257 m/s (LIBS, daytime)"})
    rows.append({"medium": "Titan N2 93.65 K, 1.467 bar", "model": consts.ideal_sound_speed(93.65, 28.0134e-3, 1.4),
                 "kind": "model: ideal diatomic", "check": nist("n2_titan", 93.65), "check_kind": "NIST EOS (conditions from memory)"})
    rows.append({"medium": "Venus CO2 737 K, 9.2 MPa", "model": co2_speeds(737.0)["relaxed"], "kind": "model: relaxed ideal gas",
                 "check": nist("co2_venus", 737.0), "check_kind": "NIST EOS (pure CO2, supercritical)"})
    a = consts.air(293.15)
    rows.append({"medium": "Earth air 20 C", "model": a["c"], "kind": "ideal gas, 1976 composition", "check": None, "check_kind": ""})
    w = consts.water(293.15)
    rows.append({"medium": "Water 20 C", "model": None, "kind": "", "check": w["c"], "check_kind": "NIST EOS (IAPWS-95)"})
    return rows


def horizon_flow(x, c=1.0, D=0.5, L=1.0):
    """Flow speed crossing c at x = 0 (subsonic upstream x < 0, supersonic downstream)."""
    return c * (1 + D * np.tanh(x / L))


def surface_gravity(c=1.0, D=0.5, L=1.0):
    return c * D / L


def peel_rate(x0=1e-3, t_end=8.0, c=1.0, D=0.5, L=1.0):
    """Growth rate of the distance of an upstream-moving ray (dx/dt = v - c) from the horizon."""
    sol = solve_ivp(lambda t, x: horizon_flow(x, c, D, L) - c, [0, t_end], [x0], rtol=1e-11, atol=1e-14,
                    t_eval=np.linspace(0, t_end, 400))
    t, x = sol.t, sol.y[0]
    m = x < 0.05 * L
    return float(np.polyfit(t[m], np.log(x[m]), 1)[0])


def hawking_temperature(kappa):
    return consts.HBAR * kappa / (2 * np.pi * consts.KB)


def trapped(x0, c=1.0, D=0.5, L=1.0, t_end=50.0):
    """Final position of an upstream-aimed ray starting at x0: inside the horizon it is swept downstream."""
    sol = solve_ivp(lambda t, x: horizon_flow(x, c, D, L) - c, [0, t_end], [x0], rtol=1e-10)
    return float(sol.y[0, -1])


def octave_shift(f_hz, target=440.0):
    """Whole octaves n that bring f to the nearest octave of `target`; ratios stay exact under 2^n."""
    n = int(np.round(np.log2(target / f_hz)))
    return n, f_hz * 2.0 ** n


def brune(Mw, beta=3500.0, stress=3e6):
    """Brune (1970) omega-squared source: moment M0 (N m, Hanks-Kanamori) and corner frequency (Hz)."""
    M0 = 10 ** (1.5 * Mw + 9.1)
    return M0, 0.4906 * beta * (stress / M0) ** (1 / 3)


def brune_level(f, Mw, **kw):
    """Moment-rate spectral amplitude |M(f)| = M0 / (1 + (f/fc)^2)."""
    M0, fc = brune(Mw, **kw)
    return M0 / (1 + (f / fc) ** 2)
