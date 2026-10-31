# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Shape vocabulary: primitive counts and curvature against straight edges.

Primitives: the image is split into its palette classes (Lab k-means, the palette module's centres);
each connected region of at least 0.15% of the image is one primitive, classified by convex-hull
circularity 4 pi A / P_hull^2 (disk 1.0, square 0.785, equilateral triangle 0.605) and solidity
A / A_hull: solidity < 0.85 is 'irregular'; else circularity > 0.9 'circle', > 0.72 'quad', else
'tri'. Regions that touch the border on two or more sides are ground, not primitives.

Edges: pixels in the top 10% of gradient magnitude. Curvature at an edge pixel is the change in edge
orientation between the two points 4 px away along the tangent, over 8 px. An edge pixel is straight
when that change is below 3 degrees.
"""
import numpy as np
from scipy import ndimage as ndi
from scipy.spatial import ConvexHull

from .geometry import gradients
from .imageio import srgb_to_lab
from .palette import palette

MIN_AREA = 0.0015


def _classify(mask):
    ys, xs = np.nonzero(mask)
    A = len(ys)
    pts = np.unique(np.concatenate([np.stack([xs + dx, ys + dy], 1) for dx in (0, 1) for dy in (0, 1)]), axis=0)
    try:
        hull = ConvexHull(pts.astype(float))
    except Exception:  # degenerate (a line): count as irregular
        return "irregular", 0.0, 0.0
    circ = 4 * np.pi * hull.volume / hull.area ** 2
    sol = A / hull.volume
    if sol < 0.85:
        return "irregular", circ, sol
    return ("circle" if circ > 0.9 else "quad" if circ > 0.72 else "tri"), circ, sol


def regions(rgb, centres=None, max_regions=None):
    """Primitive regions: list of dicts {mask, bbox (y0, x0, y1, x1), kind, colour (Lab), area}."""
    lab = srgb_to_lab(rgb)
    if centres is None:
        centres, _ = palette(rgb)
    if len(centres) == 0:
        return []
    lbl = ((lab[..., None, :] - centres[None, None]) ** 2).sum(-1).argmin(-1)
    lbl = ndi.median_filter(lbl, 3)
    h, w = lbl.shape
    out = []
    for j in range(len(centres)):
        comp, n = ndi.label(lbl == j)
        if n == 0:
            continue
        sizes = np.bincount(comp.ravel())[1:]
        objs = ndi.find_objects(comp)
        for i in np.nonzero(sizes >= MIN_AREA * h * w)[0]:
            sl = objs[i]
            m = comp[sl] == i + 1
            sides = int(sl[0].start == 0) + int(sl[0].stop == h) + int(sl[1].start == 0) + int(sl[1].stop == w)
            if sides >= 2:
                continue
            k, _, _ = _classify(m)
            out.append({"mask": m, "bbox": (sl[0].start, sl[1].start, sl[0].stop, sl[1].stop), "kind": k,
                        "colour": centres[j], "area": int(sizes[i])})
    out.sort(key=lambda r: -r["area"])
    return out[:max_regions] if max_regions else out


def primitives(rgb, centres=None):
    regs = regions(rgb, centres)
    counts = {"circle": 0, "quad": 0, "tri": 0, "irregular": 0}
    for r in regs:
        counts[r["kind"]] += 1
    a = np.array([r["area"] for r in regs], float)
    out = {"prim_count": len(regs)}
    out.update({f"prim_{k}": int(v) for k, v in counts.items()})
    out["prim_size_cv"] = float(a.std() / a.mean()) if len(a) > 1 else 0.0
    return out


def curvature(L, step=4, thr_deg=3.0):
    gx, gy, mag, ang = gradients(L)
    if mag.max() <= 0:
        return {"straight_share": 0.0, "curv_median": 0.0, "edge_density": 0.0}
    e = mag >= max(np.quantile(mag, 0.90), 1e-6)
    ys, xs = np.nonzero(e)
    th = ang[ys, xs]
    tx, ty = -np.sin(th), np.cos(th)  # tangent direction
    def samp(sign):
        yy, xx = ys + sign * step * ty, xs + sign * step * tx
        c = ndi.map_coordinates(np.cos(2 * ang), [yy, xx], order=1, mode="nearest")
        s = ndi.map_coordinates(np.sin(2 * ang), [yy, xx], order=1, mode="nearest")
        return np.arctan2(s, c) / 2
    a1, a2 = samp(+1), samp(-1)
    d = np.abs(np.angle(np.exp(2j * (a1 - a2)))) / 2
    k = d / (2 * step)
    return {"straight_share": float((np.rad2deg(d) < thr_deg).mean()), "curv_median": float(np.median(k)),
            "edge_density": float(e.mean() * mag[e].mean() / 100)}


def measure(rgb, centres=None):
    out = primitives(rgb, centres)
    out.update(curvature(srgb_to_lab(rgb)[..., 0]))
    return out
