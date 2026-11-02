# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Single-channel renders of an image: each keeps one design channel and destroys the others.

colour_only   the palette as horizontal bands, sorted by lightness, heights in proportion to share.
              Keeps hue, chroma, value and their proportions; loses shape and position.
shape_only    up to 16 largest primitive regions as black silhouettes on white, each scaled to fit its
              cell of a 4x4 grid in area order. Keeps contour and relative size rank; loses colour and
              position.
layout_only   the same regions' bounding boxes at their measured positions, flat mid grey on white.
              Keeps placement, extent and the gaps between; loses colour and contour.
perspective_only  the detected line segments' supporting rays toward their vanishing points, the
              horizon and the vanishing points as dots, black on white; loses colour, fill and texture.
"""
import numpy as np
from PIL import Image, ImageDraw

from .palette import palette
from .shape import regions

OUT = 256


def _lab_to_rgb(lab):
    L, a, b = lab[..., 0], lab[..., 1], lab[..., 2]
    fy = (L + 16) / 116
    fx, fz = fy + a / 500, fy - b / 200
    e = 6 / 29
    f = lambda t: np.where(t > e, t ** 3, 3 * e * e * (t - 4 / 29))  # noqa: E731
    xyz = np.stack([f(fx) * 0.95047, f(fy), f(fz) * 1.08883], -1)
    M = np.array([[3.2404542, -1.5371385, -0.4985314], [-0.9692660, 1.8760108, 0.0415560],
                  [0.0556434, -0.2040259, 1.0572252]])
    c = xyz @ M.T
    c = np.where(c <= 0.0031308, 12.92 * c, 1.055 * np.clip(c, 0, None) ** (1 / 2.4) - 0.055)
    return np.clip(c, 0, 1)


def colour_only(rgb):
    C, s = palette(rgb)
    out = np.ones((OUT, OUT, 3))
    if len(C) == 0:
        return out
    order = np.argsort(C[:, 0])
    s = s[order] / s.sum()
    y = 0
    for c, sh in zip(C[order], s):
        h = int(round(sh * OUT))
        out[y:y + h] = _lab_to_rgb(c[None])[0]
        y += h
    out[y:] = _lab_to_rgb(C[order][-1][None])[0]
    return out


def shape_only(rgb, regs=None):
    regs = regions(rgb, max_regions=16) if regs is None else regs[:16]
    im = Image.new("L", (OUT, OUT), 255)
    cell = OUT // 4
    for k, r in enumerate(regs):
        m = r["mask"]
        h, w = m.shape
        s = (cell - 6) / max(h, w)
        sm = Image.fromarray((~m * 255).astype(np.uint8)).resize((max(1, round(w * s)), max(1, round(h * s))), Image.NEAREST)
        x0 = (k % 4) * cell + (cell - sm.size[0]) // 2
        y0 = (k // 4) * cell + (cell - sm.size[1]) // 2
        im.paste(sm, (x0, y0), Image.fromarray((np.asarray(sm) < 128).astype(np.uint8) * 255))
    return np.repeat((np.asarray(im, float) / 255)[..., None], 3, 2)


def layout_only(rgb, regs=None):
    regs = regions(rgb, max_regions=16) if regs is None else regs[:16]
    h, w = rgb.shape[:2]
    s = OUT / max(h, w)
    im = Image.new("L", (round(w * s), round(h * s)), 255)
    d = ImageDraw.Draw(im)
    for r in regs:
        y0, x0, y1, x1 = r["bbox"]
        d.rectangle([x0 * s, y0 * s, x1 * s - 1, y1 * s - 1], fill=128)
    return np.repeat((np.asarray(im, float) / 255)[..., None], 3, 2)


def perspective_only(rgb, extra):
    h, w = rgb.shape[:2]
    s = OUT / max(h, w)
    W, H = round(w * s), round(h * s)
    im = Image.new("L", (W, H), 255)
    d = ImageDraw.Draw(im)
    for p, q in extra["segments"]:
        d.line([tuple(p * s), tuple(q * s)], fill=0, width=1)
    for v in extra["vps"]:
        if v["finite"]:
            x, y = v["x"] * W, v["y"] * H
            if -W < x < 2 * W and -H < y < 2 * H:
                d.ellipse([x - 4, y - 4, x + 4, y + 4], fill=0)
    return np.repeat((np.asarray(im, float) / 255)[..., None], 3, 2)
