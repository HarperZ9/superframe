# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sounds of nature by physics, first pieces: the aeolian tone, the bubble, and frequency scaling that keeps
a measured spectrum's ratios.

Aeolian tone: a cylinder of diameter d in wind U sheds vortices at f = St U / d, with St near 0.2 for
Reynolds numbers from about 300 to 2e5 (Strouhal 1878; the 0.2 plateau from memory, high confidence).
Minnaert bubble: a gas bubble of radius a in a liquid of density rho at pressure p0 rings at
f = sqrt(3 gamma p0 / rho) / (2 pi a) (Minnaert 1933). gamma is 7/5 for air (ideal diatomic gas), p0 the
standard atmosphere 101 325 Pa (defined), rho water at 20 C from Kaye and Laby.
Sonification of a spectrum measured elsewhere (light, stellar oscillation, a chirp) multiplies every
frequency by one factor, so every ratio, and so every interval, is kept exactly.
"""
import math

import numpy as np

from . import materials as M

STROUHAL_CYLINDER = 0.2
GAMMA_AIR = 7.0 / 5.0
P_STANDARD = 101325.0  # Pa, defined


def aeolian_frequency(wind, diameter, strouhal=STROUHAL_CYLINDER):
    return strouhal * wind / diameter


def minnaert_frequency(radius, p0=P_STANDARD, gamma=GAMMA_AIR, rho=None):
    rho = rho if rho else M.row("water.rho20")["value"]
    return math.sqrt(3 * gamma * p0 / rho) / (2 * math.pi * radius)


def sonify(freqs, lowest_hz):
    """Scale a spectrum so its lowest line sits at lowest_hz; returns the scaled lines and the factor."""
    f = np.asarray(freqs, float)
    k = lowest_hz / f.min()
    return f * k, k


def wavelength_to_frequency(wavelength_m, speed):
    return speed / np.asarray(wavelength_m, float)
