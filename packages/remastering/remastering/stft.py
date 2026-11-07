# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""STFT, inverse STFT, a phase vocoder, and time and pitch operations that keep formants.

STFT: periodic Hann, centred frames (padded by n_fft / 2 with reflection), inverse by weighted overlap-add divided
by the summed squared window, so istft(stft(x)) == x to rounding at any hop up to n_fft / 2.
Phase vocoder (Laroche and Dolson 1999, identity phase locking): each bin's phase advances by its measured
instantaneous frequency times the synthesis hop; bins near a peak keep the peak's phase offset.
Formant keeping: the spectral envelope is the cepstrally smoothed log magnitude (lifter at ~1.5 ms quefrency);
a pitch shift moves the fine structure and then re-imposes the original envelope at the original frequencies.
"""
from fractions import Fraction

import numpy as np
import scipy.fft as sfft

from .resample import resample


def stft(x, n_fft=2048, hop=512):
    x = np.asarray(x, np.float64)
    pad = n_fft // 2
    xp = np.pad(x, pad, mode="reflect") if len(x) > pad else np.pad(x, pad)
    n_frames = 1 + max(0, (len(xp) - n_fft) // hop)
    need = (n_frames - 1) * hop + n_fft
    if need > len(xp):
        xp = np.pad(xp, (0, need - len(xp)))
    idx = np.arange(n_fft)[None, :] + hop * np.arange(n_frames)[:, None]
    w = np.hanning(n_fft + 1)[:-1]
    return sfft.rfft(xp[idx] * w, axis=1, workers=-1).T            # (bins, frames)


def istft(S, n_fft=2048, hop=512, length=None):
    w = np.hanning(n_fft + 1)[:-1]
    frames = sfft.irfft(np.ascontiguousarray(S.T), n_fft, axis=1, workers=-1) * w
    F = frames.shape[0]
    k = n_fft // hop
    if k * hop == n_fft:                                   # hop divides the frame: overlap-add by shifted blocks
        blocks = frames.reshape(F, k, hop)
        out = np.zeros((F + k - 1, hop))
        norm = np.zeros((F + k - 1, hop))
        wb = (w * w).reshape(k, hop)
        for j in range(k):
            out[j:j + F] += blocks[:, j]
            norm[j:j + F] += wb[j]
        out, norm = out.reshape(-1), norm.reshape(-1)
    else:
        n = (F - 1) * hop + n_fft
        out, norm = np.zeros(n), np.zeros(n)
        for i in range(F):
            out[i * hop:i * hop + n_fft] += frames[i]
            norm[i * hop:i * hop + n_fft] += w * w
    out = out / np.maximum(norm, 1e-12)
    out = out[n_fft // 2:]
    if length is not None:
        out = out[:length] if len(out) >= length else np.pad(out, (0, length - len(out)))
    return out


def envelope(mag, n_fft, lifter_bins=None, fs=44100):
    """Cepstrally smoothed log-magnitude envelope per frame (bins, frames)."""
    lifter_bins = lifter_bins or max(8, int(0.0015 * fs))
    c = np.fft.irfft(np.log(mag + 1e-9), n_fft, axis=0)
    c[lifter_bins:-lifter_bins] = 0
    return np.exp(np.fft.rfft(c, n_fft, axis=0).real)


def phase_vocoder(S, rate, hop):
    """Time-scale an STFT by `rate` (2 = twice as fast). Returns the new STFT."""
    n_bins, n_frames = S.shape
    n_fft = 2 * (n_bins - 1)
    steps = np.arange(0, n_frames - 1, rate)
    omega = 2 * np.pi * hop * np.arange(n_bins) / n_fft
    mag, ph = np.abs(S), np.angle(S)
    out = np.zeros((n_bins, len(steps)), complex)
    acc = ph[:, 0].copy()
    for k, t in enumerate(steps):
        i = int(t)
        a = t - i
        m = (1 - a) * mag[:, i] + a * mag[:, i + 1]
        out[:, k] = m * np.exp(1j * acc)
        dphi = ph[:, i + 1] - ph[:, i] - omega
        dphi -= 2 * np.pi * np.round(dphi / (2 * np.pi))
        acc += omega + dphi
    return _lock_phase(out)


def _lock_phase(S):
    """Identity phase locking: every bin takes the phase of its nearest spectral peak plus the original offset."""
    mag = np.abs(S)
    out = S.copy()
    for k in range(S.shape[1]):
        m = mag[:, k]
        pk = np.where((m[1:-1] > m[:-2]) & (m[1:-1] >= m[2:]))[0] + 1
        if len(pk) < 2:
            continue
        bounds = (pk[1:] + pk[:-1]) // 2
        owner = np.searchsorted(bounds, np.arange(len(m)))
        ph_peak = np.angle(S[pk, k])
        out[:, k] = m * np.exp(1j * ph_peak[owner])
    return out


def time_stretch(x, rate, n_fft=2048, hop=512):
    S = stft(x, n_fft, hop)
    return istft(phase_vocoder(S, rate, hop), n_fft, hop, int(round(len(x) / rate)))


def pitch_shift(x, fs, semitones, keep_formants=True, n_fft=2048, hop=512):
    """Shift pitch by `semitones` at constant duration; with keep_formants the spectral envelope stays put."""
    r = 2 ** (semitones / 12)
    stretched = time_stretch(x, 1 / r, n_fft, hop)
    f = Fraction(r).limit_denominator(240)            # ratio error under 0.05 cent
    y = resample(stretched, f.numerator * 100, f.denominator * 100, atten_db=110.0) if r != 1 else stretched
    y = y[: len(x)] if len(y) >= len(x) else np.pad(y, (0, len(x) - len(y)))
    if not keep_formants:
        return y
    Sx, Sy = stft(x, n_fft, hop), stft(y, n_fft, hop)
    n = min(Sx.shape[1], Sy.shape[1])
    ex, ey = envelope(np.abs(Sx[:, :n]), n_fft, fs=fs), envelope(np.abs(Sy[:, :n]), n_fft, fs=fs)
    return istft(Sy[:, :n] * ex / np.maximum(ey, 1e-9), n_fft, hop, len(x))
