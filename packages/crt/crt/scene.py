# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Source frames, 320 x 240 R'G'B' signal values in [0, 1]. Seeded, so a seed gives the same
frame bytes. The dungeon echoes the reference save: stone, a skeleton, a torch whose flame
flickers field by field."""
import numpy as np

W, H = 320, 240


def _rng(seed, field_no):
    return np.random.default_rng([int(seed), int(field_no) + 1_000_000])


def flat(level):
    img = np.full((H, W, 3), float(level))
    return lambda f: img


def drive_lines(levels=(0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 1.0), gap=24):
    """One white source line per level on black, for the spot-growth test."""
    img = np.zeros((H, W, 3))
    rows = [gap + i * gap for i in range(len(levels))]
    for r, v in zip(rows, levels):
        img[r, 40:280, :] = v
    return (lambda f: img), rows


def ball(speed_px=6, radius=10, y=120):
    """A white ball moving right on black, speed in source pixels per field."""
    yy, xx = np.mgrid[0:H, 0:W]

    def frame(f):
        cx = 60 + speed_px * (f % 40)
        d = np.sqrt((xx - cx) ** 2 + (yy - y) ** 2)
        v = np.clip(radius + 0.5 - d, 0, 1)
        return np.repeat(v[..., None], 3, axis=2)
    return frame


def _bricks(img, rng):
    yy, xx = np.mgrid[0:H, 0:W]
    row = yy // 16
    off = (row % 2) * 16
    mortar = ((yy % 16) < 2) | (((xx + off) % 32) < 2)
    tone = 0.16 + 0.05 * rng.random((H // 16 + 1, W // 32 + 2))[row, (xx + off) // 32]
    stone = np.stack([tone * 1.05, tone * 0.95, tone * 0.85], -1)
    img[:] = np.where(mortar[..., None], 0.05, stone)
    img[180:] = np.stack([0.10 + 0.02 * ((xx[180:] // 20 + yy[180:] // 10) % 2)] * 3, -1)


def _skeleton(img):
    bone = np.array([0.82, 0.80, 0.70])
    img[118:136, 196:212] = bone                      # skull
    img[124:128, 199:203] = 0.02
    img[124:128, 205:209] = 0.02                      # eyes
    img[136:178, 203:206] = bone                      # spine
    for r in range(142, 166, 6):
        img[r:r + 2, 194:216] = bone                  # ribs
    img[178:182, 196:214] = bone                      # pelvis
    img[182:214, 197:200] = bone
    img[182:214, 210:213] = bone                      # legs
    img[140:143, 184:226] = bone                      # arms
    img[143:170, 184:187] = bone
    img[143:170, 223:226] = bone


def _torch(img, rng):
    img[96:150, 98:104] = [0.30, 0.18, 0.08]          # handle
    img[92:97, 94:108] = [0.35, 0.30, 0.25]           # bracket
    yy, xx = np.mgrid[0:H, 0:W]
    flick = 0.85 + 0.15 * rng.random()
    dx, dy = (xx - 101) / 6.0, (yy - 80) / 14.0
    core = np.clip(1.2 - np.sqrt(dx ** 2 + dy ** 2), 0, 1) * flick
    flame = np.stack([np.clip(core * 1.4, 0, 1), np.clip(core * 1.0, 0, 1) ** 1.5, np.clip(core - 0.5, 0, 1)], -1)
    glow = np.exp(-((xx - 101) ** 2 + (yy - 85) ** 2) / (2 * 60.0 ** 2)) * 0.9 * flick
    img *= (0.35 + glow[..., None] * np.array([1.6, 1.1, 0.6]))
    img[:] = np.maximum(img, flame)


def dungeon(seed=1):
    def frame(f):
        rng = _rng(seed, f)
        img = np.zeros((H, W, 3))
        _bricks(img, np.random.default_rng(seed))
        _skeleton(img)
        _torch(img, rng)
        return np.clip(img, 0.0, 1.0)
    return frame
