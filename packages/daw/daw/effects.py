# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Volume swell, tremolo and feedback delay, and an analyser that reads their settings back from the sound.

swell(x, attack): gain rises linearly from 0 to 1 over `attack` seconds. tremolo(x, rate, depth): gain
1 - depth / 2 + depth / 2 sin(2 pi rate t). delay(x, time, feedback, mix): the signal plus echoes every
`time` seconds, each `feedback` times the last, scaled by `mix`.
The analyser works on the amplitude envelope: the tremolo rate is the strongest envelope frequency between
2 and 30 Hz, returned with the ratio of its peak to the band's median so an absent tremolo shows as a low ratio; the attack is the 10 to 90 percent rise of the envelope smoothed over one tremolo period, over
0.8 (a linear ramp spends 80 percent of its length between those levels); the delay time is the strongest
peak, from 50 ms to 1 s, of the autocorrelation of the envelope after the tremolo is divided out.
"""
import math

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import hilbert


def swell(x, fs, attack):
    g = np.minimum(1.0, np.arange(len(x)) / (attack * fs))
    return x * g


def tremolo(x, fs, rate, depth=0.5):
    t = np.arange(len(x)) / fs
    return x * (1 - depth / 2 + depth / 2 * np.sin(2 * math.pi * rate * t))


def delay(x, fs, time, feedback=0.4, mix=0.5, echoes=8):
    d, y = int(round(time * fs)), x.copy()
    for k in range(1, echoes + 1):
        if k * d >= len(x):
            break
        y[k * d:] += mix * feedback ** (k - 1) * x[:len(x) - k * d]
    return y


def envelope(y, fs, smooth=0.005):
    return uniform_filter1d(np.abs(hilbert(y)), max(1, int(smooth * fs)))


def tremolo_rate(y, fs):
    e = envelope(y, fs)
    e = e / np.maximum(uniform_filter1d(e, int(0.5 * fs)), 1e-12) - 1
    n = 8 * len(e)
    sp, fr = np.abs(np.fft.rfft(e * np.hanning(len(e)), n)), np.fft.rfftfreq(n, 1 / fs)
    band = (fr > 2) & (fr < 30)
    k = int(np.argmax(np.where(band, sp, 0)))
    a, b, c = np.log(sp[k - 1:k + 2])
    rate = (k + 0.5 * (a - c) / (a - 2 * b + c)) * fs / n
    return rate, float(sp[k] / np.median(sp[band]))     # the rate and how far its peak stands out


def attack_time(y, fs, rate):
    e = uniform_filter1d(envelope(y, fs), max(1, int(round(fs / rate))))
    peak = e.max()
    i10 = int(np.argmax(e >= 0.1 * peak))
    i90 = int(np.argmax(e >= 0.9 * peak))
    return (i90 - i10) / fs / 0.8


def delay_time(y, fs, rate=None, lo=0.05, hi=1.0):
    """Echo spacing from the envelope autocorrelation; returns (seconds, peak height relative to lag 0)."""
    e = envelope(y, fs, 0.002)
    if rate:
        e = e / np.maximum(1 - 0.25 + 0.25 * np.sin(2 * math.pi * rate * np.arange(len(e)) / fs), 1e-3)
    e = e - uniform_filter1d(e, int(0.25 * fs))
    n = 1 << int(np.ceil(np.log2(2 * len(e))))
    ac = np.fft.irfft(np.abs(np.fft.rfft(e, n)) ** 2)[:len(e)]
    a, b = int(lo * fs), int(hi * fs)
    k = a + int(np.argmax(ac[a:b]))
    return k / fs, float(ac[k] / ac[0])


# Tape echo read-back (H185): echo spacing, echo gain and transport flutter, from the sound alone.

def echo_spacing(y, fs, lo=0.03, hi=1.0):
    """Echo period of a single-head echo train: the strongest peak of the signal's own autocorrelation
    between lo and hi seconds, refined by a parabola through the peak and its neighbours."""
    n = 1 << int(np.ceil(np.log2(2 * len(y))))
    ac = np.fft.irfft(np.abs(np.fft.rfft(y, n)) ** 2)[:len(y)]
    a, b = int(lo * fs), int(hi * fs)
    k = a + int(np.argmax(ac[a:b]))
    p, q, r = ac[k - 1:k + 2]
    return (k + 0.5 * (p - r) / (p - 2 * q + r)) / fs


def echo_gain(y, fs, period, width=0.012, count=4):
    """Feedback gain of an echo train: the median ratio of successive echo amplitudes (root energy in a
    window around each echo). The first echo is the reference, so the dry level does not enter."""
    e = y ** 2
    t0 = int(np.argmax(np.abs(y[:int(period * fs * 0.9)])))     # the dry event
    w = int(width * fs)
    amp = []
    for k in range(1, count + 2):
        c = t0 + int(round(k * period * fs))
        if c + w >= len(y):
            break
        amp.append(math.sqrt(e[c - w:c + w].sum()))
    return float(np.median([amp[i + 1] / amp[i] for i in range(len(amp) - 1)]))


def flutter(y, fs, lo=0.2, hi=40.0, trim=0.25):
    """Pitch modulation of a steady tone: instantaneous frequency from the analytic signal, as a
    relative deviation from its median; the strongest rate between lo and hi Hz (zero-padded spectrum,
    parabolic peak) and its depth from a least-squares sine fit at that rate. Returns (rate, depth,
    prominence of the peak over the band median)."""
    ph = np.unwrap(np.angle(hilbert(y)))
    fi = np.diff(ph) * fs / (2 * math.pi)
    c = int(trim * fs)
    fi = fi[c:-c]
    rel = fi / np.median(fi) - 1
    rel = rel - rel.mean()
    n = 1 << int(np.ceil(np.log2(16 * len(rel))))
    sp = np.abs(np.fft.rfft(rel * np.hanning(len(rel)), n))
    fr = np.fft.rfftfreq(n, 1 / fs)
    band = (fr > lo) & (fr < hi)
    k = int(np.argmax(np.where(band, sp, 0)))
    a, b, cc = np.log(sp[k - 1:k + 2])
    rate = (k + 0.5 * (a - cc) / (a - 2 * b + cc)) * fs / n
    t = np.arange(len(rel)) / fs
    A = np.stack([np.sin(2 * math.pi * rate * t), np.cos(2 * math.pi * rate * t)], 1)
    coef = np.linalg.lstsq(A, rel, rcond=None)[0]
    return float(rate), float(math.hypot(*coef)), float(sp[k] / np.median(sp[band]))
