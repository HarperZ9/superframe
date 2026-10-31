# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Spectra, illuminants and colour. Standard library only.

Grid: 380 to 780 nm in 5 nm steps (81 samples), the library's shared grid.
CIE 1931 2-degree colour-matching functions and CIE D65 come from the CIE's
own CSV files (CC BY-SA 4.0, DOI 10.25039/CIE.DS.xvudnb9b and the D65 set);
see data/cie/NOTICE.md. Illuminant A is computed from its CIE definition.
The sodium lamp is a two-line model of the Na D doublet.
"""
import csv
import math
from functools import lru_cache
from pathlib import Path

GRID = list(range(380, 781, 5))
_CIE = Path(__file__).resolve().parent.parent / "data" / "cie"


def _read_csv(name):
    rows = {}
    with open(_CIE / name, newline="", encoding="utf-8") as f:
        for row in csv.reader(f):
            if row and row[0].strip():
                rows[int(float(row[0]))] = [float(v) for v in row[1:]]
    return rows


@lru_cache(maxsize=None)
def cmf():
    """[(xbar, ybar, zbar)] on GRID."""
    rows = _read_csv("CIE_xyz_1931_2deg.csv")
    return [tuple(rows[w]) for w in GRID]


@lru_cache(maxsize=None)
def illuminant(name):
    """Relative spectral power on GRID. name: D65, A, sodium, E."""
    if name == "D65":
        rows = _read_csv("CIE_std_illum_D65.csv")
        return [rows[w][0] for w in GRID]
    if name == "A":
        # CIE 15:2018 definition: c2 = 1.435e-2 m K, nominal T = 2848 K, 100 at 560 nm. The CIE fixes this
        # c2 on purpose, so the illuminant does not move when CODATA's c2 (1.438777e-2) is revised; do not
        # "correct" it. Matches the CIE 1 nm CSV to 5e-6 relative (tools/measured data/cie_check.json).
        c = 1.435e7  # nm K
        return [100 * (560 / w) ** 5 * (math.exp(c / (2848 * 560)) - 1)
                / (math.exp(c / (2848 * w)) - 1) for w in GRID]
    if name == "sodium":
        # Low-pressure sodium: D2 588.995 nm and D1 589.592 nm, ratio 2:1 (NIST ASD wavelengths).
        spd = [0.0] * len(GRID)
        for line, weight in ((588.995, 2.0), (589.592, 1.0)):
            i = int((line - GRID[0]) // 5)
            t = (line - GRID[i]) / 5
            spd[i] += weight * (1 - t) / 5
            spd[i + 1] += weight * t / 5
        return spd
    if name == "E":
        return [1.0] * len(GRID)
    raise KeyError(name)


def to_xyz(spectrum, light):
    """Reflectance (or radiance factor) spectrum under a light, normalised so a
    perfect white reflector has Y = 1."""
    cm = cmf()
    norm = sum(light[i] * cm[i][1] for i in range(len(GRID)))
    x = sum(spectrum[i] * light[i] * cm[i][0] for i in range(len(GRID))) / norm
    y = sum(spectrum[i] * light[i] * cm[i][1] for i in range(len(GRID))) / norm
    z = sum(spectrum[i] * light[i] * cm[i][2] for i in range(len(GRID))) / norm
    return x, y, z


def white_xyz(light):
    return to_xyz([1.0] * len(GRID), light)


def xyz_to_linear_srgb(xyz):
    x, y, z = xyz
    return (3.2404542 * x - 1.5371385 * y - 0.4985314 * z,
            -0.9692660 * x + 1.8760108 * y + 0.0415560 * z,
            0.0556434 * x - 0.2040259 * y + 1.0572252 * z)


def encode_srgb(lin):
    out = []
    for c in lin:
        c = min(max(c, 0.0), 1.0)
        out.append(12.92 * c if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055)
    return tuple(out)


def xyz_to_lab(xyz, white):
    def f(t):
        return t ** (1 / 3) if t > (6 / 29) ** 3 else t / (3 * (6 / 29) ** 2) + 4 / 29
    fx, fy, fz = (f(xyz[i] / white[i]) for i in range(3))
    return 116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)


def lch(lab):
    L, a, b = lab
    return L, math.hypot(a, b), math.degrees(math.atan2(b, a)) % 360


def reflectance_to_srgb(spectrum, light_name="D65"):
    """Linear-to-encoded sRGB of a reflectance spectrum, with the D65 white of the
    sRGB display fixed (no chromatic adaptation), so warm lights look warm."""
    light = illuminant(light_name)
    return encode_srgb(xyz_to_linear_srgb(to_xyz(spectrum, light)))
