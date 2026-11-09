# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Read a voice back: pitch, a pitch track, vibrato, formants and the harmonics-to-noise ratio.

These are the instruments the voice tests hold the processors to, so each is a standard method with a known
failure mode. Pitch of a steady tone: the peak of a zero-padded Hann spectrum, refined by a parabola through
the three log-magnitude bins at the top. Pitch track: YIN, the first dip
of the cumulative-mean-normalised difference function, moved to a whole multiple of that lag when the multiple is
clearly more periodic (a strong harmonic under a formant), refined the same way, with frames that jump a whole
octave from their neighbours' median folded back. Vibrato: rate from the spectrum of the cents track, depth (peak deviation in cents) from a least-
squares sinusoid at that rate. Formants: linear prediction (autocorrelation method, Levinson recursion) on the
signal at 10 kHz after pre-emphasis; each pole pair with a bandwidth under 500 Hz is a formant (Markel and Gray
1976). HNR: harmonic energy in narrow bands at multiples of f0 against the noise density between them, with the
noise that falls inside the bands subtracted.
"""
import math

import numpy as np
from scipy.signal import resample_poly


def cents(f, ref):
    return 1200.0 * math.log2(f / ref)


def _parabola(a, b, c):
    d = a - 2 * b + c
    return 0.0 if d == 0 else 0.5 * (a - c) / d


def f0_peak(y, fs, lo, hi, pad=8):
    """Frequency of the strongest spectral peak between lo and hi Hz."""
    n = pad * len(y)
    sp = np.log(np.abs(np.fft.rfft(y * np.hanning(len(y)), n)) + 1e-12)
    fr = np.fft.rfftfreq(n, 1.0 / fs)
    band = np.flatnonzero((fr > lo) & (fr < hi))
    k = band[int(np.argmax(sp[band]))]
    return float((k + _parabola(sp[k - 1], sp[k], sp[k + 1])) * fs / n)


def _yin(f, a, b, threshold):
    """Lag of the first dip of the cumulative-mean-normalised difference under threshold (else the deepest)."""
    W = len(f) // 2
    x0 = f[:W]
    e = np.concatenate([[0.0], np.cumsum(f * f)])
    corr = np.fft.irfft(np.fft.rfft(f, 2 * len(f)) * np.conj(np.fft.rfft(x0, 2 * len(f))))[:W]
    tau = np.arange(W)
    d = e[W] + (e[tau + W] - e[tau]) - 2 * corr
    cm = np.ones(W)
    cm[1:] = d[1:] * tau[1:] / np.maximum(np.cumsum(d[1:]), 1e-30)
    below = np.flatnonzero(cm[a:b] < threshold)
    if len(below):
        k = a + below[0]
        while k + 1 < b and cm[k + 1] < cm[k]:
            k += 1
    else:
        k = a + int(np.argmin(cm[a:b]))
    best, kb = cm[k], k
    for m in (2, 3, 4):
        lo, hi = m * k - 2, min(m * k + 3, b)
        if lo >= b:
            break
        j = lo + int(np.argmin(cm[lo:hi]))
        if cm[j] < best - 0.02:          # a whole multiple of the lag is clearly more periodic: the true period
            best, kb = cm[j], j
    return kb, cm


def f0_track(y, fs, lo=70.0, hi=1100.0, win=0.04, hop=0.005, threshold=0.15, voicing=0.35):
    """Pitch every `hop` seconds by YIN (de Cheveigne and Kawahara 2002); NaN where the frame is not periodic."""
    n, h = int(win * fs), int(hop * fs)
    a, b = max(2, int(fs / hi)), min(int(fs / lo), n // 2 - 2)
    out = []
    for s in range(0, len(y) - n, h):
        f = y[s:s + n] - np.mean(y[s:s + n])
        if not np.any(f):
            out.append(np.nan)
            continue
        k, cm = _yin(f, a, b, threshold)
        out.append(np.nan if cm[k] > voicing else fs / (k + _parabola(cm[k - 1], cm[k], cm[k + 1])))
    return fold_octaves(np.array(out))


def fold_octaves(track, span=41):
    """Move a frame by whole octaves when it sits an octave or two from the median of its neighbours: a strong
    second harmonic under a formant can make one stretch of frames read at twice the pitch."""
    out = track.copy()
    good = np.isfinite(track)
    for i in np.flatnonzero(good):
        nb = track[max(0, i - span // 2):i + span // 2 + 1]
        nb = nb[np.isfinite(nb)]
        r = math.log2(track[i] / np.median(nb))
        m = round(r)
        if m and abs(r - m) < 0.1:
            out[i] = track[i] / 2.0 ** m
    return out


def vibrato(track, hop=0.005, lo=2.0, hi=12.0):
    """(rate Hz, depth in cents peak) of the modulation in a pitch track."""
    t = np.isfinite(track)
    c = 1200 * np.log2(track[t] / np.median(track[t]))
    c = c - np.polyval(np.polyfit(np.arange(len(c)), c, 1), np.arange(len(c)))
    n = 16 * len(c)
    sp = np.abs(np.fft.rfft(c * np.hanning(len(c)), n))
    fr = np.fft.rfftfreq(n, hop)
    band = np.flatnonzero((fr > lo) & (fr < hi))
    k = band[int(np.argmax(sp[band]))]
    rate = float((k + _parabola(*np.log(sp[k - 1:k + 2] + 1e-12))) / (n * hop))
    tt = np.arange(len(c)) * hop
    A = np.column_stack([np.sin(2 * math.pi * rate * tt), np.cos(2 * math.pi * rate * tt)])
    s, co = np.linalg.lstsq(A, c, rcond=None)[0]
    return rate, float(math.hypot(s, co))


def lpc(x, order):
    r = np.correlate(x, x, "full")[len(x) - 1:len(x) + order]
    a, e = np.array([1.0]), r[0]
    for i in range(1, order + 1):
        k = -(r[i] + np.dot(a[1:], r[i - 1:0:-1])) / e
        a = np.concatenate([a, [0.0]]) + k * np.concatenate([a, [0.0]])[::-1]
        e *= 1 - k * k
    return a


def formants(y, fs, order=12, rate=10000, max_bw=500.0):
    """Formant frequencies (Hz, ascending) of a steady voiced segment."""
    g = math.gcd(int(fs), rate)
    x = resample_poly(np.asarray(y, float), rate // g, int(fs) // g)
    x = np.append(x[0], x[1:] - 0.97 * x[:-1]) * np.hamming(len(x))
    roots = [z for z in np.roots(lpc(x, order)) if z.imag > 0]
    out = []
    for z in roots:
        f = math.atan2(z.imag, z.real) * rate / (2 * math.pi)
        bw = -rate / math.pi * math.log(abs(z))
        if 90 < f < rate / 2 - 50 and bw < max_bw:
            out.append(f)
    return sorted(out)


def hnr(y, fs, f0, half=3.0):
    """Harmonics-to-noise ratio in dB of a steady tone at f0 (half: band half-width in Hz)."""
    p = np.abs(np.fft.rfft(y * np.hanning(len(y)))) ** 2
    fr = np.fft.rfftfreq(len(y), 1.0 / fs)
    m = np.abs(fr / f0 - np.round(fr / f0)) * f0 <= half
    m &= (fr > 0.5 * f0) & (fr < fs / 2 - f0)
    rest = (~m) & (fr > 0.5 * f0) & (fr < fs / 2 - f0)
    noise_density = p[rest].mean()
    harm = p[m].sum() - noise_density * m.sum()
    noise = noise_density * (m.sum() + rest.sum())
    return 10 * math.log10(max(harm, 1e-30) / noise)
