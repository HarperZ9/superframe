# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Spectral frames to the display, through the materials library's colour pipeline.

A frame is spectral: per cell, the light energy of each phosphor (J), and each phosphor's unit
energy spectrum times the faceplate's exit spectrum. Because the light is a sum of three known
spectra, the three coefficients are the spectrum without loss; expand() writes the 81-band cube.
XYZ comes from the CIE 1931 2 degree functions in tools/materials (683 lm/W at the ybar peak),
then CIE XYZ to linear sRGB and the sRGB encode, both from tools/materials.
"""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "materials"))
from materials import spectral as _sp  # noqa: E402

CMF = np.array(_sp.cmf(), dtype=np.float64)  # (81, 3)
D65_XY = (0.31271, 0.32902)
KM = 683.0
_EXIT = {}


def exit_spectrum(tube):
    key = (tube.glass.thickness_mm, tube.glass.transmission, tube.glass.material)
    if key not in _EXIT:
        _EXIT[key] = tube.glass.exit_spectrum()
    return _EXIT[key]


def basis(tube):
    """(3, 81) spectral energy per joule of phosphor light, after the glass."""
    return tube.ph["spd"] * exit_spectrum(tube)[None, :]


def basis_xyz(tube):
    """(3, 3): lumen-weighted XYZ (lm s) per joule of phosphor light, rows = phosphor."""
    return KM * 5.0 * basis(tube) @ CMF


def phosphor_xyz(tube, c):
    """XYZ per joule of beam energy on gun c, landing on the face (for the white setup)."""
    return tube.ph["eta"][c] * tube.mask_transmission * basis_xyz(tube)[c]


def chromaticities(tube):
    b = tube.ph["spd"] @ CMF
    return [(float(v[0] / v.sum()), float(v[1] / v.sum())) for v in b]


def to_xyz(tube, coeff):
    """coeff (..., 3) phosphor light per cell in J -> XYZ in lm s per cell."""
    return coeff @ basis_xyz(tube)


def luminance_time(tube, xyz):
    """lm s per cell -> cd s / m^2 for a Lambertian cell of side dx."""
    area = (tube.dx * 1e-3) ** 2
    return xyz / (area * np.pi)


def expand(tube, coeff):
    """(..., 3) -> (..., 81) spectral energy per nm."""
    return coeff @ basis(tube)


def encode(xyz, white_y):
    """Linear XYZ scaled so white_y maps to 1, to 8-bit sRGB (clipped)."""
    M = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560],
                  [0.0556434, -0.2040259, 1.0572252]])
    lin = np.clip((xyz / white_y) @ M.T, 0.0, 1.0)
    v = np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * np.power(lin, 1 / 2.4) - 0.055)
    return np.round(v * 255).astype(np.uint8)


def to_lab(xyz, white):
    w = np.asarray(white)
    t = xyz / w
    f = np.where(t > (6 / 29) ** 3, np.cbrt(t), t / (3 * (6 / 29) ** 2) + 4 / 29)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)


def srgb_to_lab(rgb8):
    v = rgb8.astype(np.float64) / 255
    lin = np.where(v <= 0.04045, v / 12.92, ((v + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564, 0.3575761, 0.1804375], [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    return to_lab(lin @ M.T, (0.95047, 1.0, 1.08883))
