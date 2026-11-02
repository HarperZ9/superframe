# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Golden-image SSIM harness.

SSIM after Wang, Bovik, Sheikh and Simoncelli (2004): Gaussian window sigma 1.5,
K1 0.01, K2 0.03, on luma code values with L = 255. Reports the mean SSIM and the
worst 32 px tile, so a small local regression is not averaged away.

Golden workflow:
  python ssim.py compare A.png B.png                 # print mean and worst-tile SSIM
  python ssim.py check --golden DIR --actual DIR     # every *.png in actual against golden
           [--threshold 0.995] [--tile-threshold 0.97] [--update]
--update copies missing goldens in (never overwrites an existing golden; delete
it by hand to re-baseline, so a regression cannot silently become the new truth).
Exit 1 on any failure or size mismatch.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np

from . import imgio

C1 = (0.01 * 255) ** 2
C2 = (0.03 * 255) ** 2


def ssim_map(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    if a.shape != b.shape:
        raise ValueError(f"size mismatch {a.shape} vs {b.shape}")
    g = lambda x: cv2.GaussianBlur(x, (11, 11), 1.5)
    mu_a, mu_b = g(a), g(b)
    saa = g(a * a) - mu_a ** 2
    sbb = g(b * b) - mu_b ** 2
    sab = g(a * b) - mu_a * mu_b
    return ((2 * mu_a * mu_b + C1) * (2 * sab + C2)) / ((mu_a ** 2 + mu_b ** 2 + C1) * (saa + sbb + C2))


def compare_arrays(a_rgb: np.ndarray, b_rgb: np.ndarray, tile=32) -> dict:
    m = ssim_map(imgio.luma(a_rgb), imgio.luma(b_rgb))
    h, w = m.shape
    worst, where = 1.0, (0, 0)
    for y in range(0, max(1, h - tile + 1), tile):
        for x in range(0, max(1, w - tile + 1), tile):
            v = float(m[y:y + tile, x:x + tile].mean())
            if v < worst:
                worst, where = v, (x, y)
    return {"ssim": round(float(m.mean()), 5), "worst_tile": round(worst, 5), "worst_at": where}


def compare_files(a: str, b: str) -> dict:
    ra, ba = imgio.load(a)
    rb, bb = imgio.load(b)
    return compare_arrays(imgio.to8(ra, ba), imgio.to8(rb, bb))


def check(golden: Path, actual: Path, threshold=0.995, tile_threshold=0.97, update=False) -> dict:
    golden.mkdir(parents=True, exist_ok=True)
    results, ok = {}, True
    for f in sorted(actual.glob("*.png")):
        g = golden / f.name
        if not g.exists():
            if update:
                shutil.copy2(f, g)
                results[f.name] = {"status": "baselined"}
            else:
                results[f.name] = {"status": "missing-golden"}
                ok = False
            continue
        try:
            r = compare_files(str(g), str(f))
        except ValueError as e:
            results[f.name] = {"status": "size-mismatch", "error": str(e)}
            ok = False
            continue
        r["status"] = "pass" if r["ssim"] >= threshold and r["worst_tile"] >= tile_threshold else "fail"
        ok &= r["status"] == "pass"
        results[f.name] = r
    return {"pass": ok, "results": results}


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("compare")
    c.add_argument("a")
    c.add_argument("b")
    k = sub.add_parser("check")
    k.add_argument("--golden", required=True)
    k.add_argument("--actual", required=True)
    k.add_argument("--threshold", type=float, default=0.995)
    k.add_argument("--tile-threshold", type=float, default=0.97)
    k.add_argument("--update", action="store_true")
    a = ap.parse_args(argv)
    if a.cmd == "compare":
        print(json.dumps(compare_files(a.a, a.b)))
        return 0
    r = check(Path(a.golden), Path(a.actual), a.threshold, a.tile_threshold, a.update)
    print(json.dumps(r, indent=1))
    return 0 if r["pass"] else 1


if __name__ == "__main__":
    sys.exit(main())
