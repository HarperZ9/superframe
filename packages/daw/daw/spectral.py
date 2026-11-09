# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Short-time Fourier tools for processing a voice: the transform pair, a phase vocoder, the true envelope and
varispeed.

The STFT is centred (half a frame of zeros on each side), with a periodic Hann window and a hop of a quarter
frame; the inverse divides by the summed squared window, so stft then istft returns the input to rounding.
The phase vocoder (Flanagan and Golden 1966; Laroche and Dolson 1999 for identity phase locking) changes
duration and keeps pitch: each output frame takes its magnitude from the input at a fractional frame
position, and its phase from the accumulated instantaneous frequency of the nearest spectral peak, so the
phase relations around a partial survive. The true envelope (Roebel and Rodet 2005) is an iterated cepstral
smoothing that rides the tops of the harmonics instead of their average; its cepstral order fs / (2 f0) is the
order that just resolves the harmonic spacing. Varispeed is tape or turntable speed: pitch and duration move
together, by polyphase resampling at a rational ratio.
"""
import math
from fractions import Fraction

import numpy as np
from scipy.signal import resample_poly

N_FFT, HOP = 2048, 512


def _window(n):
    return 0.5 - 0.5 * np.cos(2 * math.pi * np.arange(n) / n)


def stft(x, n=N_FFT, hop=HOP):
    """Frames of the centred, windowed signal as rows of rfft bins."""
    w = _window(n)
    pad = np.concatenate([np.zeros(n // 2), np.asarray(x, float), np.zeros(n)])
    frames = 1 + (len(pad) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
    return np.fft.rfft(pad[idx] * w, axis=1)


def istft(X, length, n=N_FFT, hop=HOP):
    """Weighted overlap-add back to `length` samples."""
    w = _window(n)
    frames = np.fft.irfft(X, n, axis=1) * w
    total = n + hop * (len(frames) - 1)
    out, norm = np.zeros(total), np.zeros(total)
    for i, f in enumerate(frames):
        out[i * hop:i * hop + n] += f
        norm[i * hop:i * hop + n] += w * w
    out = out / np.maximum(norm, 1e-3)
    out = out[n // 2:n // 2 + length]
    return np.pad(out, (0, length - len(out)))


def _lock(mag, phase_acc, orig_phase):
    """Identity phase locking: every bin keeps its phase offset from the nearest peak in the input frame."""
    pk = np.flatnonzero((mag[1:-1] >= mag[:-2]) & (mag[1:-1] > mag[2:])) + 1
    if len(pk) == 0:
        return phase_acc
    edges = np.concatenate([[0], (pk[:-1] + pk[1:] + 1) // 2, [len(mag)]])
    owner = np.repeat(pk, np.diff(edges))
    return phase_acc[owner] + orig_phase - orig_phase[owner]


def stretch(x, factor, n=N_FFT, hop=HOP):
    """Duration times `factor` at the same pitch (phase vocoder with identity phase locking)."""
    X = stft(x, n, hop)
    X = np.vstack([X, np.zeros((1, X.shape[1]))])
    omega = 2 * math.pi * hop * np.arange(X.shape[1]) / n
    steps = np.arange(0, len(X) - 1, 1.0 / factor)
    acc = np.angle(X[0]).copy()
    out = np.empty((len(steps), X.shape[1]), complex)
    for t, s in enumerate(steps):
        i, a = int(s), s - int(s)
        mag = (1 - a) * np.abs(X[i]) + a * np.abs(X[i + 1])
        out[t] = mag * np.exp(1j * _lock(mag, acc, np.angle(X[i])))
        d = np.angle(X[i + 1]) - np.angle(X[i]) - omega
        acc = acc + omega + (d - 2 * math.pi * np.round(d / (2 * math.pi)))
    return istft(out, int(round(len(x) * factor)), n, hop)


def varispeed(x, ratio, limit=4000):
    """Play `ratio` times faster: pitch times ratio, duration over ratio (rational ratio, limit on the denominator)."""
    r = Fraction(ratio).limit_denominator(limit)
    return resample_poly(np.asarray(x, float), r.denominator, r.numerator)


def true_envelope(mag, order, iters=12):
    """Spectral envelope per frame (rows of magnitudes) that passes through the harmonic peaks."""
    mag = np.atleast_2d(mag)
    n = 2 * (mag.shape[1] - 1)
    log = np.log(np.maximum(mag, 1e-12))
    a, env = log.copy(), log
    for _ in range(iters):
        c = np.fft.irfft(a, n, axis=1)
        c[:, order:n - order + 1] = 0.0
        env = np.fft.rfft(c, n, axis=1).real
        a = np.maximum(log, env)
    return np.exp(env)


def warp(env, ratio):
    """Envelope with every feature moved by `ratio` along frequency: E'(f) = E(f / ratio)."""
    k = np.arange(env.shape[1], dtype=float)
    return np.vstack([np.interp(k / ratio, k, row, right=row[-1]) for row in env])


def estimate_f0(x, fs, lo=60.0, hi=1000.0):
    """Median of frame-wise autocorrelation peaks over the voiced frames (a hint for the envelope order)."""
    n, hop = int(0.04 * fs), int(0.02 * fs)
    est = []
    for s in range(0, max(1, len(x) - n), hop):
        f = x[s:s + n] - np.mean(x[s:s + n])
        if np.sqrt(np.mean(f * f)) < 1e-4 * (np.max(np.abs(x)) + 1e-12):
            continue
        r = np.fft.irfft(np.abs(np.fft.rfft(f, 2 * n)) ** 2)[:n]
        a, b = int(fs / hi), min(int(fs / lo), n - 1)
        if r[0] <= 0 or b <= a:
            continue
        k = a + int(np.argmax(r[a:b]))
        if r[k] > 0.3 * r[0]:
            est.append(fs / k)
    return float(np.median(est)) if est else 150.0
