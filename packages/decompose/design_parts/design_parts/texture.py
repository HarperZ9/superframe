# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Negative space, line weight, motif repetition and spectrum slope.

neg_space       share of 8x8-pixel blocks (on the 256 px working copy) that are flat: lightness
                standard deviation < 2.5 and chroma standard deviation < 3.
line_weight     stroke width in pixels at 256 px of the minority (ink) class after an Otsu split on
                lightness: twice the median distance-transform value on the stroke ridges.
self_sim        height of the strongest autocorrelation peak outside the central lobe (0 to 1).
rhythm          strongest non-DC peak of the row and column edge profiles, as a share of profile power,
                and its period in pixels.
spec_slope      slope of the radially averaged power spectrum of lightness, log-log, 4 to N/4 cycles.
"""
import numpy as np
from scipy import ndimage as ndi

from .imageio import srgb_to_lab


def negative_space(rgb, block=8):
    lab = srgb_to_lab(rgb)
    h, w = lab.shape[:2]
    h2, w2 = h // block * block, w // block * block
    t = lab[:h2, :w2].reshape(h2 // block, block, w2 // block, block, 3)
    sdL = t[..., 0].std(axis=(1, 3))
    sdC = np.hypot(t[..., 1], t[..., 2]).std(axis=(1, 3))
    flat = (sdL < 2.5) & (sdC < 3)
    if not flat.any():
        return {"neg_space": 0.0, "flat_share": 0.0}
    mean = t.mean(axis=(1, 3))[flat]
    q = np.round(mean / 6)
    vals, inv, cnt = np.unique(q, axis=0, return_inverse=True, return_counts=True)
    ground = mean[inv.ravel() == np.argmax(cnt)].mean(0)
    near = np.linalg.norm(t.mean(axis=(1, 3)) - ground, axis=-1) < 12
    return {"neg_space": float((flat & near).mean()), "flat_share": float(flat.mean())}


def otsu(x, bins=128):
    hist, edges = np.histogram(x, bins=bins)
    p = hist / hist.sum()
    c = (edges[:-1] + edges[1:]) / 2
    w0 = np.cumsum(p)
    m = np.cumsum(p * c)
    mt = m[-1]
    with np.errstate(divide="ignore", invalid="ignore"):
        sb = (mt * w0 - m) ** 2 / (w0 * (1 - w0))
    sb[~np.isfinite(sb)] = 0
    return float(c[int(np.argmax(sb))])


def ink_mask(L):
    t = otsu(L)
    dark = L < t
    return dark if dark.mean() <= 0.5 else ~dark


def line_weight(L):
    ink = ink_mask(L)
    if ink.sum() < 20:
        return {"line_weight": 0.0, "ink_share": float(ink.mean())}
    dt = ndi.distance_transform_edt(ink)
    ridge = (dt == ndi.maximum_filter(dt, 3)) & (dt >= 1)
    v = dt[ridge]
    return {"line_weight": float(2 * np.median(v) - 1) if len(v) else 0.0, "ink_share": float(ink.mean())}


def autocorr(L):
    a = L - L.mean()
    F = np.fft.fft2(a, s=(2 * a.shape[0], 2 * a.shape[1]))
    ac = np.fft.ifft2(np.abs(F) ** 2).real
    ac = np.fft.fftshift(ac)
    return ac / ac.max() if ac.max() > 0 else ac


def self_similarity(L):
    ac = autocorr(L)
    cy, cx = np.array(ac.shape) // 2
    h, w = L.shape
    Y, X = np.ogrid[:ac.shape[0], :ac.shape[1]]
    r = np.hypot(Y - cy, X - cx)
    # central lobe radius: first radius where the radial mean falls below 0.2
    rb = np.bincount(r.astype(int).ravel(), ac.ravel()) / np.maximum(np.bincount(r.astype(int).ravel()), 1)
    below = np.nonzero(rb < 0.2)[0]
    r0 = int(below[0]) if len(below) else 4
    win = (r > max(r0, 3)) & (np.abs(Y - cy) < h / 2) & (np.abs(X - cx) < w / 2)
    # normalise by overlap so distant peaks are not penalised by the shrinking overlap
    ov = (h - np.abs(Y - cy)).clip(1) * (w - np.abs(X - cx)).clip(1) / (h * w)
    acn = np.where(win, ac / ov, -np.inf)
    acn[win & (ov < 0.25)] = -np.inf
    return {"self_sim": float(np.clip(acn.max(), 0, 1)) if np.isfinite(acn.max()) else 0.0}


def rhythm(L):
    gy, gx = np.gradient(L)
    best, period = 0.0, 0.0
    for prof in (np.abs(gx).sum(0), np.abs(gy).sum(1)):
        p = prof - prof.mean()
        P = np.abs(np.fft.rfft(p * np.hanning(len(p)))) ** 2
        if P[1:].sum() <= 0:
            continue
        top = P[2:].max()
        k = 2 + int(np.nonzero(P[2:] >= 0.5 * top)[0][0])  # fundamental: lowest strong peak
        while k + 1 < len(P) and P[k + 1] > P[k]:
            k += 1
        s = float(P[k] / P[1:].sum())
        if s > best:
            best, period = s, len(p) / k
    return {"rhythm": best, "rhythm_period": float(period)}


def spectrum_slope(L, fmin=4):
    h, w = L.shape
    n = min(h, w)
    a = L[(h - n) // 2:(h - n) // 2 + n, (w - n) // 2:(w - n) // 2 + n]
    a = (a - a.mean()) * np.outer(np.hanning(n), np.hanning(n))
    P = np.abs(np.fft.fftshift(np.fft.fft2(a))) ** 2
    Y, X = np.indices(P.shape)
    r = np.hypot(Y - n // 2, X - n // 2).astype(int)
    rad = np.bincount(r.ravel(), P.ravel()) / np.maximum(np.bincount(r.ravel()), 1)
    f = np.arange(len(rad))
    sel = (f >= fmin) & (f <= n // 4) & (rad > 0)
    if sel.sum() < 4:
        return {"spec_slope": 0.0}
    return {"spec_slope": float(np.polyfit(np.log(f[sel]), np.log(rad[sel]), 1)[0])}


def measure(rgb):
    L = srgb_to_lab(rgb)[..., 0]
    out = negative_space(rgb)
    out.update(line_weight(L))
    out.update(self_similarity(L))
    out.update(rhythm(L))
    out.update(spectrum_slope(L))
    return out
