# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Image normaliser and colour conversion shared by every extractor.

Images are read as data only (PIL decodes them; nothing in a media folder is executed). Every image
passes one normaliser before measurement: RGB, longest side 512 (Lanczos), one JPEG round trip at
quality 80. This is the taste study's normaliser, so measurements line up with that table.
Extractors then work on a working copy whose longest side is WORK (256 px) unless they say otherwise.
"""
import io

import numpy as np
from PIL import Image

SIDE, JPEG_Q, WORK = 512, 80, 256
Image.MAX_IMAGE_PIXELS = 200_000_000


def normalise(im, side=SIDE, jpeg=True):
    im = im.convert("RGB")
    w, h = im.size
    s = side / max(w, h)
    if s < 1:
        im = im.resize((max(8, round(w * s)), max(8, round(h * s))), Image.LANCZOS)
    if not jpeg:
        return im
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=JPEG_Q)
    buf.seek(0)
    out = Image.open(buf)
    out.load()
    return out.convert("RGB")


def open_image(path, jpeg=True):
    im = Image.open(path)
    if im.format == "JPEG":
        im.draft("RGB", (2 * SIDE, 2 * SIDE))
    im.load()
    return normalise(im, jpeg=jpeg)


def to_array(im, side=WORK):
    """PIL image or HxWx3 uint8/float array -> float RGB in [0, 1], longest side `side`."""
    if isinstance(im, np.ndarray):
        a = im.astype(float)
        if a.max() > 1.5:
            a = a / 255.0
        if a.ndim == 2:
            a = np.repeat(a[..., None], 3, 2)
        im = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    im = im.convert("RGB")
    w, h = im.size
    s = side / max(w, h)
    if abs(s - 1) > 1e-9:
        im = im.resize((max(8, round(w * s)), max(8, round(h * s))), Image.LANCZOS)
    return np.asarray(im, float) / 255.0


def srgb_to_lab(rgb):
    """sRGB in [0,1] (..., 3) -> CIE Lab (D65)."""
    c = np.where(rgb <= 0.04045, rgb / 12.92, ((rgb + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124564, 0.3575761, 0.1804375],
                  [0.2126729, 0.7151522, 0.0721750],
                  [0.0193339, 0.1191920, 0.9503041]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    e = 216 / 24389
    f = np.where(xyz > e, np.cbrt(xyz), (24389 / 27 * xyz + 16) / 116)
    L = 116 * f[..., 1] - 16
    a = 500 * (f[..., 0] - f[..., 1])
    b = 200 * (f[..., 1] - f[..., 2])
    return np.stack([L, a, b], -1)


def lightness(rgb):
    return srgb_to_lab(rgb)[..., 0]
