# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A sampler over our own renders (gap G10): slice, chop to a grid, pitch, stretch, reverse, gate, loop.

Provenance first. A Sample is a mono buffer and the sha256 of the file it came from; load() refuses a file
whose hash does not match the one the caller names, and every slice carries the source hash and its own
start and end in source samples. The intent is that sources are our own renders and recordings: the piece's
receipt lists every source hash, so anyone can check where a sound came from. Nothing here reads a
third-party file on its own; what goes in is the caller's responsibility, and the hash makes it auditable.

Pitch: varispeed (tape: pitch and time together) or a phase-vocoder shift that keeps duration
(spectral.stretch then spectral.varispeed). Stretch: the phase vocoder. Chop: equal slices on a beat grid
(division per bar), each with short fades so no slice starts with a click.
"""
import hashlib
from dataclasses import dataclass, field

import numpy as np
import soundfile as sf

from . import spectral


def file_sha256(path):
    with open(path, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()


@dataclass(frozen=True)
class Sample:
    data: np.ndarray = field(repr=False)
    fs: int
    source_sha256: str
    start: int = 0                       # in source samples
    end: int = None

    def provenance(self):
        return {"source_sha256": self.source_sha256, "start": self.start,
                "end": self.end if self.end is not None else self.start + len(self.data)}


def load(path, sha256, channel=None):
    """Load a WAV or FLAC as mono (mean of channels, or one channel). Refuses a hash mismatch."""
    got = file_sha256(path)
    if got != sha256:
        raise ValueError(f"{path}: sha256 {got[:12]} does not match the named source {sha256[:12]}")
    y, fs = sf.read(str(path), dtype="float64", always_2d=True)
    mono = y[:, channel] if channel is not None else y.mean(1)
    return Sample(mono, fs, sha256, 0, len(mono))


def _with(s, data, start=None, end=None):
    return Sample(np.asarray(data, float), s.fs, s.source_sha256, s.start if start is None else start,
                  s.start + len(data) if end is None else end)


def fade(x, fs, ms=4.0):
    m = min(len(x) // 2, int(ms * fs / 1000))
    if m < 1:
        return x
    r = 0.5 * (1 - np.cos(np.pi * np.arange(m) / m))
    y = x.copy()
    y[:m] *= r
    y[-m:] *= r[::-1]
    return y


def slice_(s, t0, t1, fade_ms=4.0):
    i0, i1 = int(t0 * s.fs), int(t1 * s.fs)
    return _with(s, fade(s.data[i0:i1], s.fs, fade_ms), s.start + i0, s.start + i1)


def chop(s, bpm, bars, division=8, offset=0.0, fade_ms=3.0):
    """Equal slices on a grid: `division` slices per 4/4 bar, `bars` bars, from `offset` seconds."""
    step = 240.0 / bpm / division
    return [slice_(s, offset + k * step, offset + (k + 1) * step, fade_ms) for k in range(bars * division)]


def pitch(s, semitones, keep_time=True):
    r = 2.0 ** (semitones / 12.0)
    if keep_time:
        y = spectral.varispeed(spectral.stretch(s.data, r), r)
        y = y[: len(s.data)] if len(y) >= len(s.data) else np.pad(y, (0, len(s.data) - len(y)))
    else:
        y = spectral.varispeed(s.data, r)
    return _with(s, y, s.start, s.end)


def stretch(s, factor):
    return _with(s, spectral.stretch(s.data, factor), s.start, s.end)


def reverse(s):
    return _with(s, fade(s.data[::-1], s.fs), s.start, s.end)


def gate(s, bpm, pattern, fade_ms=3.0):
    """Multiply by an on/off pattern of sixteenth notes (a string like 'x.x.xx..'), repeated."""
    step = int(15.0 / bpm * s.fs)
    g = np.zeros(len(s.data))
    for k in range(0, len(g), step):
        if pattern[(k // step) % len(pattern)] == "x":
            g[k:k + step] = fade(np.ones(min(step, len(g) - k)), s.fs, fade_ms)
    return _with(s, s.data * g, s.start, s.end)


def loop(s, seconds, crossfade_ms=20.0):
    """Repeat to `seconds` with an equal-power crossfade at each seam."""
    n, m = int(seconds * s.fs), int(crossfade_ms * s.fs / 1000)
    x = s.data
    out = np.zeros(n + len(x))
    pos = 0
    a = np.sin(0.5 * np.pi * np.arange(m) / max(m, 1))
    while pos < n:
        seg = x.copy()
        if pos > 0 and m:
            seg[:m] *= a
            out[pos:pos + m] *= a[::-1]
        out[pos:pos + len(seg)] += seg
        pos += len(x) - m
    return _with(s, out[:n], s.start, s.end)


def peak_frequency(x, fs, lo=50.0, hi=4000.0):
    sp = np.abs(np.fft.rfft(x * np.hanning(len(x)), 1 << 20))
    f = np.fft.rfftfreq(1 << 20, 1 / fs)
    band = (f > lo) & (f < hi)
    return float(f[band][np.argmax(sp[band])])
