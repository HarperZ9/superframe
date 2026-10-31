# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Synthetic images with known answers, for tests and for calibrating extractors."""
import numpy as np
from PIL import Image, ImageDraw

PHI = (np.sqrt(5) - 1) / 2


def _img(a):
    return np.clip(a, 0, 1)


def disk_at(fx, fy, w=384, h=256, r=0.06, fg=(0.1, 0.1, 0.12), bg=(0.93, 0.92, 0.9)):
    im = Image.new("RGB", (w, h), tuple(int(255 * c) for c in bg))
    d = ImageDraw.Draw(im)
    R = r * min(w, h)
    cx, cy = fx * (w - 1), fy * (h - 1)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=tuple(int(255 * c) for c in fg))
    return np.asarray(im, float) / 255


def golden_disk(w=384, h=256):
    return disk_at(PHI, 1 - PHI, w, h)


def rosette(n, size=256, phase=0.3):
    y, x = np.mgrid[:size, :size] - (size - 1) / 2
    r, t = np.hypot(x, y) / (size / 2), np.arctan2(y, x)
    v = 0.5 + 0.35 * np.cos(n * t + phase) * np.exp(-((r - 0.5) / 0.25) ** 2) + 0.1 * np.cos(2 * np.pi * 3 * r)
    v = np.where(r < 0.98, v, 0.5)
    return np.repeat(_img(v)[..., None], 3, 2)


def palette_blocks(colors, w=256, h=256):
    """Vertical bands of the given sRGB colours (0-255 tuples), equal widths."""
    a = np.zeros((h, w, 3))
    k = len(colors)
    for i, c in enumerate(colors):
        a[:, i * w // k:(i + 1) * w // k] = np.array(c) / 255
    return a


def stripes(width, gap=20, size=256, horizontal=False):
    a = np.ones((size, size))
    period = width + gap
    for s in range(gap // 2, size, period):
        if horizontal:
            a[s:s + width] = 0
        else:
            a[:, s:s + width] = 0
    return np.repeat(a[..., None], 3, 2)


def power_noise(beta, size=256, seed=0):
    """Isotropic noise with radially averaged power ~ f^-beta."""
    rng = np.random.default_rng(seed)
    fy = np.fft.fftfreq(size)[:, None]
    fx = np.fft.fftfreq(size)[None, :]
    f = np.hypot(fx, fy)
    f[0, 0] = 1
    amp = f ** (-beta / 2)
    amp[0, 0] = 0
    ph = np.exp(2j * np.pi * rng.random((size, size)))
    v = np.fft.ifft2(amp * ph).real
    v = (v - v.mean()) / (v.std() * 6) + 0.5
    return np.repeat(_img(v)[..., None], 3, 2)


def dot_grid(period=32, r=5, size=256):
    y, x = np.mgrid[:size, :size]
    d = np.hypot((x % period) - period / 2, (y % period) - period / 2)
    a = np.where(d < r, 0.1, 0.9)
    return np.repeat(a[..., None], 3, 2)


def shapes(n_circle=3, n_quad=2, n_tri=1, size=384, seed=0):
    """Dark shapes on a light ground, placed on a jittered grid so they never touch."""
    rng = np.random.default_rng(seed)
    im = Image.new("RGB", (size, size), (235, 232, 228))
    d = ImageDraw.Draw(im)
    kinds = ["c"] * n_circle + ["q"] * n_quad + ["t"] * n_tri
    cells = rng.permutation(16)[:len(kinds)]
    step = size / 4
    for k, c in zip(kinds, cells):
        cx, cy = (c % 4 + 0.5) * step, (c // 4 + 0.5) * step
        R = step * rng.uniform(0.28, 0.36)
        if k == "c":
            d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(30, 30, 40))
        elif k == "q":
            a = rng.uniform(0, np.pi / 2)
            pts = [(cx + R * np.cos(a + j * np.pi / 2), cy + R * np.sin(a + j * np.pi / 2)) for j in range(4)]
            d.polygon(pts, fill=(30, 30, 40))
        else:
            a = rng.uniform(0, 2 * np.pi)
            pts = [(cx + R * np.cos(a + j * 2 * np.pi / 3), cy + R * np.sin(a + j * 2 * np.pi / 3)) for j in range(3)]
            d.polygon(pts, fill=(30, 30, 40))
    return np.asarray(im, float) / 255


def outline(kind="square", size=256, lw=3):
    im = Image.new("RGB", (size, size), (240, 240, 240))
    d = ImageDraw.Draw(im)
    m = size * 0.2
    if kind == "square":
        d.rectangle([m, m, size - m, size - m], outline=(20, 20, 20), width=lw)
    else:
        d.ellipse([m, m, size - m, size - m], outline=(20, 20, 20), width=lw)
    return np.asarray(im, float) / 255


def figure_on_ground(share=0.1, size=256):
    """A centred dark disk covering `share` of a light square."""
    r = np.sqrt(share * size * size / np.pi)
    y, x = np.mgrid[:size, :size] - (size - 1) / 2
    a = np.where(np.hypot(x, y) < r, 0.1, 0.9)
    return np.repeat(a[..., None], 3, 2)


def checker(n=8, size=256):
    y, x = np.mgrid[:size, :size] * n // size
    a = np.where((x + y) % 2 == 0, 0.1, 0.9)
    return np.repeat(a[..., None].astype(float), 3, 2)
