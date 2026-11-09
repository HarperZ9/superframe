# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""An electronic kit (gap G13): an 808-style bass drum, hats from small plate modes and band-passed noise, and
a roll generator.

Bass drum. The analogue voice is a bridged-T resonator struck by a short pulse; it rings as a damped sine whose
pitch falls from a higher start as the circuit settles. Modelled here as that sine with an exponential pitch
glide, f(t) = f_end + (f_start - f_end) exp(-t / glide_tau), and an exponential amplitude decay with T60
`decay`. An optional soft click (a raised cosine of `click_ms`) is the strike. Phase is the running integral
of f, so the glide is smooth. For a gentle kit the click is left out and the attack is a few milliseconds.
Hat. The modes of a small brass rectangular plate (shapes_2d.RectPlate, measured brass) above 3 kHz, struck,
plus seeded noise band-passed around `tone` Hz, under a decay of `decay` seconds (closed short, open long).
Rolls. roll() writes notes for 1/8 to 1/32 subdivisions over a span, with a velocity ramp, on exact beats;
the tests read back the onset times within 1 ms.
"""
import math

import numpy as np
from scipy.signal import butter, sosfilt

from . import materials as M
from .arrange import Note
from .shapes_2d import RectPlate
from .synth import render


def bass_drum(fs, seconds=1.5, f_start=120.0, f_end=48.0, glide_tau=0.04, decay=1.2, click_ms=0.0,
              attack_ms=3.0):
    n = int(seconds * fs)
    t = np.arange(n) / fs
    f = f_end + (f_start - f_end) * np.exp(-t / glide_tau)
    y = np.sin(2 * math.pi * np.cumsum(f) / fs) * np.exp(-6.9078 * t / decay)
    if attack_ms > 0:
        m = int(attack_ms * fs / 1000)
        y[:m] *= 0.5 * (1 - np.cos(math.pi * np.arange(m) / m))
    if click_ms > 0:
        m = int(click_ms * fs / 1000)
        y[:m] += 0.3 * 0.5 * (1 - np.cos(2 * math.pi * np.arange(m) / m))
    return y / np.max(np.abs(y))


def hat(fs, rng, seconds=0.4, decay=0.06, tone=8000.0, plate_mix=0.5):
    n = int(seconds * fs)
    plate = RectPlate(M.material("brass"), 0.05, 0.04, 0.0008)
    modes = plate.modes()
    y = render(modes, fs, seconds, (0.31, 0.27), (0.7, 0.62), "strike", 2e-4)[:n]
    y = np.pad(y, (0, n - len(y)))                     # synth.render rounds the length; the noise uses int()
    sos = butter(2, (tone / 1.5, min(tone * 1.5, 0.45 * fs)), "bandpass", fs=fs, output="sos")
    noise = sosfilt(sos, rng.standard_normal(n))
    noise /= np.max(np.abs(noise))
    t = np.arange(n) / fs
    env = np.exp(-6.9078 * t / decay)
    out = (plate_mix * y / max(np.max(np.abs(y)), 1e-12) + (1 - plate_mix) * noise) * env
    out = sosfilt(butter(6, 4000.0, "highpass", fs=fs, output="sos"), out)   # only the plate's upper modes
    return out / np.max(np.abs(out))


def roll(start, span, division=16, pitch=60, v0=0.3, v1=0.6, beats_per_bar=4):
    """Notes every 1/division of a bar from beat `start` for `span` beats, velocity ramping v0 to v1."""
    step = beats_per_bar / division
    k = int(round(span / step))
    return [Note(start + i * step, step, pitch, v0 + (v1 - v0) * (i / max(k - 1, 1))) for i in range(k)]


def decay_time(y, fs, smooth_ms=0.0):
    """T60 from the envelope: a line fitted to the dB envelope between -5 and -35 dB of its peak. The envelope is
    the analytic signal's magnitude, or for noisy sounds (a hat) the energy smoothed over smooth_ms."""
    from scipy.ndimage import uniform_filter1d
    from scipy.signal import hilbert
    if smooth_ms > 0:
        env = 10 * np.log10(np.maximum(uniform_filter1d(y * y, max(1, int(smooth_ms * fs / 1000))), 0) + 1e-24)
    else:
        env = 20 * np.log10(np.abs(hilbert(y)) + 1e-12)
    env -= env.max()
    t = np.arange(len(y)) / fs
    i0 = int(np.argmax(env))
    i1 = i0 + int(np.argmax(env[i0:] < -35))              # the first fall through -35 dB (the end has edge effects)
    sel = np.zeros(len(y), bool)
    sel[i0:i1] = env[i0:i1] < -5
    return -60.0 / np.polyfit(t[sel], env[sel], 1)[0]


def instantaneous_frequency(y, fs):
    from scipy.signal import hilbert
    ph = np.unwrap(np.angle(hilbert(y)))
    return np.diff(ph) * fs / (2 * math.pi)
