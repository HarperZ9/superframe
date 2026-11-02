# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Grain, frequency, cell-pitch and clipping analyser.

Measures, on 8-bit code values:
- grain_sd / surface_sd: robust (MAD) SD of the residual after a 1.5 px Gaussian
  blur (the feed-set-21 residual, made robust to strokes), median over the quietest
  40% of 64 px tiles (ground) and over the 40th to 90th energy percentile (surfaces).
- chroma_ratio: on surfaces, residual SD of the chroma differences (R-G, B-G) over the
  luma residual SD. Near 0 means monochrome grain; above 1 means coloured noise.
- grain_corr_px: autocorrelation half-width of the luma residual in pixels
  (1 for per-pixel noise, 2 to 3 for clumped film-like grain).
- spectral_centroid: centroid of the radially averaged power spectrum of the
  residual, in cycles per pixel (0.5 is Nyquist). Fine grain sits high.
- cell_px / cell_angle / cell_peak: the strongest periodic structure in the grey
  image (halftone, dither, pixel-art pitch, ribs) from the 2D FFT, its period in
  pixels, its angle, and the peak-to-median power ratio (above 30 is a real screen).
- clip_low / clip_high: share of pixels with any channel at 0 or at 255.

Usage: python grain.py IMAGE [--box x,y,w,h] [--json]
"""
from __future__ import annotations

import argparse
import json
import sys

import cv2
import numpy as np

from . import imgio

TILE = 64


def residual(ch: np.ndarray) -> np.ndarray:
    return ch - cv2.GaussianBlur(ch, (0, 0), 1.5)


def _tiles_by_energy(lum: np.ndarray):
    """All TILE x TILE tiles sorted by blurred gradient energy (quietest first)."""
    h, w = lum.shape
    blur = cv2.GaussianBlur(lum, (0, 0), 2.0)
    energy = np.hypot(cv2.Sobel(blur, cv2.CV_64F, 1, 0), cv2.Sobel(blur, cv2.CV_64F, 0, 1))
    t = TILE if min(h, w) >= TILE else min(h, w)
    tiles = [(float(energy[y:y + t, x:x + t].mean()), y, x)
             for y in range(0, h - t + 1, t) for x in range(0, w - t + 1, t)]
    tiles.sort()
    return tiles, t


def robust_sd(v: np.ndarray) -> float:
    """MAD-based SD: grain amplitude that sparse edges and strokes inside the tile do not inflate."""
    v = v.ravel()
    return float(1.4826 * np.median(np.abs(v - np.median(v))))


def grain_stats(rgb: np.ndarray) -> dict:
    """grain_sd: robust residual SD on the quietest 40% of tiles (the ground).
    surface_sd: the same on tiles between the 40th and 90th energy percentile (painted or
    photographed surfaces, where grain is seen). Edges above that are excluded."""
    lum = imgio.luma(rgb)
    tiles, t = _tiles_by_energy(lum)
    n = len(tiles)
    ground, surface = tiles[:max(1, int(n * 0.4))], tiles[int(n * 0.4):max(int(n * 0.4) + 1, int(n * 0.9))]
    res_l = residual(lum)
    res_c = [residual(rgb[..., c]) for c in range(3)]
    rg, bg = res_c[0] - res_c[1], res_c[2] - res_c[1]

    def med(group, arr):
        return float(np.median([robust_sd(arr[y:y + t, x:x + t]) for _, y, x in group])) if group else 0.0

    g_l, s_l = med(ground, res_l), med(surface, res_l)
    s_c = (med(surface, rg) + med(surface, bg)) / 2
    probe = surface[len(surface) // 2] if surface else ground[0]
    _, y0, x0 = probe
    patch = res_l[y0:y0 + t, x0:x0 + t]
    return {
        "grain_sd": round(g_l, 2),
        "surface_sd": round(s_l, 2),
        "grain_sd_rgb": [round(med(surface, c), 2) for c in res_c],
        "chroma_ratio": round(s_c / s_l, 2) if s_l > 1e-6 else 0.0,
        "grain_corr_px": round(corr_halfwidth(patch), 2),
        "spectral_centroid": round(spectral_centroid(patch), 3),
    }


def corr_halfwidth(patch: np.ndarray) -> float:
    p = patch - patch.mean()
    if p.std() < 1e-9:
        return 0.0
    f = np.fft.fft2(p)
    ac = np.real(np.fft.ifft2(f * np.conj(f)))
    ac = np.fft.fftshift(ac) / ac.max()
    cy, cx = np.array(ac.shape) // 2
    n = min(cy, cx)
    row = (ac[cy, cx:cx + n] + ac[cy:cy + n, cx]) / 2
    below = np.where(row < 0.5)[0]
    if len(below) == 0:
        return float(len(row))
    i = below[0]
    if i == 0:
        return 0.0
    a, b = row[i - 1], row[i]
    return float(i - 1 + (a - 0.5) / (a - b)) * 2  # full width at half maximum


def spectral_centroid(patch: np.ndarray) -> float:
    p = patch - patch.mean()
    if p.std() < 1e-9:
        return 0.0
    win = np.outer(np.hanning(p.shape[0]), np.hanning(p.shape[1]))
    ps = np.abs(np.fft.fftshift(np.fft.fft2(p * win))) ** 2
    h, w = ps.shape
    yy, xx = np.mgrid[:h, :w]
    r = np.hypot((yy - h // 2) / h, (xx - w // 2) / w)
    mask = (r > 0) & (r <= 0.5)
    return float((r[mask] * ps[mask]).sum() / ps[mask].sum())


def cell_pitch(gray: np.ndarray, size=256) -> dict:
    h, w = gray.shape
    s = min(size, h, w)
    best = None
    for y in range(0, h - s + 1, max(s, (h - s) // 3 or s)):
        for x in range(0, w - s + 1, max(s, (w - s) // 3 or s)):
            p = gray[y:y + s, x:x + s]
            p = p - p.mean()
            if p.std() < 2:
                continue
            win = np.outer(np.hanning(s), np.hanning(s))
            ps = np.abs(np.fft.fftshift(np.fft.fft2(p * win))) ** 2
            c = s // 2
            yy, xx = np.mgrid[:s, :s]
            r = np.hypot(yy - c, xx - c)
            ps[r < 8] = 0  # drop DC and periods over s/8 px (layout, not cells)
            k = np.unravel_index(np.argmax(ps), ps.shape)
            peak = ps[k] / (ps.mean() + 1e-12)
            if best is None or peak > best[0]:
                fy, fx = (k[0] - c) / s, (k[1] - c) / s
                f = np.hypot(fy, fx)
                best = (peak, 1.0 / f, float(np.degrees(np.arctan2(fy, fx)) % 180))
    if best is None:
        return {"cell_px": 0.0, "cell_angle": 0.0, "cell_peak": 0.0}
    return {"cell_px": round(best[1], 2), "cell_angle": round(best[2], 1), "cell_peak": round(float(best[0]), 1)}


def clipping(rgb8: np.ndarray) -> dict:
    lo = np.any(rgb8 <= 0.5, axis=-1).mean()
    hi = np.any(rgb8 >= 254.5, axis=-1).mean()
    return {"clip_low": round(float(lo), 4), "clip_high": round(float(hi), 4)}


def analyse(rgb8: np.ndarray) -> dict:
    out = grain_stats(rgb8)
    out.update(cell_pitch(imgio.luma(rgb8)))
    out.update(clipping(rgb8))
    return out


def analyse_file(path: str, box=None) -> dict:
    rgb, bits = imgio.load(path)
    rgb = imgio.crop(imgio.to8(rgb, bits), box)
    out = analyse(rgb)
    out["file"] = str(path)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("image")
    ap.add_argument("--box")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    box = tuple(int(v) for v in a.box.split(",")) if a.box else None
    r = analyse_file(a.image, box)
    print(json.dumps(r, indent=1) if a.json else " ".join(f"{k}={v}" for k, v in r.items() if k != "file"))
    return 0


if __name__ == "__main__":
    sys.exit(main())
