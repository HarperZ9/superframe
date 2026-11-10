# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Equality of an implementation with the reference, kernel by kernel.

Each suite walks the whole domain where it is finite (every cell of the historical figures, with a border
of rejected coordinates around them) and adds a fixed-seed sample where it is not. A suite returns
(cases, mismatches). Floats are compared by their bits.
"""
import struct
from itertools import product

from . import MAX_PARTS, reference

SAMPLE_SEED = 177517721872   # the three publication years; recorded so a run can be repeated
M64 = (1 << 64) - 1


class Rng:
    """xorshift64: a small generator with a published recurrence, so any language can replay the sample."""

    def __init__(self, seed):
        self.s = (seed & M64) or 1

    def next(self):
        s = self.s
        s ^= (s << 13) & M64
        s ^= s >> 7
        s ^= (s << 17) & M64
        self.s = s
        return s

    def below(self, n):
        return self.next() % n

    def span(self, lo, hi):
        return lo + self.below(hi - lo + 1)


def _bits(value):
    if isinstance(value, tuple):
        return tuple(_bits(v) for v in value)
    return struct.pack("<d", value) if isinstance(value, float) else value


class Tally:
    def __init__(self, impl):
        self.impl, self.cases, self.mismatches, self.first = impl, 0, 0, None

    def call(self, name, *args):
        self.cases += 1
        got, want = getattr(self.impl, name)(*args), getattr(reference, name)(*args)
        if _bits(got) != _bits(want):
            self.mismatches += 1
            self.first = self.first or (name, args, got, want)

    def result(self):
        return self.cases, self.mismatches


def mayer(impl, sample=4000):
    t = Tally(impl)
    for n in range(-2, 30):
        t.call("mayer_count", n)
    for n in (MAX_PARTS - 1, MAX_PARTS, MAX_PARTS + 1):
        t.call("mayer_count", n)
    for n in range(1, 25):                       # every cell for 1 to 24 parts, with a rejected border
        for row, col in product(range(-1, n + 2), repeat=2):
            t.call("mayer_mix", n, row, col)
            t.call("mayer_index", n, row, col)
        for index in range(-1, (n + 1) * (n + 2) // 2 + 1):
            t.call("mayer_cell", n, index)
    rng = Rng(SAMPLE_SEED)
    for _ in range(sample):
        n = rng.span(-1, MAX_PARTS + 1)
        row, col = rng.span(-2, max(n, 0) + 2), rng.span(-2, max(n, 0) + 2)
        t.call("mayer_mix", n, row, col)
        t.call("mayer_index", n, row, col)
        t.call("mayer_cell", n, rng.span(-2, (max(n, 0) + 1) * (max(n, 0) + 2) // 2 + 1))
    return t


def lambert(impl):
    t = Tally(impl)
    t.call("lambert_total")
    for tier in range(-3, 12):
        t.call("lambert_side", tier)
        t.call("lambert_count", tier)
    for tier, row, col in product(range(-1, 10), range(-1, 11), range(-1, 11)):   # all 108 cells and a border
        t.call("lambert_mix", tier, row, col)
    return t


def _benson_sample(t, rng, count):
    for _ in range(count):
        n = rng.span(-1, MAX_PARTS + 1)
        top = max(n, 0) + 1
        p = [rng.span(-1, top) for _ in range(6)]
        t.call("benson_section", n, rng.span(-1, 3), p[0], p[1], p[2])
        t.call("benson_complement", n, p[0], p[1], p[2])
        t.call("benson_corner", n, rng.below(2) * n, rng.below(2) * n, p[2])
        steps = rng.span(0, 12)
        t.call("benson_line", n, p[:3], p[3:], steps, rng.span(-1, steps + 1))
        t.call("modern_benson_linear_rgb", n, p[0], p[1], p[2])


def benson(impl, sample=4000):
    t = Tally(impl)
    for n in list(range(-2, 12)) + [MAX_PARTS, MAX_PARTS + 1]:
        t.call("benson_count", n)
    for n in range(1, 7):                        # every lattice point for 1 to 6 steps, with a rejected border
        for r, g, b in product(range(-1, n + 2), repeat=3):
            t.call("benson_complement", n, r, g, b)
            t.call("benson_corner", n, r, g, b)
            for axis in range(-1, 4):
                t.call("benson_section", n, axis, r, g, b)
    for n in (1, 2, 3):                          # every line between two lattice points, 1 to 4 steps
        points = list(product(range(n + 1), repeat=3))
        for a, b, steps in product(points, points, range(1, 5)):
            for k in range(steps + 1):
                t.call("benson_line", n, a, b, steps, k)
    _benson_sample(t, Rng(SAMPLE_SEED + 1), sample)
    return t


def modern(impl, sample=4000):
    t = Tally(impl)
    for n in range(1, 17):
        for r, g, b in product(range(-1, n + 2), repeat=3):
            t.call("modern_benson_linear_rgb", n, r, g, b)
    rng = Rng(SAMPLE_SEED + 2)
    for _ in range(sample):
        n = rng.span(1, MAX_PARTS)
        t.call("modern_benson_linear_rgb", n, rng.span(0, n), rng.span(0, n), rng.span(0, n))
    return t


SUITES = {"mayer": mayer, "lambert": lambert, "benson": benson, "modern": modern}
