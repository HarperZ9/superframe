# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""P22 phosphors: emission spectra, energy efficiency and decay laws, each graded by source.

Spectra live on the materials library grid (380 to 780 nm, 5 nm, 81 bins) and are normalised
to unit radiant energy, so a phosphor's spectrum times the light energy it emits is a spectral
energy in J/nm.

Decay laws give F(tau), the fraction of an excitation's light emitted by time tau after it, and
I(tau), the intensity relative to the peak. Three laws are offered:
  exponential: I = sum w_i/tau_i exp(-tau/tau_i)    (a single excited level, Eu3+ 5D0)
  hyperbolic (Becquerel): I = (1 + tau/t0)^-n       (recombination through traps, ZnS)
  kuhn: sum a_i exp(-2 pi f_i tau) + A (tau + t0)^-n, the measured P22 fit of Kuhn 2002 (default)
For n > 1 the hyperbolic law has finite energy and F = 1 - (1 + tau/t0)^-(n-1).
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "materials"))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "measured"))
from materials import spectral as _sp  # noqa: E402
from measured import load as _load_measured  # noqa: E402

GRID = np.array(_sp.GRID, dtype=np.float64)
DL = 5.0  # nm per bin


def _bin_line(spd, nm, weight):
    """Area-preserving split of a narrow line between its two neighbouring bins."""
    i = int((nm - GRID[0]) // DL)
    t = (nm - GRID[i]) / DL
    spd[i] += weight * (1 - t)
    spd[i + 1] += weight * t


def line_spectrum(lines):
    spd = np.zeros_like(GRID)
    for nm, w in lines:
        _bin_line(spd, nm, w)
    return spd / (spd.sum() * DL)


def band_spectrum(peak_nm, fwhm_nm):
    """A band that is gaussian in photon energy, the usual shape of a broad ZnS emission."""
    e = 1239.84 / GRID
    e0, s = 1239.84 / peak_nm, (1239.84 / (peak_nm - fwhm_nm / 2) - 1239.84 / (peak_nm + fwhm_nm / 2)) / 2.3548
    spd = np.exp(-0.5 * ((e - e0) / s) ** 2) * e ** 2 / 1239.84  # per-nm density from per-eV
    return spd / (spd.sum() * DL)


class Exponential:
    law = "exponential"

    def __init__(self, weights, taus):
        self.w, self.tau = np.array(weights, float), np.array(taus, float)

    def F(self, tau, xp=np):
        t = xp.maximum(tau, 0.0)
        out = 1.0 + 0.0 * t
        for w, k in zip(self.w, self.tau):
            out = out - w * xp.exp(-t / k)
        return xp.where(tau > 0, out, 0.0 * t)

    def I(self, tau):
        r = sum(w / k * np.exp(-tau / k) for w, k in zip(self.w, self.tau))
        return r / sum(w / k for w, k in zip(self.w, self.tau))


class Hyperbolic:
    law = "hyperbolic"

    def __init__(self, t0, n):
        assert n > 1, "n <= 1 carries infinite energy"
        self.t0, self.n = float(t0), float(n)

    def F(self, tau, xp=np):
        t = xp.maximum(tau, 0.0)
        return xp.where(tau > 0, 1.0 - xp.exp(-(self.n - 1) * xp.log1p(t / self.t0)), 0.0 * t)

    def I(self, tau):
        return (1 + tau / self.t0) ** -self.n


class Kuhn:
    """Kuhn 2002 eqs. 8-10 (tools/measured data/p22_kuhn2002.json). The power law of green and blue is
    measured to 10 ms (the span of his Fig. 3); t_cut stops it there, so F counts only light inside the
    measured span. With n = 1.1 an uncut tail would hold 37% of the green energy past 100 ms, which is an
    extrapolation the measurement does not support."""
    law = "kuhn"

    def __init__(self, colour, t_cut=1e-2):
        m = _load_measured("p22_kuhn2002")["model"][colour]
        self.exps = [(e["a"], 2 * math.pi * e["f_hz"]) for e in m["exp"]]
        p = m.get("power")
        self.power = (p["A"], p["t0_s"], p["n"]) if p else None
        self.t_cut = float(t_cut)
        self.total = self._E(self.t_cut, np)

    def _E(self, t, xp):
        t = xp.minimum(xp.maximum(t, 0.0), self.t_cut)
        e = 0.0 * t
        for a, k in self.exps:
            e = e + a / k * (1.0 - xp.exp(-k * t))
        if self.power:
            A, t0, n = self.power
            e = e + A / (n - 1) * (t0 ** (1 - n) - xp.exp((1 - n) * xp.log(t + t0)))
        return e

    def F(self, tau, xp=np):
        return xp.where(tau > 0, self._E(tau, xp) / self.total, 0.0 * tau)

    def I(self, tau):
        s = sum(a * np.exp(-k * tau) for a, k in self.exps)
        if self.power:
            A, t0, n = self.power
            s = s + np.where(tau <= self.t_cut, A * (tau + t0) ** -n, 0.0)
        return s / self.I0()

    def I0(self):
        s = sum(a for a, _ in self.exps)
        if self.power:
            A, t0, n = self.power
            s += A * t0 ** -n
        return s

    def power_t_to(self, level):
        """Time for the power-law term alone to fall to level of its value at tau = 0."""
        A, t0, n = self.power
        return t0 * (level ** (-1.0 / n) - 1.0)


LN10 = math.log(10.0)
SQ10 = math.sqrt(10.0) - 1.0

# Sources. Grades: high (standard or several agreeing measurements), moderate (one measurement in
# the right context, or two that agree), low (one value out of context, or from memory).
SOURCES = {
    "ast": "Applied Scintillation Technologies phosphor table (www-group.slac.stanford.edu/tf/nlcta/"
           "PEP-LER/AST - Phosphors.htm): 10% decay Y2O2S:Eu 850 us, ZnS:Cu,Al 35 us, ZnS:Ag 80 us. "
           "Scintillator context; ZnS:Ag listed as P11.",
    "patent": "US 5,825,124 (1998), conventional phosphors, time to 1/100: Y2O2S:Eu 1.9 ms, "
              "ZnS:Cu,Al 7.5 ms, ZnS:Ag 7.0 ms. CRT context.",
    "kuhn2002": "Kuhn 2002, IEEE S&P, eqs. 8-10: impulse response of one P22 monitor measured with a "
                "photomultiplier, sum of exponentials (red) and power law n = 1.10 / 1.11 plus exponentials "
                "(green, blue); Fig. 3 reproduces the equations within 1% (tools/measured). Power law cut at "
                "10 ms, the measured span. Independent check: RCA TPM-1508A (1961) 10% times for ZnS:Cu "
                "(P31, about 38 us) and ZnS:Ag (P11, 34 us) match the power-law terms (39 and 35 us).",
    "raw-native": "raw-native web/shaders/crt/phosphors.mjs p22 two-exponential fits, low confidence "
                  "by its own CONSTANTS.md.",
    "spectra": "Eu3+ 5D0->7FJ line positions (595, 616, 626, 704 nm) and the 5D1 line near 538 nm; "
               "ZnS:Cu,Al band near 530 nm, ZnS:Ag near 450 nm. Line positions moderate; relative line "
               "weights low (from memory). Band shapes are fitted, not measured: green 539.5 nm, "
               "83.5 nm FWHM to the SMPTE C green (0.310, 0.595); blue peak held at 450 nm with "
               "67 nm FWHM to y = 0.060.",
    "efficiency": "Cathodoluminescent energy efficiency: Y2O2S:Eu about 0.13, ZnS:Cu,Al about 0.17, "
                  "ZnS:Ag about 0.21. Low (from memory, handbook order of magnitude).",
}


def decay_preset(name):
    """[red, green, blue] decay laws."""
    if name == "patent":
        return [Exponential([1.0], [1.9e-3 / (2 * LN10)]),
                Hyperbolic(7.5e-3 / 9.0, 2.0), Hyperbolic(7.0e-3 / 9.0, 2.0)]
    if name == "ast":
        return [Exponential([1.0], [850e-6 / LN10]),
                Hyperbolic(35e-6 / SQ10, 2.0), Hyperbolic(80e-6 / SQ10, 2.0)]
    if name == "kuhn2002":
        return [Kuhn("red"), Kuhn("green"), Kuhn("blue")]
    if name == "raw-native":
        return [Exponential([1.0, 0.0], [0.35e-3, 1e-3]), Exponential([0.9, 0.1], [20e-6, 0.5e-3]),
                Exponential([0.95, 0.05], [5e-6, 0.2e-3])]
    raise KeyError(name)


GRADES = {"kuhn2002": "moderate (one measured CRT, CRT context; power-law t10 corroborated by RCA 1961)",
          "patent": "low (green, blue: the 1/100 times cannot be reproduced by the one measured CRT curve)",
          "ast": "low (scintillator context)", "raw-native": "low (its own grading)"}


# Two real P22 red hosts (Kuhn 2002 notes the P22 red varies across the EIA triples). Line positions
# moderate, relative weights low (from memory); neither set is a measured spectrum yet (MEASURE.md M6).
RED = {
    "Y2O2S:Eu": [(626, 1.0), (616, 0.55), (595, 0.12), (586, 0.04), (704, 0.12), (538, 0.04)],
    "Y2O3:Eu": [(611, 1.0), (631, 0.15), (599, 0.06), (593, 0.06), (587, 0.05), (707, 0.05)],
}


def p22(decay="kuhn2002", red="Y2O2S:Eu"):
    eu = line_spectrum(RED[red])
    return {
        "names": [f"{red} (P22 red)", "ZnS:Cu,Al (P22 green)", "ZnS:Ag (P22 blue)"],
        "spd": np.stack([eu, band_spectrum(539.5, 83.5), band_spectrum(450, 67)]),
        "eta": np.array([0.13, 0.17, 0.21]),
        "decay": decay_preset(decay),
        "decay_name": decay,
        "red_host": red,
        "grade": GRADES[decay],
    }


def times_to(law, level, t_max=1.0):
    """First tau with I(tau) <= level, by bisection on a log grid (for the known-answer tests)."""
    lo, hi = 1e-12, t_max
    for _ in range(200):
        mid = math.sqrt(lo * hi)
        if law.I(mid) > level:
            lo = mid
        else:
            hi = mid
    return hi


def two_point_hyperbola(t10, t100):
    """The (t0, n) of the hyperbola through I = 0.1 at t10 and 0.01 at t100. n <= 1 means the two
    measurements cannot both hold for a finite-energy recombination law."""
    t0 = t10 * t10 / (t100 - 2 * t10)
    return t0, LN10 / math.log1p(t10 / t0)
