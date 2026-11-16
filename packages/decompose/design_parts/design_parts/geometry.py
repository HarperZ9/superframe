# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Geometry: symmetry type and strength, grid alignment, proportion ratios and focal point.

All measures read lightness L on the working copy. Coordinates are fractions of width and height,
origin top left.
"""
import numpy as np
from scipy import ndimage as ndi

from .imageio import lightness

PHI = (np.sqrt(5) - 1) / 2  # 0.618


def _corr(a, b):
    a, b = a - a.mean(), b - b.mean()
    d = np.sqrt((a * a).sum() * (b * b).sum())
    return float((a * b).sum() / d) if d > 0 else 0.0


def mirror_scores(L):
    return {"sym_lr": _corr(L, L[:, ::-1]), "sym_ud": _corr(L, L[::-1, :])}


def polar(L, cy, cx, n_r=48, n_t=360, rmax=None):
    h, w = L.shape
    rmax = rmax or 0.95 * min(cy, cx, h - 1 - cy, w - 1 - cx)
    r = np.linspace(rmax * 0.08, rmax, n_r)
    t = np.linspace(0, 2 * np.pi, n_t, endpoint=False)
    R, T = np.meshgrid(r, t, indexing="ij")
    return ndi.map_coordinates(L, [cy + R * np.sin(T), cx + R * np.cos(T)], order=1, mode="nearest"), r


def rotation_scores(L, cy, cx, orders=range(2, 13), n_t=360):
    P, r = polar(L, cy, cx, n_t=n_t)
    P = P - P.mean(1, keepdims=True)
    w = r / r.sum() if r.sum() > 0 else np.ones_like(r) / len(r)
    out = {}
    for n in orders:
        k = int(round(n_t / n))
        num = (w[:, None] * P * np.roll(P, k, 1)).sum()
        den = (w[:, None] * P * P).sum()
        out[n] = float(num / den) if den > 0 else 0.0
    return out


def stroke_width(L):
    """Typical stroke width in pixels of the marks that differ from the ground, and their share.

    Ink is every pixel more than a third of the lightness range from the median
    (the ground). For long thin strokes, area = width * length and the ink/ground
    boundary is about 2 * length, so width ~ 2 * area / boundary.
    """
    span = float(L.max() - L.min())
    if span <= 1e-9:
        return 0.0, 0.0
    ink = np.abs(L - np.median(L)) > span / 3
    area = int(ink.sum())
    if area == 0:
        return 0.0, 0.0
    boundary = int((ink[:, 1:] != ink[:, :-1]).sum() + (ink[1:, :] != ink[:-1, :]).sum())
    return 2.0 * area / max(boundary, 1), area / ink.size


LINE_WIDTH_MAX, LINE_SHARE_MAX = 3.0, 0.3


def symmetry_scales(L):
    """Gaussian scales (px) to score at. Thin-line drawings get coarser scales as well.

    A rotation score is a correlation; for 1 px lines a sub-pixel centre error
    or a raster rounding of a few strokes drops it near zero. Smoothing to about
    the spacing a raster can be off by (a few px at the 256 px working size)
    restores the match while leaving filled shapes and photographs at scale 0.
    """
    width, share = stroke_width(L)
    if 0 < width <= LINE_WIDTH_MAX and share <= LINE_SHARE_MAX:
        return (0.0, 1.5, 3.0)
    return (0.0,)


def _best_centre(L, search, steps, around=None, orders=(2, 3, 4, 6)):
    h, w = L.shape
    cy0, cx0 = around or ((h - 1) / 2, (w - 1) / 2)
    best = (-np.inf, cy0, cx0)
    for dy in np.linspace(-search[0], search[0], steps):
        for dx in np.linspace(-search[1], search[1], steps):
            s = rotation_scores(L, cy0 + dy, cx0 + dx, orders=orders)
            if max(s.values()) > best[0]:
                best = (max(s.values()), cy0 + dy, cx0 + dx)
    return best[1], best[2]


def rotational_symmetry(L, thr=0.8, search=0.12):
    """Best centre near the image centre; order = largest n whose rotation score passes thr.

    The centre is found coarse to fine (an 11 x 11 grid over +/- search of the
    size on a smoothed copy, then two finer passes down to about half a pixel).
    Thin-line drawings are also scored at the coarser scales from
    `symmetry_scales`; the scale with the strongest passing order wins, and
    `rot_scale` reports it.
    """
    h, w = L.shape
    best = None
    for sigma in symmetry_scales(L):
        Ls = ndi.gaussian_filter(L, sigma) if sigma else L
        guide = ndi.gaussian_filter(L, max(sigma, 3.0))   # a smooth surface for the coarse pass
        cy, cx = _best_centre(guide, (search * h, search * w), 11)
        step = 2 * search * max(h, w) / 10
        for _ in range(2):
            cy, cx = _best_centre(Ls, (step, step), 5, around=(cy, cx))
            step /= 4
        s = rotation_scores(Ls, cy, cx)
        passing = [n for n, v in s.items() if v >= thr]
        order = max(passing) if passing else 1
        key = (order > 1, s.get(order, 0.0) if order > 1 else max(s.values()))
        if best is None or key > best[0]:
            best = (key, sigma, cy, cx, s, order)
    _, sigma, cy, cx, s, order = best
    return {"rot_order": int(order), "rot_strength": float(max(s.values())),
            "rot_strength_order": float(s.get(order, 0.0)) if order > 1 else 0.0,
            "rot_cy": float(cy / h), "rot_cx": float(cx / w), "rot_scale": float(sigma)}


def gradients(L):
    gy, gx = np.gradient(ndi.gaussian_filter(L, 1.0))
    return gx, gy, np.hypot(gx, gy), np.arctan2(gy, gx)


def grid_alignment(L):
    gx, gy, mag, ang = gradients(L)
    if mag.sum() <= 0:
        return {"orth_share": 0.0, "grid_peak_x": 0.0, "grid_peak_y": 0.0}
    a = np.mod(ang, np.pi / 2)
    near = (np.minimum(a, np.pi / 2 - a) < np.deg2rad(10))
    out = {"orth_share": float((mag * near).sum() / mag.sum())}
    for key, prof in (("grid_peak_x", np.abs(gx).sum(0)), ("grid_peak_y", np.abs(gy).sum(1))):
        p = np.sort(prof)[::-1]
        out[key] = float(p[: max(1, len(p) // 20)].sum() / max(p.sum(), 1e-9))  # top 5% of lines' share
    return out


def saliency(rgb, L=None):
    """Contrast saliency: blurred gradient energy plus colour distance from the mean colour."""
    from .imageio import srgb_to_lab
    lab = srgb_to_lab(rgb)
    L = lab[..., 0] if L is None else L
    _, _, mag, _ = gradients(L)
    dist = np.linalg.norm(lab - lab.reshape(-1, 3).mean(0), axis=-1)
    s = ndi.gaussian_filter(mag / (mag.max() + 1e-9), 6) + ndi.gaussian_filter(dist / (dist.max() + 1e-9), 6)
    return s


def focal_point(rgb, L=None):
    s = saliency(rgb, L)
    h, w = s.shape
    thr = np.quantile(s, 0.98)
    m = s >= thr
    ys, xs = np.nonzero(m)
    wts = s[m]
    fy, fx = float((ys * wts).sum() / wts.sum() / (h - 1)), float((xs * wts).sum() / wts.sum() / (w - 1))
    thirds = [(a, b) for a in (1 / 3, 2 / 3) for b in (1 / 3, 2 / 3)]
    golden = [(a, b) for a in (1 - PHI, PHI) for b in (1 - PHI, PHI)]
    d = lambda pts: float(min(np.hypot(fx - b, fy - a) for a, b in pts))  # noqa: E731
    return {"focal_x": fx, "focal_y": fy, "focal_strength": float(s.max() / (s.mean() + 1e-9)),
            "focal_d_center": float(np.hypot(fx - 0.5, fy - 0.5)), "focal_d_thirds": d(thirds),
            "focal_d_golden": d(golden)}


def proportions(rgb, L=None):
    """Aspect ratio and the strongest vertical and horizontal division lines, as fractions."""
    L = lightness(rgb) if L is None else L
    h, w = L.shape
    gx, gy, _, _ = gradients(L)
    out = {"aspect": float(w / h)}
    for key, prof, n in (("split_x", ndi.gaussian_filter1d(np.abs(gx).sum(0), 2), w),
                         ("split_y", ndi.gaussian_filter1d(np.abs(gy).sum(1), 2), h)):
        lo, hi = int(0.08 * n), int(0.92 * n)
        i = lo + int(np.argmax(prof[lo:hi]))
        f = i / (n - 1)
        out[key] = float(f)
        g = min(abs(f - PHI), abs(f - (1 - PHI)))
        t = min(abs(f - 1 / 3), abs(f - 2 / 3))
        out[key + "_golden_d"] = float(g)
        out[key + "_thirds_d"] = float(t)
    return out


def measure(rgb):
    L = lightness(rgb)
    out = mirror_scores(L)
    out.update(rotational_symmetry(L))
    out.update(grid_alignment(L))
    out.update(proportions(rgb, L))
    out.update(focal_point(rgb, L))
    return out
