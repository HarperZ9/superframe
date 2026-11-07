# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Per-layer refinement: denoise, de-bleed against the other stems, resample.

Denoise: the noise level per frequency bin comes from the 10th percentile of the magnitude over time. For a
stationary noise bin the magnitude is Rayleigh, whose 10th percentile is 0.3246 sigma, so sigma = p10 / 0.3246
(an overestimate where music never leaves a bin). The gain is the decision-directed Wiener gain (Ephraim and
Malah 1984, smoothing 0.98) floored at g_min.
De-bleed: each stem's STFT gets a soft mask |S_i|^p / sum_j |S_j|^p computed from all stems, so energy that a stem
shares with a louder stem is handed to that stem; the masks sum to 1, so the stems still sum to the mix.
"""
import numpy as np

from .resample import resample
from .stft import istft, stft

N_FFT, HOP = 4096, 1024


def noise_profile(mag, pct=10.0):
    return np.percentile(mag, pct, axis=1)


def denoise(y, fs, strength=1.0, floor_db=-18.0, profile=None, dd=0.98):
    """Returns (denoised, noise sigma per bin). `profile` (bins,) may come from a known noise-only stretch."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    specs = [stft(ch, N_FFT, HOP) for ch in y]
    mono = np.abs(sum(specs)) / len(specs)
    sigma = noise_profile(mono) / 0.3246 if profile is None else profile
    nvar = strength * sigma[:, None] ** 2 + 1e-30                       # noise power in the channel mean
    post = mono ** 2 / nvar
    g = np.empty_like(mono)
    prev = np.ones(mono.shape[0])
    gmin = 10 ** (floor_db / 20)
    for t in range(mono.shape[1]):
        prio = dd * prev ** 2 * post[:, max(t - 1, 0)] + (1 - dd) * np.maximum(post[:, t] - 1, 0)
        g[:, t] = np.maximum(prio / (1 + prio), gmin)
        prev = g[:, t]
    out = np.stack([istft(S * g, N_FFT, HOP, y.shape[1]) for S in specs])
    return out, sigma


def debleed(stems, power=2.0):
    """{name: (channels, n)} -> the same keys with soft-masked stems that still sum to the input sum."""
    names = list(stems)
    n = stems[names[0]].shape[1]
    out = {k: np.zeros_like(stems[k]) for k in names}
    for c in range(stems[names[0]].shape[0]):
        S = {k: stft(stems[k][c], N_FFT, HOP) for k in names}
        P = {k: np.abs(S[k]) ** power for k in names}
        tot = sum(P.values()) + 1e-20
        mix = sum(S.values())
        for k in names:
            out[k][c] = istft(mix * (P[k] / tot), N_FFT, HOP, n)
    return out


def to_rate(y, fs, fs_out):
    return resample(y, fs, fs_out)
