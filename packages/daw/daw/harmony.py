# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Tension and consonance from an instrument's own partials, voice-leading distance, and tension as pitch.

Roughness of two partials (Plomp and Levelt 1965, in Sethares' parametric form, Sethares 1993 and the book
Tuning, Timbre, Spectrum, Scale): d = min(a1, a2) (exp(-b1 s df) - exp(-b2 s df)), s = x* / (s1 f_low + s2),
with x* = 0.24, s1 = 0.0207, s2 = 18.96, b1 = 3.51, b2 = 5.75 (constants from memory, high confidence). The
dissonance of a timbre against itself at interval r sums d over every pair of partials of the two notes; its
local minima are the intervals that suit that timbre. A harmonic timbre gives the just intervals; a free bar
gives its own inharmonic ratios.
Voice leading: the distance between two chords is the smallest total semitone motion over every pairing of
voices (Tymoczko 2006, the L1 voice-leading norm). Tension as pitch: a string or membrane under tension T
rings in proportion to sqrt(T / mu), so tension is a live control of pitch.
"""
import itertools
import math

import numpy as np

XSTAR, S1, S2, B1, B2 = 0.24, 0.0207, 18.96, 3.51, 5.75


def pair_roughness(f1, f2, a1, a2):
    lo, df = np.minimum(f1, f2), np.abs(f2 - f1)
    s = XSTAR / (S1 * lo + S2)
    return np.minimum(a1, a2) * (np.exp(-B1 * s * df) - np.exp(-B2 * s * df))


def dissonance(freqs, amps, r):
    """Total roughness of the timbre sounded with itself transposed by ratio r."""
    f = np.concatenate([freqs, np.asarray(freqs) * r])
    a = np.concatenate([amps, amps])
    i, j = np.triu_indices(len(f), 1)
    return float(pair_roughness(f[i], f[j], a[i], a[j]).sum())


def curve(freqs, amps, r_lo=1.0, r_hi=2.3, n=6000):
    rs = np.linspace(r_lo, r_hi, n)
    return rs, np.array([dissonance(freqs, amps, r) for r in rs])


def minima(freqs, amps, r_lo=1.0, r_hi=2.3, n=6000, depth=0.0):
    """Local minima of the dissonance curve (interior points lower than both neighbours)."""
    rs, d = curve(freqs, amps, r_lo, r_hi, n)
    k = np.flatnonzero((d[1:-1] < d[:-2]) & (d[1:-1] < d[2:])) + 1
    return rs[k], d[k]


def cents(r):
    return 1200.0 * math.log2(r)


def voice_leading(a, b):
    """Smallest total motion in semitones from chord a to chord b (same size), over all voice pairings."""
    return min(sum(abs(x - y) for x, y in zip(a, p)) for p in itertools.permutations(b))


def string_pitch(tension, mu, length):
    return math.sqrt(tension / mu) / (2 * length)
