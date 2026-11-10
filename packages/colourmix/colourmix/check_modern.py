# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Equality suites for the modern readings: the Benson cube as RGB, and the named RGB spaces.

Floats are compared by their bits. Inputs stay within a bounded range: a finite input large enough to
overflow gives infinity or not-a-number, and the bits of those are outside the contract.
"""
from itertools import product

from . import MAX_PARTS

NAN, INF = float("nan"), float("inf")
ODD = (NAN, INF, -INF, -0.0, 0.0, 1.0, -1e-300, 1.0000000000000002, 5e-324)
JOINTS = (0.0031308, 0.04045, 0.0181, 0.08145, 0.08124)   # where the transfer curves change branch


def unit(rng):
    """A float in 0 to 1 with 53 random bits, exact in any language: an integer over 2 to the 53."""
    return (rng.next() >> 11) / float(1 << 53)


def modern(impl, sample=4000):
    """The Benson cube under every mapping: unnamed linear, XYZ of a named space, encoded RGB."""
    from .check import SAMPLE_SEED, Rng, Tally
    t = Tally(impl)
    for n in range(1, 17):
        for r, g, b in product(range(-1, n + 2), repeat=3):
            t.call("modern_benson_linear_rgb", n, r, g, b)
    for n in (0, 1, 3, 6):                       # every lattice point with a border, every name and one beyond
        for r, g, b in product(range(-1, n + 2), repeat=3):
            for space in range(-1, 4):
                t.call("modern_benson_encoded", space, n, r, g, b)
                for white in range(-1, 3):
                    t.call("modern_benson_xyz", space, white, n, r, g, b)
    rng = Rng(SAMPLE_SEED + 2)
    for _ in range(sample):
        n = rng.span(1, MAX_PARTS)
        p = (rng.span(0, n), rng.span(0, n), rng.span(0, n))
        t.call("modern_benson_linear_rgb", n, *p)
        t.call("modern_benson_xyz", rng.below(3), rng.below(2), n, *p)
        t.call("modern_benson_encoded", rng.below(3), n, *p)
    return t


def _curves(t, rng, sample):
    for space in range(-1, 4):
        for i in range(-2, 4099):                # a grid of 4096 steps over 0 to 1, two steps beyond each end
            t.call("modern_encode", space, i / 4096.0)
            t.call("modern_decode", space, i / 4096.0)
        for v in ODD + JOINTS:
            t.call("modern_encode", space, v)
            t.call("modern_decode", space, v)
    for _ in range(sample):
        space, v = rng.below(3), unit(rng)
        t.call("modern_encode", space, v)
        t.call("modern_decode", space, v)
        t.call("modern_encode", space, v / 64.0)     # more cases near the linear toe
        t.call("modern_decode", space, v / 8.0)


def spaces(impl, sample=4000):
    """The named RGB spaces: transfer curves, and linear RGB to and from CIE XYZ under D65 and D50."""
    from .check import SAMPLE_SEED, Rng, Tally
    t, rng = Tally(impl), Rng(SAMPLE_SEED + 3)
    _curves(t, rng, sample)
    levels = (-0.5, 0.0, 0.25, 0.5, 1.0, 1.5)
    for space, white in product(range(-1, 4), range(-1, 3)):
        for p in product(levels, repeat=3):
            t.call("modern_rgb_to_xyz", space, white, *p)
            t.call("modern_xyz_to_rgb", space, white, *p)
        for bad, slot in product((NAN, INF, -INF), range(3)):
            p = [0.5, 0.5, 0.5]
            p[slot] = bad
            t.call("modern_rgb_to_xyz", space, white, *p)
            t.call("modern_xyz_to_rgb", space, white, *p)
    for _ in range(sample):
        space, white = rng.below(3), rng.below(2)
        p = [unit(rng) * 2.0 - 0.5 for _ in range(3)]
        t.call("modern_rgb_to_xyz", space, white, *p)
        t.call("modern_xyz_to_rgb", space, white, *p)
    return t
