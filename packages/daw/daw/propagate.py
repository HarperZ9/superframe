# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sound in space: delay, spreading, air absorption, Doppler, and how a mode radiates.

Positions are metres in one world frame; time is the sample clock. A point source at distance r arrives
after r / c, its pressure falls as 1 / r (intensity as 1 / r^2), and the air takes alpha(f) r dB on the way.
alpha(f) follows ISO 9613-1 (1993), the formula of the standard as published in its clause 6, with its
reference values T0 = 293.15 K, T01 = 273.16 K and p_r = 101.325 kPa; the coefficients are from memory
(high confidence) and are checked in the tests against the Kaye and Laby table computed from the standard.
A moving source is heard at time t from the emission time tau that solves t = tau + |x_L - x_S(tau)| / c,
solved by fixed-point iteration, then read from the source signal by linear interpolation; for steady
approach at speed v this gives the Doppler factor c / (c - v).
"""
import math

import numpy as np

T0, T01, PR_KPA = 293.15, 273.16, 101.325


def iso9613_alpha(f, celsius=20.0, rh=50.0, kpa=101.325):
    """Pure-tone absorption of air, dB per metre, at frequency f (Hz)."""
    f = np.asarray(f, float)
    T, pa = celsius + 273.15, kpa / PR_KPA
    psat = 10.0 ** (-6.8346 * (T01 / T) ** 1.261 + 4.6151)
    h = rh * psat / pa
    fro = pa * (24.0 + 4.04e4 * h * (0.02 + h) / (0.391 + h))
    frn = pa * (T / T0) ** -0.5 * (9.0 + 280.0 * h * math.exp(-4.170 * ((T / T0) ** (-1.0 / 3.0) - 1.0)))
    classical = 1.84e-11 / pa * (T / T0) ** 0.5
    oxygen = 0.01275 * math.exp(-2239.1 / T) / (fro + f ** 2 / fro)
    nitrogen = 0.1068 * math.exp(-3352.0 / T) / (frn + f ** 2 / frn)
    return 8.686 * f ** 2 * (classical + (T / T0) ** -2.5 * (oxygen + nitrogen))


def distance(a, b):
    return float(np.linalg.norm(np.asarray(a, float) - np.asarray(b, float)))


def static_path(x, fs, src, lis, c, air=None, r_ref=1.0):
    """Signal x emitted at src, heard at lis: integer-plus-fraction delay, 1/r gain re r_ref, optional air
    absorption (a dict of celsius, rh, kpa) applied as a zero-phase gain per FFT bin."""
    r = distance(src, lis)
    delay = r / c * fs
    n = len(x) + int(math.ceil(delay)) + 1
    t = np.arange(n) - delay
    xp = np.concatenate([[0.0], x, [0.0]])        # silence before and after, so the first sample interpolates
    y = np.interp(t, np.arange(-1, len(x) + 1), xp, left=0.0, right=0.0) * (r_ref / r)
    if air:
        spec = np.fft.rfft(y)
        fr = np.fft.rfftfreq(n, 1.0 / fs)
        spec *= 10.0 ** (-iso9613_alpha(fr, **air) * r / 20.0)
        y = np.fft.irfft(spec, n)
    return y, delay


def moving_path(x, fs, trajectory, lis, c, n_out, iters=8):
    """Signal x emitted by a source on trajectory(tau) -> position (vectorised over tau), heard at lis."""
    t = np.arange(n_out) / fs
    tau = t.copy()
    L = np.asarray(lis, float)
    for _ in range(iters):
        r = np.linalg.norm(trajectory(tau) - L[None, :], axis=1)
        tau = t - r / c
    r = np.linalg.norm(trajectory(tau) - L[None, :], axis=1)
    y = np.interp(tau * fs, np.arange(len(x)), x, left=0.0, right=0.0) / np.maximum(r, 1e-3)
    return y, tau


def doppler_factor(c, v_toward):
    """Frequency ratio heard from a source approaching a still listener at speed v_toward."""
    return c / (c - v_toward)


def volume_velocity(mode_image, cell_area):
    """Net volume velocity of a mode (its shape summed over the surface): nonzero radiates as a monopole at
    low frequency; zero means the first nonzero moment (dipole, quadrupole) sets the far field."""
    img = np.nan_to_num(np.asarray(mode_image, float))
    return float(img.sum() * cell_area)


def rect_mode_volume_velocity(m, n):
    """Closed form for sin(m pi x) sin(n pi y) on the unit square: (1 - (-1)^m)(1 - (-1)^n) / (m n pi^2)."""
    return (1 - (-1) ** m) * (1 - (-1) ** n) / (m * n * math.pi ** 2)


def zero_cross_frequency(y, fs):
    """Frequency from the mean period between rising zero crossings, with linear interpolation."""
    y = np.asarray(y, float)
    s = np.signbit(y)
    idx = np.flatnonzero(s[:-1] & ~s[1:])
    tz = idx + y[idx] / (y[idx] - y[idx + 1])
    return fs / np.mean(np.diff(tz))
