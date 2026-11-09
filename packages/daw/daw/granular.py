# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Granular cloud and spectral freeze (gap G11): any buffer turned into a floating texture.

Cloud. Grains are short Hann-windowed slices of the source, read at a position that moves through the source
(scan, in source seconds per output second) with seeded jitter, resampled by a per-grain pitch ratio (spread in
cents, seeded), and overlap-added at a seeded rate (density, grains per second, Poisson). Each grain also gets a
seeded pan, so the cloud is stereo. Grain size sets the texture: long grains (100 to 300 ms) keep pitch and
sound smeared; short ones (under 30 ms) turn into noise. The output is normalised to unit RMS over its sounding
part, so density does not set the level.
Freeze. One moment of the source held forever: the magnitude spectrum of a frame at `at` seconds, resynthesised
frame after frame with phases that advance at each bin's instantaneous frequency (from the phase change over one
hop, as in a phase vocoder), so a partial between bins keeps its true frequency, plus a small seeded random walk
(the walk, `blur`, keeps the freeze from sounding like a static loop; blur 0 is a pure phase-advance freeze).
Partials keep their frequencies; the test reads them back.
"""
import math

import numpy as np


def _grain(src, fs, start, size, ratio):
    n = int(size * fs)
    idx = start * fs + np.arange(n) * ratio
    i0 = np.floor(idx).astype(int)
    ok = (i0 >= 0) & (i0 + 1 < len(src))
    fr = idx - i0
    g = np.zeros(n)
    g[ok] = src[i0[ok]] * (1 - fr[ok]) + src[i0[ok] + 1] * fr[ok]
    return g * np.hanning(n)


def cloud(src, fs, seconds, rng, density=30.0, size=0.12, position=0.0, scan=0.0, jitter=0.2, spread=0.0,
          pan_spread=0.6):
    """A stereo (n, 2) grain cloud from mono `src`. position, jitter in source seconds; spread in cents."""
    src = np.asarray(src, float)
    n = int(seconds * fs)
    out = np.zeros((n + int(size * fs) * 4 + 2, 2))
    t = 0.0
    while True:
        t += rng.exponential(1.0 / density)
        if t >= seconds:
            break
        start = position + scan * t + rng.uniform(-jitter, jitter)
        ratio = 2 ** (rng.uniform(-spread, spread) / 1200.0)
        g = _grain(src, fs, max(0.0, start), size, ratio)
        th = (rng.uniform(-pan_spread, pan_spread) + 1) * math.pi / 4
        i = int(t * fs)
        out[i:i + len(g), 0] += g * math.cos(th)
        out[i:i + len(g), 1] += g * math.sin(th)
    out = out[:n]
    live = np.abs(out).sum(1) > 0
    rms = math.sqrt(float(np.mean(out[live] ** 2))) if np.any(live) else 1.0
    return out / max(rms, 1e-12)


def freeze(src, fs, at, seconds, rng, nfft=8192, blur=0.15):
    """Hold the spectrum at `at` seconds for `seconds` (mono). Hann frames at 1/4 overlap, overlap-added with the
    window-sum normalisation, so a steady input comes back at its own level."""
    src = np.asarray(src, float)
    hop = nfft // 4
    i = int(at * fs)
    seg = src[i:i + nfft]
    if len(seg) < nfft:
        seg = np.pad(seg, (0, nfft - len(seg)))
    win = np.hanning(nfft + 1)[:-1]
    spec = np.fft.rfft(seg * win)
    nxt = src[i + hop:i + hop + nfft]
    nxt = np.pad(nxt, (0, nfft - len(nxt))) if len(nxt) < nfft else nxt
    w = 2 * math.pi * np.arange(len(spec)) / nfft
    d = np.angle(np.fft.rfft(nxt * win)) - np.angle(spec) - w * hop
    advance = w * hop + (d - 2 * math.pi * np.round(d / (2 * math.pi)))   # each bin's own frequency, per hop
    mag = np.abs(spec)
    n = int(seconds * fs)
    frames = n // hop + 4
    out = np.zeros(frames * hop + nfft)
    norm = np.zeros_like(out)
    phase = np.angle(spec)                                    # start coherent, from the source frame itself
    for k in range(frames):
        y = np.fft.irfft(mag * np.exp(1j * phase), nfft) * win
        out[k * hop:k * hop + nfft] += y
        norm[k * hop:k * hop + nfft] += win * win
        phase = phase + advance + blur * rng.standard_normal(len(mag))
    out = out / np.maximum(norm, 1e-9)
    return out[nfft:nfft + n]
