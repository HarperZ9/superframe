# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Pitch on the hexagonal Tonnetz: fifths, major thirds and minor thirds as the three axes.

A pitch class k (semitones mod 12) is reached by i fifths and j major thirds when
7 i + 4 j = k (mod 12). On the triangular lattice spanned by the fifth and the major third,
with the minor third as the third axis (P5 - M3, the step (1, -1)), the step distance of (i, j)
is (|i| + |j| + |i + j|) / 2, the hexagonal metric. The Tonnetz distance of an interval is the
least such distance over all (i, j) that spell it.
"""


def tonnetz_distance(k, reach=12):
    k %= 12
    best = None
    for i in range(-reach, reach + 1):
        for j in range(-reach, reach + 1):
            if (7 * i + 4 * j - k) % 12 == 0:
                d = (abs(i) + abs(j) + abs(i + j)) // 2
                best = d if best is None or d < best else best
    return best


def semitone_distance(k, folded=False):
    """Distance on the semitone line: k itself, or min(k, 12 - k) when folded (inversion-equivalent)."""
    k %= 12
    return min(k, 12 - k) if folded else k
