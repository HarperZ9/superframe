# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Equalisers, minimum phase and linear phase.

Minimum phase: RBJ cookbook biquads (peaking, low and high shelf, high and low pass) cascaded as second-order
sections. Linear phase: the same target magnitude (or any curve, such as a reference match) sampled on a dense
grid, turned into a symmetric FIR by the inverse FFT and a Kaiser window, applied by FFT convolution with its
(N - 1) / 2 delay removed. A band is (kind, freq_hz, gain_db, q).
"""
import math

import numpy as np
from scipy.signal import sosfilt, sosfreqz

from .kernels import fir


def biquad(kind, f0, gain_db, q, fs):
    """One RBJ section as a normalised sos row."""
    a_lin = 10 ** (gain_db / 40)
    w0 = 2 * math.pi * f0 / fs
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2 * q)
    if kind == "peak":
        b = [1 + alpha * a_lin, -2 * cw, 1 - alpha * a_lin]
        a = [1 + alpha / a_lin, -2 * cw, 1 - alpha / a_lin]
    elif kind in ("lowshelf", "highshelf"):
        s = 2 * math.sqrt(a_lin) * alpha
        sign = 1 if kind == "lowshelf" else -1
        b = [a_lin * ((a_lin + 1) - sign * (a_lin - 1) * cw + s), sign * 2 * a_lin * ((a_lin - 1) - sign * (a_lin + 1) * cw),
             a_lin * ((a_lin + 1) - sign * (a_lin - 1) * cw - s)]
        a = [(a_lin + 1) + sign * (a_lin - 1) * cw + s, -sign * 2 * ((a_lin - 1) + sign * (a_lin + 1) * cw),
             (a_lin + 1) + sign * (a_lin - 1) * cw - s]
    elif kind == "highpass":
        b = [(1 + cw) / 2, -(1 + cw), (1 + cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    elif kind == "lowpass":
        b = [(1 - cw) / 2, 1 - cw, (1 - cw) / 2]
        a = [1 + alpha, -2 * cw, 1 - alpha]
    else:
        raise ValueError(f"unknown band kind {kind}")
    return np.array(b + a) / a[0]


def sos(bands, fs):
    return np.array([biquad(k, f, g, q, fs) for k, f, g, q in bands]) if bands else np.zeros((0, 6))


def response_db(bands, fs, freqs):
    """Magnitude response of the cascade at `freqs`, dB."""
    if not bands:
        return np.zeros(len(freqs))
    _, h = sosfreqz(sos(bands, fs), worN=np.asarray(freqs, float), fs=fs)
    return 20 * np.log10(np.maximum(np.abs(h), 1e-300))


def minimum_phase(y, bands, fs):
    if not bands:
        return np.asarray(y, np.float64).copy()
    return sosfilt(sos(bands, fs), np.asarray(y, np.float64), axis=-1)


def fir_from_curve(freqs, gains_db, fs, taps=8191, beta=8.0):
    """Symmetric (linear-phase) FIR whose magnitude follows the curve; `freqs` ascending, interpolated in log f."""
    n_fft = 1 << int(math.ceil(math.log2(taps * 4)))
    grid = np.fft.rfftfreq(n_fft, 1 / fs)
    lf = np.log10(np.maximum(grid, 1.0))
    g = np.interp(lf, np.log10(np.maximum(np.asarray(freqs, float), 1.0)), np.asarray(gains_db, float))
    mag = 10 ** (g / 20)
    h = np.fft.irfft(mag, n_fft)                      # zero phase, centred at 0
    h = np.roll(h, taps // 2)[:taps]
    return h * np.kaiser(taps, beta)


def linear_phase_bands(bands, fs, taps=8191):
    """The biquad cascade's magnitude as a linear-phase FIR."""
    f = np.geomspace(5.0, fs / 2, 2048)
    return fir_from_curve(f, response_db(bands, fs, f), fs, taps)


def apply_fir(y, h):
    """Convolve along the last axis and remove the (N - 1) / 2 delay so the output lines up with the input."""
    y = np.asarray(y, np.float64)
    d = (len(h) - 1) // 2
    full = fir(y, h)
    return full[..., d:d + y.shape[-1]]


def linear_phase(y, bands, fs, taps=8191):
    if not bands:
        return np.asarray(y, np.float64).copy()
    return apply_fir(y, linear_phase_bands(bands, fs, taps))
