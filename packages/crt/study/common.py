# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Shared helpers for the CRT study: a stdlib PNG writer, backends, and the eye render."""
import os
import json
import struct
import sys
import zlib
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from crt import Tube, beam, scene, screen  # noqa: E402,F401
from crt.backend import make  # noqa: E402

OUT = Path(os.environ.get("CRT_STUDY_OUT", "out/crt-study"))
OUT.mkdir(parents=True, exist_ok=True)


def png(path, rgb8):
    """Write an 8-bit RGB array as PNG with zlib only."""
    h, w, _ = rgb8.shape
    raw = b"".join(b"\x00" + rgb8[y].tobytes() for y in range(h))

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
    data = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    data += chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")
    Path(path).write_bytes(data)


def backend():
    try:
        return make("cuda")
    except Exception as e:  # CPU-only interpreter: say so and carry on
        print("GPU backend unavailable, using numpy:", e)
        return make("cpu")


def eye(tube, src, xp, a=0.0, b=None, static=True, history=8, halo=True):
    """Light leaving the glass in [a, b] (default one field) as XYZ in cd/m^2 (rows, cols, 3)."""
    b = tube.T if b is None else b
    Q = beam.frame(tube, src, a, b, history=history, static=static, xp=xp)
    co = screen.cells(tube, Q, halo=halo)
    return screen.luminance(tube, co, tube.T), co


def white_levels(tube, xp):
    """Steady full-white luminance: the mean over cells, and the brightest cell (a lit stripe)."""
    xyz, _ = eye(tube, scene.flat(1.0), xp)
    mid = xyz[tube.rows // 3:2 * tube.rows // 3, tube.cols // 3:2 * tube.cols // 3, 1]
    return float(mid.mean()), float(mid.max())


def upscale(img, k):
    return np.repeat(np.repeat(img, k, axis=0), k, axis=1)


def dump(name, obj):
    (OUT / name).write_text(json.dumps(obj, indent=1, default=float), encoding="utf-8")
