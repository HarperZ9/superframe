# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Image comparison primitives: perceptual hash, radial spectrum, feature distance, copied-region
search and per-cell attribution.

The copied-region search answers one question: how much of the output's area is a region that
also appears in the source, after the source is moved, scaled or rotated? It aligns the two images
three ways (identity on a common size, phase-correlation translation, and ORB keypoints with
RANSAC homographies), warps the source onto the output, marks 8 px windows where both are textured
and correlate (local NCC above 0.9, which ignores a recolour or a tone curve), and reports the largest connected marked region as a share of the output's area. Flat
windows never count, so a shared plain background is not a copied region.
"""
import cv2
import numpy as np
from scipy import ndimage
from scipy.fft import dctn

cv2.setNumThreads(1)
WIN = 8
LOOSE_INLIERS = 15


def gray(a):
    return a[..., :3] @ np.array([0.299, 0.587, 0.114]) if a.ndim == 3 else a


def phash_bits(a):
    g = cv2.resize(gray(a).astype(np.float32), (32, 32), interpolation=cv2.INTER_AREA)
    d = dctn(g, norm="ortho")[:8, :8].ravel()
    return d[1:] > np.median(d[1:])


def phash_hex(a):
    b = np.concatenate([[False], phash_bits(a)])
    return "%016x" % int("".join("1" if x else "0" for x in b), 2)


def phash_distance(a, b):
    """Normalised Hamming distance of 63-bit pHashes: 0 identical, about 0.5 unrelated."""
    return float(np.mean(phash_bits(a) != phash_bits(b)))


def phash_distance_hex(h1, h2):
    return bin(int(h1, 16) ^ int(h2, 16)).count("1") / 63.0


def radial_spectrum(L, bins=8):
    F = np.abs(np.fft.fftshift(np.fft.fft2(L - L.mean()))) ** 2
    h, w = L.shape
    y, x = np.indices(F.shape)
    r = np.hypot((y - h / 2) / h, (x - w / 2) / w)
    edges = np.geomspace(1.0 / max(h, w), 0.5, bins + 1)
    out = []
    for a, b in zip(edges[:-1], edges[1:]):
        sel = F[(r >= a) & (r < b)]
        out.append(round(float(np.log10(sel.mean() + 1e-12)), 3) if sel.size else None)
    return out


def feature_distance(fa, fb):
    """Mean Canberra distance over shared finite design-parts features: 0 equal, 1 far apart."""
    ks = [k for k in fa if k in fb and isinstance(fa[k], (int, float)) and isinstance(fb[k], (int, float))
          and np.isfinite(fa[k]) and np.isfinite(fb[k])]
    if not ks:
        return None
    a, b = np.array([fa[k] for k in ks], float), np.array([fb[k] for k in ks], float)
    return float(np.mean(np.abs(a - b) / (np.abs(a) + np.abs(b) + 1e-9)))


def _u8(a):
    return (np.clip(gray(a), 0, 1) * 255).astype(np.uint8)


def _homographies(src, out, max_models=3):
    orb = cv2.ORB_create(nfeatures=3000, fastThreshold=7)
    ks, ds = orb.detectAndCompute(_u8(src), None)
    ko, do = orb.detectAndCompute(_u8(out), None)
    if ds is None or do is None or len(ks) < 8 or len(ko) < 8:
        return []
    m = cv2.BFMatcher(cv2.NORM_HAMMING).knnMatch(do, ds, k=2)
    good = [p[0] for p in m if len(p) == 2 and p[0].distance < 0.8 * p[1].distance]
    Hs = []
    while len(good) >= 8 and len(Hs) < max_models:
        po = np.float32([ko[g.queryIdx].pt for g in good])
        ps = np.float32([ks[g.trainIdx].pt for g in good])
        H, mask = cv2.findHomography(ps, po, cv2.RANSAC, 4.0)
        if H is None or mask.sum() < 8:
            break
        Hs.append((H, int(mask.sum())))
        good = [g for g, keep in zip(good, mask.ravel()) if not keep]
    return Hs


def _stretch(g, valid):
    """Global contrast stretch (2nd to 98th percentile over the valid area), so a washed-out or
    darkened copy is judged on the same footing as its source."""
    v = g[valid] if valid.any() else g.ravel()
    lo, hi = np.percentile(v, [2, 98])
    return (g - lo) / max(hi - lo, 0.05)


def _ncc(a, b, win):
    k = np.ones((win, win)) / win ** 2
    ma, mb = ndimage.convolve(a, k, mode="reflect"), ndimage.convolve(b, k, mode="reflect")
    va = ndimage.convolve(a * a, k, mode="reflect") - ma ** 2
    vb = ndimage.convolve(b * b, k, mode="reflect") - mb ** 2
    cov = ndimage.convolve(a * b, k, mode="reflect") - ma * mb
    ncc = cov / np.sqrt(np.maximum(va, 1e-9) * np.maximum(vb, 1e-9))
    return ncc, np.sqrt(np.maximum(va, 0)), np.sqrt(np.maximum(vb, 0))


def _agree(out, warped, valid, loose=True):
    """Boolean map of output pixels covered by agreeing textured windows, at two scales.

    Both images are contrast-stretched and high-passed (minus a Gaussian blur, sigma 3), so smooth
    gradients and flat grounds never count. A pixel matches when an 8 px window correlates above
    0.9, or a 24 px window above 0.6; the larger window catches copies overlaid with other
    material (a ghost, a mirror, a texture) whose local correlation drops but stays well above
    chance.
    """
    go, gw = _stretch(gray(out), valid), _stretch(gray(warped), valid)
    ho, hw = go - ndimage.gaussian_filter(go, 3), gw - ndimage.gaussian_filter(gw, 3)
    core = ndimage.binary_erosion(valid, np.ones((24, 24)))
    hit = np.zeros(valid.shape, bool)
    for win, thr in ((WIN, 0.9), (24, 0.6))[:2 if loose else 1]:
        ncc, so, sw = _ncc(ho, hw, win)
        centre = (so > 0.02) & (sw > 0.02) & (ncc > thr) & core
        hit |= ndimage.binary_dilation(centre, np.ones((win, win)))
    return hit & valid


def copied_region(src, out):
    """Largest region of `out` reproduced from `src`, as a share of out's area, and the method."""
    h, w = out.shape[:2]
    cands = [("identity", cv2.resize(src.astype(np.float32), (w, h), interpolation=cv2.INTER_AREA),
              np.ones((h, w), bool), False)]
    s2 = cands[0][1]
    (dx, dy), resp = cv2.phaseCorrelate(gray(s2).astype(np.float32), gray(out).astype(np.float32))
    if resp > 0.05:
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        cands.append(("translation", cv2.warpAffine(s2, M, (w, h)),
                      cv2.warpAffine(np.ones((h, w), np.uint8), M, (w, h)) > 0, False))
    for i, (H, n_in) in enumerate(_homographies(src, out)):
        cands.append((f"homography{i}", cv2.warpPerspective(src.astype(np.float32), H, (w, h)),
                      cv2.warpPerspective(np.ones(src.shape[:2], np.uint8), H, (w, h)) > 0, n_in >= LOOSE_INLIERS))
    union = np.zeros((h, w), bool)
    best, how = 0.0, None
    for name, warped, valid, loose in cands:
        if warped.ndim == 2 and out.ndim == 3:
            warped = np.repeat(warped[..., None], 3, -1)
        ag = _agree(out, warped, valid, loose)
        union |= ag
        lab, n = ndimage.label(ag)
        if n:
            share = float(np.bincount(lab.ravel())[1:].max()) / (h * w)
            if share > best:
                best, how = share, name
    return {"largest_region_share": round(best, 5), "method": how,
            "matched_area_share": round(float(union.mean()), 5)}


# -- attribution -----------------------------------------------------------------
CELL = 16


def _cells(a, stride):
    g = gray(a)
    h, w = g.shape
    out = []
    for y in range(0, h - CELL + 1, stride):
        for x in range(0, w - CELL + 1, stride):
            out.append(cv2.resize(g[y:y + CELL, x:x + CELL].astype(np.float32), (8, 8),
                                  interpolation=cv2.INTER_AREA).ravel())
    X = np.array(out, float)
    sd = X.std(1)
    Xn = (X - X.mean(1, keepdims=True)) / np.maximum(sd, 1e-9)[:, None]
    return Xn / 8.0, sd


def attribution(out, sources, ncc_min=0.9):
    """Share of the output's textured cells best explained by each source (rest is new)."""
    O, osd = _cells(out, CELL)
    tex = osd > 0.03
    best = np.full(len(O), -1.0)
    who = np.full(len(O), -1)
    for i, s in enumerate(sources):
        s = cv2.resize(s.astype(np.float32), (out.shape[1], out.shape[0]), interpolation=cv2.INTER_AREA)
        S, ssd = _cells(s, 4)
        S = S[ssd > 0.03]
        if not len(S):
            continue
        c = (O @ S.T).max(1)
        upd = c > best
        best[upd], who[upd] = c[upd], i
    n = max(1, int(tex.sum()))
    explained = tex & (best >= ncc_min)
    cell = [float((explained & (who == i)).sum()) / n for i in range(len(sources))]
    # cells sit on a fixed grid, so a rescaled or shifted copy can slip past them; the aligned
    # copied-region search catches that case, and the larger of the two readings is kept
    region = [copied_region(s, out)["matched_area_share"] for s in sources]
    shares = [round(max(c, r), 4) for c, r in zip(cell, region)]
    return {"shares": shares, "cell_shares": [round(c, 4) for c in cell], "aligned_shares": region,
            "unexplained": round(max(0.0, 1 - sum(shares)), 4), "textured_cells": int(tex.sum())}
