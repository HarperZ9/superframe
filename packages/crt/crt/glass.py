# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The faceplate: Fresnel exit with n(lambda) from the materials library, the tinted body, and the
halation ring that total internal reflection makes around a bright spot.

Light leaves the phosphor into the glass with a Lambertian distribution, power sin(2 theta) d theta.
At the front surface a ray is transmitted with 1 - R(theta) (unpolarised Fresnel) or, beyond the
critical angle asin(1/n), reflected totally. A reflected ray returns to the phosphor at radius
2 t tan(theta) after a path 2 t / cos(theta) through glass of normal transmission T per thickness;
the phosphor powder scatters it again with albedo rho as a new Lambertian source. The screen's
response is X * (delta + rho K1 + rho^2 K1*K1 + ...), summed exactly as X / (1 - rho K1^) in the
Fourier domain. The ring's model is raw-native's web/shaders/crt/halo.mjs (to third order and
normalised to keep white there); here the series is summed to all orders and not renormalised,
so the light the glass absorbs is lost.
"""
import math
import sys
from pathlib import Path
from dataclasses import dataclass

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "materials"))
import materials  # noqa: E402


def fresnel(n, theta):
    s = n * math.sin(theta)
    if s >= 1:
        return 1.0
    ci, ct = math.cos(theta), math.sqrt(1 - s * s)
    rs, rp = (n * ci - ct) / (n * ci + ct), (n * ct - ci) / (n * ct + ci)
    return 0.5 * (rs * rs + rp * rp)


@dataclass
class Faceplate:
    thickness_mm: float = 12.0
    transmission: float = 0.56     # body transmission at normal incidence over the full thickness
    albedo: float = 0.5            # phosphor powder and black matrix, diffuse
    material: str = "soda_lime_glass"
    steps: int = 4000

    def n(self):
        return np.array(materials.get(self.material)["optics"]["n"]["value"], dtype=np.float64)

    def _angles(self):
        dth = math.pi / 2 / self.steps
        th = (np.arange(self.steps) + 0.5) * dth
        return th, np.sin(2 * th) * dth

    def exit_fraction(self, n):
        th, w = self._angles()
        f = np.array([1 - fresnel(n, t) for t in th])
        return float((w * f * self.transmission ** (1 / np.cos(th))).sum())

    def exit_spectrum(self):
        return np.array([self.exit_fraction(v) for v in self.n()])

    def ring(self, n):
        """(radius mm, returned energy) samples of the single-return distribution K1."""
        th, w = self._angles()
        R = np.array([fresnel(n, t) for t in th])
        e = w * R * self.transmission ** (2 / np.cos(th))
        return 2 * self.thickness_mm * np.tan(th), e

    def ring_mm(self, n):
        return 2 * self.thickness_mm * math.tan(math.asin(1 / n))


def kernel(plate, n, dy, dx, reach_mm, angles=96):
    """K1 on a grid of cells dy (rows) by dx (columns), centred; sums to the returned fraction."""
    r, e = plate.ring(n)
    keep = r < reach_mm
    r, e = r[keep], e[keep]
    Ry, Rx = int(math.ceil(reach_mm / dy)), int(math.ceil(reach_mm / dx))
    K = np.zeros((2 * Ry + 1, 2 * Rx + 1))
    a = (np.arange(angles) + 0.5) * 2 * math.pi / angles
    yy = np.rint(np.outer(r, np.sin(a)) / dy).astype(int) + Ry
    xx = np.rint(np.outer(r, np.cos(a)) / dx).astype(int) + Rx
    np.add.at(K, (yy.ravel(), xx.ravel()), np.repeat(e / angles, angles))
    return K


def halate(plate, img, n, dy, dx, reach_mm=None):
    """Light leaving the glass for light img emitted by the phosphor (one channel, rows x cols),
    before the spectral exit factor. Returns (out, returned_fraction)."""
    reach = reach_mm or 3.2 * plate.ring_mm(n)
    K = kernel(plate, n, dy, dx, reach)
    ky, kx = K.shape[0] // 2, K.shape[1] // 2
    H, W = img.shape[0] + 2 * ky, img.shape[1] + 2 * kx
    P = np.zeros((H, W))
    P[ky:ky + img.shape[0], kx:kx + img.shape[1]] = img
    Kp = np.zeros((H, W))
    Kp[:K.shape[0], :K.shape[1]] = K
    Kp = np.roll(np.roll(Kp, -ky, 0), -kx, 1)
    G = 1.0 / (1.0 - plate.albedo * np.fft.rfft2(Kp))
    out = np.fft.irfft2(np.fft.rfft2(P) * G, s=(H, W))
    return out[ky:ky + img.shape[0], kx:kx + img.shape[1]], float(K.sum())
