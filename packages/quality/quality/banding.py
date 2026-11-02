# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Banding detector.

Finds smooth-gradient tiles in an image and measures two failure signatures:

1. Histogram gaps (gap_ratio): inside a smooth tile spanning code values lo..hi,
   the share of codes in that span that never occur. A gradient computed at low
   precision and then scaled, or a tone curve applied to 8-bit data, skips codes.
2. Undithered steps (band_px, step_ratio): along each row and column, the count
   of value changes per pixel divided by the local slope in codes per pixel. A
   clean staircase changes value exactly once per code step, so step_ratio is
   near 1; dither or grain makes it several times larger. A tile is banded when
   step_ratio < STEP_LIMIT and its bands are at least MIN_BAND_PX wide.

Usage: python banding.py IMAGE [--box x,y,w,h] [--json]
Pass: gap_ratio <= 0.02 and banded_share <= 0.02 (see QUALITY-SPEC.md, R2).
"""
from __future__ import annotations

import argparse
import json
import sys

import cv2
import numpy as np

from . import imgio

TILE = 96
STEP_LIMIT = 1.6      # value changes per code step; a dithered ramp scores 3 or more
MIN_BAND_PX = 4.0     # bands narrower than this do not read as bands at 1x
SMOOTH_MIN, SMOOTH_MAX = 1.5, 40.0   # tile code span that counts as a gentle gradient
EDGE_LIMIT = 0.08     # max share of strong-edge pixels in a smooth tile
MAX_STEP = 6.0        # largest neighbour step a dithered or grained ramp shows
FIT_RESID_MAX = 3.0
RESID_PEAK_MAX = 4.5  # a hairline or edge leaves a residual spike; dither and a staircase stay under 1.5
MONOTONIC = 0.9      # share of profile steps that must share the ramp's direction   # code values; dither is about 0.5, text and texture far more


def _tiles(h, w, t=TILE):
    for y in range(0, h - t + 1, t):
        for x in range(0, w - t + 1, t):
            yield y, x


def tile_stats(ch: np.ndarray):
    """Measure one tile of one channel (8-bit code values, float). Returns None if not a smooth gradient."""
    blur = cv2.GaussianBlur(ch, (0, 0), 3.0)
    span = float(blur.max() - blur.min())
    if span < SMOOTH_MIN or span > SMOOTH_MAX:
        return None
    # must be a smooth surface: a quadratic fit leaves at most dither-sized residue (text, edges, texture fail)
    h, w = ch.shape
    yy, xx = np.mgrid[:h, :w] / float(max(h, w))
    A = np.stack([np.ones_like(xx), xx, yy, xx * xx, yy * yy, xx * yy], -1).reshape(-1, 6)
    coef, *_ = np.linalg.lstsq(A, ch.reshape(-1), rcond=None)
    fit = (A @ coef).reshape(h, w)
    res = np.abs(ch - fit)
    if res.std() > FIT_RESID_MAX or res.max() > RESID_PEAK_MAX or float(fit.max() - fit.min()) < SMOOTH_MIN:
        return None
    gx = np.abs(np.diff(ch, axis=1))
    gy = np.abs(np.diff(ch, axis=0))
    if (np.mean(gx > 12) + np.mean(gy > 12)) / 2 > EDGE_LIMIT:
        return None
    if max(gx.max(), gy.max()) > MAX_STEP:  # a hard line or edge crosses the tile: not a gradient
        return None
    if len(np.unique(np.round(ch))) < 3:   # two levels is an edge or a flat field, not a ramp
        return None
    # a ramp is monotonic along its main axis; a faint line, a stripe or a ray fan is not
    px, py = blur.mean(axis=0), blur.mean(axis=1)
    prof = px if np.ptp(px) >= np.ptp(py) else py
    if np.ptp(prof) < 2.0:
        return None
    d = np.diff(prof)
    d = d[np.abs(d) > 1e-3]
    if len(d) == 0 or max((d > 0).mean(), (d < 0).mean()) < MONOTONIC:
        return None
    q = np.round(ch).astype(np.int64)
    lo, hi = int(q.min()), int(q.max())
    present = np.unique(q)
    gap = 1.0 - len(present) / (hi - lo + 1) if hi > lo else 0.0
    # slope in codes per pixel from the blurred field (removes dither noise)
    sx = np.abs(np.diff(blur, axis=1)).mean()
    sy = np.abs(np.diff(blur, axis=0)).mean()
    slope = max(sx, sy, 1e-6)
    changes = max((np.diff(q, axis=1) != 0).mean(), (np.diff(q, axis=0) != 0).mean())
    step_ratio = changes / slope
    band_px = 1.0 / slope
    banded = step_ratio < STEP_LIMIT and band_px >= MIN_BAND_PX
    return {"gap": gap, "step_ratio": float(step_ratio), "band_px": float(band_px), "banded": bool(banded)}


def analyse(rgb8: np.ndarray, marks: list | None = None) -> dict:
    """marks: optional list that receives (x, y, band_px, span) for each banded tile."""
    h, w, _ = rgb8.shape
    tiles, gaps, banded, worst = 0, [], 0, 0.0
    for y, x in _tiles(h, w):
        for c in range(3):
            s = tile_stats(rgb8[y:y + TILE, x:x + TILE, c])
            if s is None:
                continue
            tiles += 1
            gaps.append(s["gap"])
            if s["banded"]:
                banded += 1
                if marks is not None:
                    marks.append((x, y, s["band_px"], c))
                worst = max(worst, s["band_px"])
    gap_ratio = float(np.mean(gaps)) if gaps else 0.0
    share = banded / tiles if tiles else 0.0
    return {
        "smooth_tiles": tiles,
        "gap_ratio": round(gap_ratio, 4),
        "banded_tiles": banded,
        "banded_share": round(share, 4),
        "worst_band_px": round(worst, 1),
        "pass": bool(gap_ratio <= 0.02 and share <= 0.02),
    }


def analyse_file(path: str, box=None, map_out: str | None = None) -> dict:
    rgb, bits = imgio.load(path)
    rgb = imgio.crop(imgio.to8(rgb, bits), box)
    marks = []
    out = analyse(rgb, marks)
    out["file"] = str(path)
    if map_out:  # outline banded tiles in the hot colour over a darkened copy, for looking
        vis = (rgb[..., ::-1] * 0.6).astype(np.uint8).copy()
        for x, y, _, _ in marks:
            cv2.rectangle(vis, (x, y), (x + TILE - 1, y + TILE - 1), (61, 122, 255), 2)
        cv2.imwrite(map_out, vis)
    return out


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("image")
    ap.add_argument("--box", help="x,y,w,h crop")
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--map", help="write a PNG with banded tiles outlined")
    a = ap.parse_args(argv)
    box = tuple(int(v) for v in a.box.split(",")) if a.box else None
    r = analyse_file(a.image, box, a.map)
    print(json.dumps(r, indent=1) if a.json else
          f"{'PASS' if r['pass'] else 'FAIL'} gap_ratio={r['gap_ratio']} banded_share={r['banded_share']} "
          f"worst_band_px={r['worst_band_px']} smooth_tiles={r['smooth_tiles']}")
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
