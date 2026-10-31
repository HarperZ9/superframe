# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Palette: hue distribution, harmony relations and value structure.

palette_count   number of distinct colours (Lab k-means, k 10, centres within dE 12 merged,
                clusters holding >= 2% of pixels counted).
hue_hist        12-bin hue histogram weighted by chroma (Lab a*b* angle), sums to 1 when chromatic.
harmony m1..m3  circular moments of the chroma-weighted hue distribution: m1 concentration
                (analogous), m2 two-pole (complementary), m3 three-pole (triadic). A single hue gives
                m1 = m2 = m3 = 1; two opposite hues give m1 = 0, m2 = 1; three at 120 degrees give m3 = 1.
value           lightness quantiles, range, key, dark share, number of value levels.
"""
import numpy as np

from .imageio import srgb_to_lab

MERGE_DE, MIN_SHARE, K = 12.0, 0.02, 10


def kmeans(X, k, seed=0, iters=25):
    rng = np.random.default_rng(seed)
    C = X[rng.choice(len(X), 1)]
    for _ in range(1, k):  # k-means++ seeding
        d = ((X[:, None] - C[None]) ** 2).sum(-1).min(1)
        if d.sum() <= 0:
            break
        C = np.vstack([C, X[rng.choice(len(X), 1, p=d / d.sum())]])
    for _ in range(iters):
        lab = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
        newC = np.array([X[lab == j].mean(0) if (lab == j).any() else C[j] for j in range(len(C))])
        if np.allclose(newC, C):
            break
        C = newC
    lab = ((X[:, None] - C[None]) ** 2).sum(-1).argmin(1)
    return C, lab


def palette(rgb, seed=0, n_sample=6000):
    lab = srgb_to_lab(rgb).reshape(-1, 3)
    rng = np.random.default_rng(seed)
    X = lab[rng.choice(len(lab), min(n_sample, len(lab)), replace=False)]
    C, lbl = kmeans(X, K, seed)
    share = np.bincount(lbl, minlength=len(C)) / len(lbl)
    order = np.argsort(-share)
    groups = []  # greedy merge by share
    for j in order:
        for g in groups:
            if np.linalg.norm(C[j] - C[g[0]]) < MERGE_DE:
                g.append(j)
                break
        else:
            groups.append([j])
    centres, shares = [], []
    for g in groups:
        w = share[g]
        if w.sum() >= MIN_SHARE:
            centres.append((C[g] * w[:, None]).sum(0) / w.sum())
            shares.append(w.sum())
    return np.array(centres), np.array(shares)


def hue_stats(rgb, bins=12):
    lab = srgb_to_lab(rgb).reshape(-1, 3)
    chroma = np.hypot(lab[:, 1], lab[:, 2])
    ang = np.arctan2(lab[:, 2], lab[:, 1])
    w = np.where(chroma > 8, chroma, 0.0)
    out = {"chroma_mean": float(chroma.mean()), "chromatic_share": float((chroma > 8).mean())}
    hist = np.histogram((ang % (2 * np.pi)), bins=bins, range=(0, 2 * np.pi), weights=w)[0]
    tot = w.sum()
    if tot <= 0:
        out.update({"hue_hist": [0.0] * bins, "hue_entropy": 0.0, "harm_m1": 0.0, "harm_m2": 0.0,
                    "harm_m3": 0.0, "hue_mean": 0.0})
        return out
    hist = hist / tot
    p = hist[hist > 0]
    out["hue_hist"] = hist.tolist()
    out["hue_entropy"] = float(-(p * np.log(p)).sum() / np.log(bins))
    for m in (1, 2, 3):
        out[f"harm_m{m}"] = float(abs((w * np.exp(1j * m * ang)).sum()) / tot)
    out["hue_mean"] = float(np.angle((w * np.exp(1j * ang)).sum()) % (2 * np.pi))
    return out


def harmony_label(h):
    """Names the strongest relation; returns 'achromatic' when there is no chroma to read."""
    if h["chromatic_share"] < 0.05:
        return "achromatic"
    m1, m2, m3 = h["harm_m1"], h["harm_m2"], h["harm_m3"]
    if m1 > 0.8:
        return "monochrome" if m1 > 0.95 else "analogous"
    if m2 > max(m3, 0.5) and m1 < 0.5:
        return "complementary"
    if m3 > max(m2, 0.5) and m1 < 0.5:
        return "triadic"
    return "mixed"


def value_structure(rgb):
    L = srgb_to_lab(rgb)[..., 0].ravel()
    q = np.percentile(L, [5, 50, 95])
    hist = np.histogram(np.clip(L, 0, 100), bins=20, range=(0, 100))[0].astype(float)
    hs = np.convolve(hist, [0.25, 0.5, 0.25], "same")
    peaks = [i for i in range(20) if hs[i] > 0.04 * len(L) and hs[i] >= hs[max(i - 1, 0)] and hs[i] >= hs[min(i + 1, 19)]]
    return {"L_p5": float(q[0]), "L_p50": float(q[1]), "L_p95": float(q[2]), "L_range": float(q[2] - q[0]),
            "L_key": float(L.mean()), "dark_share": float((L < 25).mean()), "value_levels": len(peaks)}


def measure(rgb):
    C, s = palette(rgb)
    h = hue_stats(rgb)
    out = {"palette_count": int(len(C)), "palette_top_share": float(s.max()) if len(s) else 1.0}
    out.update({k: v for k, v in h.items() if k != "hue_hist"})
    out["harmony"] = harmony_label(h)
    out.update(value_structure(rgb))
    return out
