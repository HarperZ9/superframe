# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sounds of nature by physics, first pieces: the aeolian tone, the bubble, and frequency scaling that keeps
a measured spectrum's ratios.

Aeolian tone: a cylinder of diameter d in wind U sheds vortices at f = St U / d, with St near 0.2 for
Reynolds numbers from about 300 to 2e5 (Strouhal 1878; the 0.2 plateau from memory, high confidence).
Minnaert bubble: a gas bubble of radius a in a liquid of density rho at pressure p0 rings at
f = sqrt(3 gamma p0 / rho) / (2 pi a) (Minnaert 1933). The formula, gamma (1.40, the 1976 standard atmosphere),
p0 (the CODATA standard atmosphere) and rho (NIST water at 20 C) all come from packages/wavelab, so the DAW and
the wave lab cannot drift apart; tests/test_voice_nature.py cross-checks rho against the Kaye and Laby row.
Sonification of a spectrum measured elsewhere (light, stellar oscillation, a chirp) multiplies every
frequency by one factor, so every ratio, and so every interval, is kept exactly.
"""

import numpy as np

from . import PKG  # noqa: F401  (sets sys.path for measured and wavelab)
from wavelab import bubble, consts

STROUHAL_CYLINDER = 0.2
GAMMA_AIR = consts.air()["gamma"]
P_STANDARD = consts.ATM


def aeolian_frequency(wind, diameter, strouhal=STROUHAL_CYLINDER):
    return strouhal * wind / diameter


def minnaert_frequency(radius, p0=P_STANDARD, gamma=GAMMA_AIR, rho=None):
    """wavelab.bubble.minnaert without surface tension; rho defaults to NIST water at 20 C."""
    return bubble.minnaert(radius, kappa=gamma, p0=p0, sigma=0.0, rho=rho if rho else consts.water(293.15)["rho"])


def sonify(freqs, lowest_hz):
    """Scale a spectrum so its lowest line sits at lowest_hz; returns the scaled lines and the factor."""
    f = np.asarray(freqs, float)
    k = lowest_hz / f.min()
    return f * k, k


def wavelength_to_frequency(wavelength_m, speed):
    return speed / np.asarray(wavelength_m, float)
