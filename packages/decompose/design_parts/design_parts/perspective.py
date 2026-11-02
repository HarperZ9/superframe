# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Perspective and framing: line segments, vanishing points, horizon, framing ratio, figure-ground.

Segments (an LSD-style detector rebuilt in numpy): edge pixels (gradient magnitude above the 85th
percentile and above an absolute floor) are binned by orientation into 24 bins with half-bin overlap;
each connected run of one bin whose pixels are elongated (second-moment ratio > 25, length >= 12 px)
becomes one segment, fitted by its principal axis.

Vanishing points: RANSAC over pairs of segment lines. A segment supports a point when the angle
between the segment and the ray from its midpoint to the point is under 2 degrees. Up to three points
are kept, each removing its inliers. Points can lie far outside the frame; a point beyond 20 image
widths is reported as a direction at infinity (parallel lines).
Horizon: the line through the two strongest finite non-vertical vanishing points (weight >= 0.15),
as a height fraction at the image centre; with one such point, or with parallel horizontals, the
horizontal line through the strongest.

Figure-ground: an Otsu split on lightness. Figure is the class touching the border less. Reversibility
is high when the two readings compete: equal areas, equal border contact, equal compactness.
framing_ratio: area of the bounding box of salient content over the image area.
"""
import numpy as np
from scipy import ndimage as ndi

from .geometry import gradients, saliency
from .imageio import lightness
from .texture import otsu

N_BINS = 24


def segments(L, min_len=12, q=0.85):
    gx, gy, mag, ang = gradients(L)
    floor = max(np.quantile(mag, q), 0.8)
    e = mag > floor
    th = np.mod(ang + np.pi / 2, np.pi)  # edge direction (perpendicular to gradient)
    segs = []
    for shift in (0.0, 0.5):
        b = np.floor(th / np.pi * N_BINS + shift).astype(int) % N_BINS
        for k in range(N_BINS):
            comp, n = ndi.label(e & (b == k), structure=np.ones((3, 3)))
            if n == 0:
                continue
            for sl, i in zip(ndi.find_objects(comp), range(1, n + 1)):
                ys, xs = np.nonzero(comp[sl] == i)
                if len(ys) < min_len:
                    continue
                ys, xs = ys + sl[0].start, xs + sl[1].start
                P = np.stack([xs, ys], 1).astype(float)
                c = P.mean(0)
                C = np.cov((P - c).T)
                w, V = np.linalg.eigh(C)
                if w[0] <= 0 or w[1] / max(w[0], 1e-9) < 25:
                    continue
                d = V[:, 1]
                t = (P - c) @ d
                if t.max() - t.min() < min_len:
                    continue
                segs.append((c + t.min() * d, c + t.max() * d))
    return _dedupe(segs)


def _dedupe(segs):
    out = []
    for p, q in sorted(segs, key=lambda s: -np.linalg.norm(s[1] - s[0])):
        m = (p + q) / 2
        dup = False
        for a, b in out:
            if np.linalg.norm((a + b) / 2 - m) < 3:
                dup = True
                break
        if not dup:
            out.append((p, q))
    return out


def _line(p, q):
    return np.cross(np.append(p, 1), np.append(q, 1))


def _support(segs, vp, tol_deg=2.0):
    """vp is homogeneous (x, y, w). Returns boolean inliers."""
    out = np.zeros(len(segs), bool)
    for i, (p, q) in enumerate(segs):
        m, d = (p + q) / 2, q - p
        if abs(vp[2]) < 1e-9:
            r = vp[:2]
        else:
            r = vp[:2] / vp[2] - m
        c = abs(d @ r) / (np.linalg.norm(d) * np.linalg.norm(r) + 1e-12)
        out[i] = c > np.cos(np.deg2rad(tol_deg))
    return out


def vanishing_points(segs, w, h, k=3, iters=600, seed=0, min_support=4):
    rng = np.random.default_rng(seed)
    left = list(range(len(segs)))
    vps = []
    lengths = np.array([np.linalg.norm(q - p) for p, q in segs]) if segs else np.array([])
    for _ in range(k):
        if len(left) < min_support:
            break
        best, best_in = None, None
        sub = [segs[i] for i in left]
        for _ in range(iters):
            i, j = rng.choice(len(sub), 2, replace=False)
            vp = np.cross(_line(*sub[i]), _line(*sub[j]))
            if np.linalg.norm(vp) < 1e-12:
                continue
            vp = vp / np.linalg.norm(vp)
            inl = _support(sub, vp)
            score = lengths[left][inl].sum()
            if best is None or score > best[0]:
                best, best_in = (score, vp), inl
        if best is None or best_in.sum() < min_support:
            break
        vp = _refine([s for s, f in zip(sub, best_in) if f], best[1])
        far = abs(vp[2]) < 1e-9 or np.linalg.norm(vp[:2] / vp[2] - [w / 2, h / 2]) > 20 * w
        vps.append({"x": None if far else float(vp[0] / vp[2] / w), "y": None if far else float(vp[1] / vp[2] / h),
                    "dir": float(np.degrees(np.arctan2(vp[1], vp[0])) % 180), "finite": not far,
                    "support": int(best_in.sum()), "weight": float(best[0] / max(lengths.sum(), 1e-9))})
        left = [i for i, f in zip(left, best_in) if not f]
    return vps


def _refine(segs, vp0):
    A = np.array([_line(p, q) / np.linalg.norm(_line(p, q)[:2]) for p, q in segs])
    _, _, Vt = np.linalg.svd(A)
    v = Vt[-1]
    return v / np.linalg.norm(v) if v @ vp0 >= 0 else -v / np.linalg.norm(v)


def horizon(vps, min_weight=0.15):
    """Horizon height (fraction) at the image centre, or None.

    Vertical vanishing points (far above or below the frame) are skipped. With parallel horizontals
    (a point at infinity within 10 degrees of horizontal) the horizon is the level of the strongest
    finite point; otherwise it is the line through the two strongest finite points."""
    fin = [v for v in vps if v["finite"] and v["weight"] >= min_weight
           and not (abs(v["y"] - 0.5) > 3 and abs(v["x"] - 0.5) < 1.5)]
    if not fin:
        return None
    fin = sorted(fin, key=lambda v: -v["weight"])
    flat = any((not v["finite"]) and min(v["dir"], 180 - v["dir"]) < 10 for v in vps)
    if len(fin) == 1 or flat:
        return float(fin[0]["y"])
    a, b = fin[:2]
    if abs(b["x"] - a["x"]) < 1e-6:
        return float(a["y"])
    return float(a["y"] + (b["y"] - a["y"]) * (0.5 - a["x"]) / (b["x"] - a["x"]))


def figure_ground(L):
    t = otsu(L)
    A = L >= t
    out = {}
    stats = []
    for m in (A, ~A):
        area = m.mean()
        border = np.concatenate([m[0], m[-1], m[:, 0], m[:, -1]]).mean()
        comp, n = ndi.label(m)
        if n:
            sizes = np.bincount(comp.ravel())[1:]
            big = comp == (np.argmax(sizes) + 1)
            per = (big ^ ndi.binary_erosion(big)).sum()
            compact = 4 * np.pi * big.sum() / max(per, 1) ** 2
        else:
            compact = 0.0
        stats.append((area, border, min(compact, 1.0)))
    fig = 0 if stats[0][1] < stats[1][1] else 1
    (a1, b1, c1), (a2, b2, c2) = stats
    out["fg_ratio"] = float(stats[fig][0])
    out["fg_border_gap"] = float(abs(b1 - b2))
    rev = (1 - abs(a1 - a2)) * (1 - abs(b1 - b2)) * (1 - abs(c1 - c2) / max(c1, c2, 1e-9))
    out["fg_reversibility"] = float(rev)
    return out


def framing(rgb, L=None):
    s = saliency(rgb, L)
    m = s >= np.quantile(s, 0.85)
    ys, xs = np.nonzero(m)
    h, w = s.shape
    box = (ys.max() - ys.min() + 1) * (xs.max() - xs.min() + 1) / (h * w)
    return {"framing_ratio": float(box), "frame_cx": float(xs.mean() / w), "frame_cy": float(ys.mean() / h)}


def measure(rgb):
    L = lightness(rgb)
    h, w = L.shape
    segs = segments(L)
    vps = vanishing_points(segs, w, h)
    hz = horizon(vps)
    ang = np.array([np.degrees(np.arctan2(q[1] - p[1], q[0] - p[0])) % 180 for p, q in segs]) if segs else np.array([])
    out = {"n_segments": len(segs), "n_vp": len(vps), "n_vp_finite": sum(v["finite"] for v in vps),
           "vp1_x": vps[0]["x"] if vps and vps[0]["finite"] else np.nan,
           "vp1_y": vps[0]["y"] if vps and vps[0]["finite"] else np.nan,
           "vp_weight": float(sum(v["weight"] for v in vps)), "horizon_y": np.nan if hz is None else hz,
           "seg_oblique_share": float(np.mean((np.minimum(ang % 90, 90 - ang % 90) > 15))) if len(ang) else 0.0}
    out.update(figure_ground(L))
    out.update(framing(rgb, L))
    return out, {"segments": segs, "vps": vps}
