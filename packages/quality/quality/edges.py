# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Edge-quality analyser: transition width and anti-aliasing of strong edges.

For every strong edge pixel (Canny on luma), a 13-sample profile is read along
the gradient normal with bilinear sampling. Measures:
- width_p50 / width_p90: 10-to-90% rise distance in pixels. A crisp vector edge at
  1x is 1 to 1.5 px; a soft or upscaled edge is 3 px or more.
- aa_share: share of edge pixels whose 3x3 neighbourhood holds an intermediate value
  (between 15% and 85% of the local step). Aliased (binary) edges score near 0;
  anti-aliased edges score 0.5 or more.
- stair_share: share of near-diagonal edge pixels (20 to 70 degrees) with no
  intermediate neighbour: visible jaggies.

Usage: python edges.py IMAGE [--box x,y,w,h]
"""
from __future__ import annotations

import argparse
import json
import sys

import cv2
import numpy as np

from . import imgio


def analyse(rgb8: np.ndarray, max_edges=4000, seed=0) -> dict:
    lum = imgio.luma(rgb8).astype(np.float32)
    u8 = np.clip(lum, 0, 255).astype(np.uint8)
    edges = cv2.Canny(u8, 60, 140)
    gx = cv2.Sobel(lum, cv2.CV_32F, 1, 0, ksize=3)
    gy = cv2.Sobel(lum, cv2.CV_32F, 0, 1, ksize=3)
    ys, xs = np.nonzero(edges)
    h, w = lum.shape
    keep = (ys > 7) & (xs > 7) & (ys < h - 8) & (xs < w - 8)
    ys, xs = ys[keep], xs[keep]
    if len(ys) == 0:
        return {"edges": 0, "width_p50": 0.0, "width_p90": 0.0, "aa_share": 0.0, "stair_share": 0.0}
    if len(ys) > max_edges:
        idx = np.random.default_rng(seed).choice(len(ys), max_edges, replace=False)
        ys, xs = ys[idx], xs[idx]
    widths, aa, stair, diag = [], 0, 0, 0
    offs = np.linspace(-6, 6, 13)
    for y, x in zip(ys, xs):
        g = np.array([gx[y, x], gy[y, x]], dtype=float)
        n = np.linalg.norm(g)
        if n < 1e-3:
            continue
        d = g / n
        px = (x + offs * d[0]).astype(np.float32).reshape(1, -1)
        py = (y + offs * d[1]).astype(np.float32).reshape(1, -1)
        prof = cv2.remap(lum, px, py, cv2.INTER_LINEAR).ravel()
        lo, hi = float(prof[:3].mean()), float(prof[-3:].mean())
        step = hi - lo
        if abs(step) < 30:
            continue
        p = (prof - lo) / step
        i10 = np.argmax(p >= 0.1)
        i90 = np.argmax(p >= 0.9)
        widths.append(max(0.0, offs[i90] - offs[i10]))
        nb = lum[y - 1:y + 2, x - 1:x + 2]
        f = (nb - min(lo, hi)) / abs(step)
        has_mid = bool(np.any((f > 0.15) & (f < 0.85)))
        aa += has_mid
        ang = np.degrees(np.arctan2(abs(d[1]), abs(d[0])))
        if 20 <= ang <= 70:
            diag += 1
            stair += not has_mid
    m = len(widths)
    if m == 0:
        return {"edges": 0, "width_p50": 0.0, "width_p90": 0.0, "aa_share": 0.0, "stair_share": 0.0}
    return {
        "edges": m,
        "width_p50": round(float(np.percentile(widths, 50)), 2),
        "width_p90": round(float(np.percentile(widths, 90)), 2),
        "aa_share": round(aa / m, 3),
        "stair_share": round(stair / diag, 3) if diag else 0.0,
    }


def analyse_file(path: str, box=None) -> dict:
    rgb, bits = imgio.load(path)
    out = analyse(imgio.crop(imgio.to8(rgb, bits), box))
    out["file"] = str(path)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("image")
    ap.add_argument("--box")
    a = ap.parse_args(argv)
    box = tuple(int(v) for v in a.box.split(",")) if a.box else None
    print(json.dumps(analyse_file(a.image, box), indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
