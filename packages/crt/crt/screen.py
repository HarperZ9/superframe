# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""From phosphor light per stripe to the light that leaves the faceplate, cell by cell.

A cell is one stripe (pitch / 3 wide, the same tall). Its direct light is its own phosphor's.
Halation light comes back through the glass onto every stripe of a triad alike, so each of the
three cells gets a third of it, in the spectrum of the phosphor that first emitted it.
"""
import numpy as np

from . import colour, glass


def centroid_n(tube, c):
    spd, n = tube.ph["spd"][c], tube.glass.n()
    return float((spd * n).sum() / spd.sum())


def cells(tube, Q, halo=True):
    """Q (rows, triads, 3) J -> coefficients (rows, cols, 3): phosphor light per cell whose
    spectrum is colour.basis (the glass exit spectrum is in the basis)."""
    out = np.zeros((tube.rows, tube.cols, 3))
    for c in range(3):
        direct = Q[..., c]
        if halo:
            h, _ = glass.halate(tube.glass, direct, centroid_n(tube, c), tube.dx, tube.pitch_mm)
            extra = h - direct
        else:
            extra = 0.0 * direct
        out[:, c::3, c] += direct
        for q in range(3):
            out[:, q::3, c] += extra / 3.0
    return out


def luminance(tube, coeff, seconds):
    """XYZ in cd/m^2 averaged over an exposure of the given length."""
    return colour.luminance_time(tube, colour.to_xyz(tube, coeff)) / seconds


def downsample(a, fy, fx):
    H, W = a.shape[0] // fy * fy, a.shape[1] // fx * fx
    a = a[:H, :W]
    return a.reshape(H // fy, fy, W // fx, fx, *a.shape[2:]).mean(axis=(1, 3))


def to_display(xyz, white_y):
    return colour.encode(xyz, white_y)
