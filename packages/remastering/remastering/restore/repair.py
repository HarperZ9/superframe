# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Time-domain repair: declip, declick, decrackle, short gaps, long gaps from the track's own structure.

Every function returns (audio, regions): a region is (start_s, end_s, kind, confidence), where kind is "restored"
(rebuilt from the samples around it, short) or "inferred" (filled from elsewhere in the track or by a model).
- declip: samples at or above 99.5% of the peak in runs of 2 or more are clipped; LSAR fills them, then each filled
  sample is pushed out to at least the clip level with its run's sign (a clipped sample was at least that large).
- declick: AR(32) residual on 4096-sample blocks; samples whose residual passes k times its robust spread, widened
  by 2 samples, are filled by LSAR. decrackle is the same with a lower k and no widening.
- short gaps: runs of exact zeros (or a given mask) up to 2048 samples, LSAR.
- long gaps: the stretch whose surroundings best match the gap's (normalised correlation of the 1.5 s before and
  after, over every candidate offset) is copied in with 20 ms crossfades; the match score is the confidence, and the
  copy is scaled by it (a weak match is a guess, and a quieter guess costs less when it is wrong).
"""
import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import fftconvolve, lfilter

from . import ar


def _regions(runs_, fs, kind, conf):
    return [(round(s / fs, 4), round(e / fs, 4), kind, conf) for s, e in runs_]


def declip(y, fs, level=0.995, order=32, iters=6):
    """Consistent declipping by an active set: solve LSAR for the clipped samples; any that come back under the clip
    level (or with the wrong sign) are pinned at the clip level and the rest solved again, until none violate."""
    y = np.atleast_2d(np.asarray(y, np.float64)).copy()
    peak = np.abs(y).max()
    clip = level * peak
    regions = []
    for c in range(y.shape[0]):
        x = y[c]
        m = np.abs(x) >= clip
        for s, e in ar.runs(m):
            if e - s < 2 or e - s > 2048:
                continue
            ctx = min(2048, max(8 * order, 3 * (e - s)))
            a0, b0 = max(0, s - ctx), min(len(x), e + ctx)
            seg = x[a0:b0].copy()
            sign = np.sign(seg)
            miss = np.zeros(len(seg), bool)
            miss[s - a0:e - a0] = True
            clean = ~(np.abs(seg) >= clip)
            a = ar.fit(seg[clean] if clean.sum() > 4 * order else seg, order)
            free = miss.copy()
            for _ in range(iters):
                z = ar.lsar(seg, free, order, a=a)
                bad = free & ((np.abs(z) < clip) | (np.sign(z) != sign))
                if not bad.any():
                    break
                seg = np.where(bad, sign * clip, z)
                free &= ~bad
            else:
                z = ar.lsar(seg, free, order, a=a)
            x[a0:b0] = np.where(miss, z, x[a0:b0])
            regions.append((int(s), int(e)))
        y[c] = x
    return y, _regions(regions, fs, "restored", 0.6)


def detect_clicks(x, k=6.0, block=4096, order=32, widen=2, local=512, max_len=8):
    """Samples whose AR residual passes k times the local spread (mean |e| over `local` samples, times sqrt(pi/2),
    which is sigma for Gaussian residuals), kept only
    in runs of at most `max_len` samples: a click is short and stands out from its own surroundings, which keeps
    note attacks (long, and loud in their surroundings too) from being taken for clicks."""
    e_all = np.zeros(len(x))
    for s in range(0, len(x), block):
        seg = x[max(0, s - order):s + block]
        if len(seg) < 4 * order:
            continue
        a = ar.fit(seg, order)
        e = lfilter(a, [1.0], seg)
        e = e[order:] if s > 0 else e
        e_all[s:s + len(e)] = e[: len(x) - s]
    ae = np.abs(e_all)
    spread = 1.2533 * uniform_filter1d(ae, size=local, mode="nearest") + 1e-12
    hit = ae > k * spread
    mask = np.zeros(len(x), bool)
    for s, e in ar.runs(hit):
        if e - s <= max_len:
            mask[s:e] = True
    if widen:
        mask = np.convolve(mask.astype(float), np.ones(2 * widen + 1), "same") > 0
    return mask


def declick(y, fs, k=6.0, widen=2, kind="restored"):
    y = np.atleast_2d(np.asarray(y, np.float64)).copy()
    regions = []
    for c in range(y.shape[0]):
        m = detect_clicks(y[c], k=k, widen=widen)
        y[c], done = ar.fill_runs(y[c], m, 32, context=256)
        regions += _regions(done, fs, kind, 0.8)
    return y, regions


def decrackle(y, fs, k=6.0):
    return declick(y, fs, k=k, widen=0)


def fill_gaps(y, fs, mask=None, min_zero_run=8):
    """Short gaps (runs of exact digital silence inside signal, or `mask`) by LSAR."""
    y = np.atleast_2d(np.asarray(y, np.float64)).copy()
    regions = []
    for c in range(y.shape[0]):
        if mask is None:
            z = y[c] == 0.0
            m = np.zeros_like(z)
            for s, e in ar.runs(z):
                if e - s >= min_zero_run and s > 0 and e < len(z):
                    m[s:e] = True
        else:
            m = np.asarray(mask, bool)
        y[c], done = ar.fill_runs(y[c], m)
        regions += _regions(done, fs, "restored", 0.7)
    return y, regions


def _ncc(ctx, x):
    """Normalised cross-correlation of template ctx against every offset of x."""
    n = len(ctx)
    num = fftconvolve(x, ctx[::-1], mode="valid")
    e = np.sqrt(np.maximum(fftconvolve(x * x, np.ones(n), mode="valid"), 1e-20))
    return num / (e * (np.linalg.norm(ctx) + 1e-20))


def fill_long_gap(y, fs, start, stop, ctx_s=1.5, fade_s=0.02, hop=4, shrink_by_score=True):
    """Fill [start, stop) samples from the stretch whose surroundings match best. Returns (audio, regions, info)."""
    y = np.atleast_2d(np.asarray(y, np.float64)).copy()
    L, c = stop - start, int(ctx_s * fs)
    mono = y.mean(0)
    dec = mono[::hop]
    pre, post = dec[(start - c) // hop:start // hop], dec[stop // hop:(stop + c) // hop]
    if len(pre) < 10 or len(post) < 10:
        return y, [], {"score": 0.0}
    s_pre = _ncc(pre, dec)
    s_post = _ncc(post, dec)
    cand = np.full(len(s_pre), -np.inf)
    lag = (stop - (start - c)) // hop
    ok = np.arange(len(s_pre)) + lag < len(s_post)
    idx = np.flatnonzero(ok)
    cand[idx] = 0.5 * (s_pre[idx] + s_post[idx + lag])
    i = np.arange(len(cand)) * hop                   # a candidate's source stretch is [i + c, i + c + L)
    cand[(i < stop) & (i > start - 2 * c - L)] = -np.inf      # never copy from the gap or its own context
    best = int(np.argmax(cand)) if np.isfinite(cand).any() else None
    if best is None:
        return y, [], {"score": 0.0}
    src = best * hop + c                    # the source stretch begins where its "pre" ends
    shrink = float(np.clip(cand[best], 0.0, 1.0)) if shrink_by_score else 1.0
    f = int(fade_s * fs)
    ramp = np.linspace(0, 1, f) if f else np.zeros(0)
    for ch in range(y.shape[0]):
        piece = y[ch, src - f:src + L + f].copy()
        seg = y[ch, start - f:stop + f].copy()
        w = np.ones(L + 2 * f)
        w[:f], w[-f:] = ramp, ramp[::-1]
        y[ch, start - f:stop + f] = seg * (1 - w) + piece * w * shrink
    score = float(cand[best])
    return y, [(round(start / fs, 4), round(stop / fs, 4), "inferred", round(max(0.0, score), 3))], \
        {"score": score, "source_s": round(src / fs, 3)}
