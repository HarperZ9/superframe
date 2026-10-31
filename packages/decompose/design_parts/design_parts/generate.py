# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Render a composition from design parameters, on raw geometry: a flat ground, filled shapes and lines.

No source pixels enter a render. Parameters are named after the features that measure them, so a
grammar fitted on measurements can drive the renderer and the renders can be measured again:

  palette_count  number of colours (ground included); harm_m1 hue concentration; hue_cos, hue_sin
  mean hue; L_key and L_range lightness; chroma_mean; neg_space target share of empty ground;
  prim_count shapes; straight_share share of straight-edged shapes; prim_size_cv size spread; sym_lr
  probability that a shape gets a mirror twin; focal_x, focal_y cluster centre; line_weight stroke
  width (px at 256); self_sim share of shapes placed on a repeated lattice; orth_share share of
  axis-aligned shapes; spec_slope edge softness (steeper slope, softer edges).
Constraints: palette_fixed forces the colour count; grid forces shape centres onto a grid x grid lattice.
"""
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from .channels import _lab_to_rgb

AXES = ["palette_count", "harm_m1", "hue_cos", "hue_sin", "L_key", "L_range", "chroma_mean", "neg_space",
        "prim_count", "straight_share", "prim_size_cv", "sym_lr", "focal_x", "focal_y", "line_weight", "self_sim",
        "orth_share", "spec_slope"]


def _palette(p, k, rng):
    mu = np.arctan2(p["hue_sin"], p["hue_cos"])
    m1 = float(np.clip(p["harm_m1"], 0.02, 0.999))
    sd = np.sqrt(-2 * np.log(m1))
    hues = mu + rng.normal(0, sd, k)
    Lk, Lr = float(np.clip(p["L_key"], 5, 95)), float(np.clip(p["L_range"], 5, 95))
    Ls = np.clip(Lk + (rng.permutation(np.linspace(-0.5, 0.5, k)) if k > 1 else np.zeros(1)) * Lr, 2, 98)
    ch = np.clip(rng.normal(p["chroma_mean"] * 1.6, 6, k), 0, 90)
    lab = np.stack([Ls, ch * np.cos(hues), ch * np.sin(hues)], 1)
    return [tuple(int(255 * c) for c in _lab_to_rgb(x[None])[0]) for x in lab]


def _shape_pts(kind, cx, cy, r, ang):
    if kind == "circle":
        return None
    n = 4 if kind == "quad" else 3
    return [(cx + r * np.cos(ang + 2 * np.pi * j / n), cy + r * np.sin(ang + 2 * np.pi * j / n)) for j in range(n)]


def render(p, size=384, seed=0, palette_fixed=None, grid=None):
    """Returns an (size, size, 3) float RGB array."""
    rng = np.random.default_rng(seed)
    k = int(np.clip(round(palette_fixed if palette_fixed else p["palette_count"]), 1, 10))
    cols = _palette(p, k, rng)
    im = Image.new("RGB", (size, size), cols[0])
    d = ImageDraw.Draw(im)
    n = int(np.clip(round(p["prim_count"]), 0, 40))
    cover = float(np.clip(1 - p["neg_space"], 0.02, 0.98))
    cv = float(np.clip(p["prim_size_cv"], 0.0, 3.0))
    sig = np.sqrt(np.log(1 + cv * cv))
    sizes = rng.lognormal(0, sig, max(n, 1))
    area_each = cover * size * size / max(n, 1) / (1 + 0.6 * np.clip(p["sym_lr"], 0, 1))
    radii = np.sqrt(area_each * sizes / sizes.mean() / np.pi)
    fx, fy = float(np.clip(p["focal_x"], 0.05, 0.95)), float(np.clip(p["focal_y"], 0.05, 0.95))
    spread = 0.15 + 0.35 * cover
    rep = float(np.clip(p["self_sim"], 0, 1))
    n_rep = int(round(rep * n))
    period = max(12.0, size / max(2, int(np.sqrt(max(n_rep, 1))) + 1))
    shared_kind = "quad" if rng.random() < p["straight_share"] else "circle"
    for i in range(n):
        if i < n_rep:  # motif: same kind and size on a lattice
            gx, gy = i % max(1, int(np.sqrt(n_rep))), i // max(1, int(np.sqrt(n_rep)))
            cx, cy = period * (gx + 1), period * (gy + 1)
            r, kind, ang = float(np.median(radii)) * 0.8, shared_kind, 0.0
        else:
            cx, cy = rng.normal(fx, spread) * size, rng.normal(fy, spread) * size
            r = radii[i]
            kind = ("quad" if rng.random() < 0.6 else "tri") if rng.random() < p["straight_share"] else "circle"
            ang = 0.0 if rng.random() < p["orth_share"] else rng.uniform(0, np.pi)
            if kind == "quad" and ang == 0.0:
                ang = np.pi / 4  # axis-aligned square
        if grid:
            step = size / grid
            cx, cy = (np.floor(cx / step) + 0.5) * step, (np.floor(cy / step) + 0.5) * step
        col = cols[1 + i % (k - 1)] if k > 1 else tuple(255 - c for c in cols[0])
        twins = [(cx, cy)] + ([(size - cx, cy)] if rng.random() < p["sym_lr"] else [])
        for x, y in twins:
            pts = _shape_pts(kind, x, y, r, ang)
            if pts is None:
                d.ellipse([x - r, y - r, x + r, y + r], fill=col)
            else:
                d.polygon(pts, fill=col)
    lw = float(np.clip(p["line_weight"], 0, 20)) * size / 256
    if lw >= 1 and n > 0:
        for j in range(max(1, n // 4)):
            col = cols[(j + 1) % k] if k > 1 else (0, 0, 0)
            if rng.random() < p["orth_share"]:
                if rng.random() < 0.5:
                    y = rng.uniform(0.1, 0.9) * size
                    d.line([(0, y), (size, y)], fill=col, width=int(round(lw)))
                else:
                    x = rng.uniform(0.1, 0.9) * size
                    d.line([(x, 0), (x, size)], fill=col, width=int(round(lw)))
            else:
                a, b = rng.uniform(0, size, 2), rng.uniform(0, size, 2)
                d.line([tuple(a), tuple(b)], fill=col, width=int(round(lw)))
    blur = float(np.clip(-p["spec_slope"] - 2.0, 0, 2.5)) * 1.5
    if blur > 0.2:
        im = im.filter(ImageFilter.GaussianBlur(blur))
    return np.asarray(im, float) / 255
