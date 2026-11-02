# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sound channel of a blend: spectral-envelope interpolation, resynthesised with random phase.

Each source contributes its mean log-magnitude spectrum (detuned by a per-source shift in cents)
and its tempo. The output is noise shaped by the weighted envelope, pulsed at the weighted tempo
with attack and release times, and passed through a feedback comb for reverb. No sample of any
source waveform reaches the output; only the averaged envelope and the tempo do.
"""
import numpy as np
from scipy.signal import lfilter

from . import audiofeat

N, HOP = 2048, 512


def envelope(x, sr):
    S = audiofeat.stft_mag(x, N, HOP)
    return np.log(S.mean(0) + 1e-9)


def render(sources_audio, weights, detune_cents, knobs, seed, sr=22050, seconds=8.0):
    rng = np.random.default_rng(seed)
    env = np.zeros(N // 2 + 1)
    tempo = 0.0
    bins = np.arange(N // 2 + 1, dtype=float)
    for (x, xsr), w, cents in zip(sources_audio, weights, detune_cents):
        e = envelope(x, xsr)
        ratio = 2 ** (cents / 1200.0)
        env += w * np.interp(bins / ratio, bins, e)
        t, _ = audiofeat._tempo(np.maximum(0, np.diff(np.log1p(audiofeat.stft_mag(x)), axis=0)).sum(1), xsr / HOP)
        tempo += w * (t or 100.0)
    mag = np.exp(env - env.max())
    n_frames = int(seconds * sr / HOP) + 4
    out = np.zeros(n_frames * HOP + N)
    win = np.hanning(N)
    temp = float(knobs.get("temperature", 0.0))
    for k in range(n_frames):
        ph = np.exp(2j * np.pi * rng.random(len(mag)))
        m = mag * (1 + temp * rng.normal(0, 0.3, len(mag)))
        out[k * HOP:k * HOP + N] += np.fft.irfft(m * ph, N) * win
    t = np.arange(len(out)) / sr
    beat = 60.0 / max(tempo, 30.0)
    phase = (t % beat) / beat
    att, rel = max(1e-3, 0.02 + float(knobs.get("attack", 0.0)) * 0.3), 0.1 + float(knobs.get("release", 0.0)) * 0.5
    pulse = np.minimum(1, phase * beat / att) * np.exp(-np.maximum(0, phase * beat - att) / rel)
    y = out * (0.3 + 0.7 * pulse)
    if knobs.get("reverb", 0.0):
        d, g = int(0.043 * sr), float(knobs.get("reverb_decay", 0.5)) * float(knobs["reverb"])
        a = np.zeros(d + 1)
        a[0], a[d] = 1.0, -g
        y = lfilter([1.0], a, y)
    y = y[:int(seconds * sr)]
    y = y / (np.abs(y).max() + 1e-12) * 0.8 * float(knobs.get("gain", 1.0))
    return np.clip(y, -1, 1), {"tempo_bpm": round(tempo, 2)}
