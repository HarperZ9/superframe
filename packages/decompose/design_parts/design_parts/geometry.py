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


def rotational_symmetry(L, thr=0.8, search=0.06):
    """Best centre near the image centre; order = largest n whose rotation score passes thr."""
    h, w = L.shape
    best = (-1, h / 2, w / 2, {})
    for dy in np.linspace(-search, search, 5) * h:
        for dx in np.linspace(-search, search, 5) * w:
            cy, cx = (h - 1) / 2 + dy, (w - 1) / 2 + dx
            s = rotation_scores(L, cy, cx, orders=(2, 3, 4, 6))
            if max(s.values()) > best[0]:
                best = (max(s.values()), cy, cx, s)
    _, cy, cx, _ = best
    s = rotation_scores(L, cy, cx)
    passing = [n for n, v in s.items() if v >= thr]
    order = max(passing) if passing else 1
    return {"rot_order": int(order), "rot_strength": float(max(s.values())),
            "rot_strength_order": float(s.get(order, 0.0)) if order > 1 else 0.0,
            "rot_cy": float(cy / h), "rot_cx": float(cx / w)}


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
