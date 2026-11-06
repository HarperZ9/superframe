# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Wind held to measured storm spectra: turbulent noise with the recordings' spectral slope, plus aeolian tones.

The broadband part is seeded Gaussian noise shaped in frequency so its power falls as f^-beta, with beta taken
from a measured storm recording (packages/measured, storm_spectra.json). Wind past a twig, a needle or a wire
sheds vortices at f = St U / d (nature.aeolian_frequency); gusts move U slowly, so the tone wanders and swells
with U^2 (the dynamic pressure). The howling-wind recording peaks at 187.5 Hz, which a 2 cm branch in a
18.75 m/s wind gives at St = 0.2.
"""
import math

import numpy as np

from . import nature


def coloured_noise(n, fs, beta, rng, f_lo=20.0):
    """Gaussian noise with power spectral density proportional to f^-beta above f_lo (flat below)."""
    spec = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1.0 / fs)
    spec *= np.maximum(f, f_lo) ** (-beta / 2)
    y = np.fft.irfft(spec, n)
    return y / np.max(np.abs(y))


def gusts(n, fs, mean, spread, rng, period=3.0):
    """A slowly varying wind speed: mean plus smoothed noise with a correlation time near `period` seconds."""
    k = max(2, int(n / (period * fs)) + 2)
    knots = mean + spread * rng.standard_normal(k)
    return np.maximum(np.interp(np.linspace(0, k - 1, n), np.arange(k), knots), 0.1)


def aeolian(u, d, fs, q=40.0):
    """A whistle that follows the wind: a phase-accumulated sine at St U / d, amplitude U^2, softened by Q."""
    f = nature.aeolian_frequency(u, d)
    phase = 2 * math.pi * np.cumsum(f) / fs
    return (u / u.max()) ** 2 * np.sin(phase) * (1 - 1 / q)


def wind(seconds, fs, beta, rng, mean=18.75, spread=1.0, diameter=0.02, tone=0.1):
    """Storm wind: f^-beta noise plus the aeolian tone of a branch of the given diameter."""
    n = int(seconds * fs)
    u = gusts(n, fs, mean, spread, rng)
    y = coloured_noise(n, fs, beta, rng) + (tone * aeolian(u, diameter, fs) if tone else 0.0)
    return y / np.max(np.abs(y))
