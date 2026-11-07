# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A deterministic note transcriber and the scores the suite uses.

Transcriber: harmonic-sum salience on an STFT (n_fft 4096 at 44.1 kHz, hop 10 ms),
pitches MIDI 28 to 100, eight harmonics weighted 0.85^(h - 1). Per frame the strongest pitch is taken, its
harmonic bins are attenuated, and the search repeats (up to `max_poly` pitches): iterative subtraction, which
suppresses the octave and fifth ghosts a plain harmonic sum leaves. Active frames become notes after a 3-frame
median, a minimum length of 60 ms, and a split wherever the pitch's own salience jumps by 6 dB (a re-strike).
A pitch after the first in a frame must reach a quarter of the first's salience. The long window blurs onsets, so
each note's onset is snapped to the nearest peak of a short-window (1024) spectral flux within 120 ms.
This is a measured, simple transcriber, not a learned one: it is weakest on dense polyphony and on voices.

Scores: note F1 matches notes one to one (Hungarian assignment) by equal MIDI pitch and onsets within 50 ms;
log-mel distance is the mean absolute difference of 64-band log-mel spectra in dB, floored 80 dB under peak.
"""
import numpy as np
from scipy.ndimage import median_filter
from scipy.optimize import linear_sum_assignment

from .stft import stft

LO, HI, HARM = 28, 100, 8


def hz(m):
    return 440.0 * 2 ** ((np.asarray(m, float) - 69) / 12)


def _comb(n_bins, fs, n_fft):
    """Weight matrix (pitches, bins) of the harmonic comb and a boolean mask of the bins it touches."""
    p = np.arange(LO, HI + 1)
    W = np.zeros((len(p), n_bins), np.float32)
    for i, m in enumerate(p):
        for h in range(1, HARM + 1):
            b = h * hz(m) * n_fft / fs
            k = int(round(b))
            if k >= n_bins - 1:
                break
            for kk in (k - 1, k, k + 1):
                W[i, kk] = max(W[i, kk], 0.85 ** (h - 1) * (1.0 if kk == k else 0.5))
    return p, W, W > 0


def notes(y, fs, max_poly=6, rel_db=-30.0, min_s=0.06):
    """Mono or stereo audio -> [[start_s, dur_s, midi, velocity 0..1], ...] sorted by start."""
    m = np.atleast_2d(y).mean(0)
    scale = max(1, int(round(fs / 44100)))
    n_fft, hop = 4096 * scale, int(round(0.01 * fs))
    mag = np.abs(stft(m, n_fft, hop)).astype(np.float32)
    pitches, W, M = _comb(mag.shape[0], fs, n_fft)
    floor = 10 ** (rel_db / 20) * float((W @ mag).max() + 1e-12)
    act = np.zeros((len(pitches), mag.shape[1]), np.float32)
    work = mag.copy()
    cols = np.arange(mag.shape[1])
    first = None
    for _ in range(max_poly):
        sal = W @ work
        best = sal.argmax(0)
        val = sal[best, cols]
        first = val if first is None else first
        on = (val > floor) & (val >= 0.25 * first)
        act[best[on], cols[on]] = val[on]
        work *= np.where(M[best].T & on[None, :], 0.15, 1.0).astype(np.float32)
    act = median_filter(act, size=(1, 3), mode="nearest")
    out = []
    min_f = max(1, int(round(min_s * fs / hop)))
    peak = float(act.max() + 1e-12)
    flux_t, flux = onset_flux(m, fs)
    for i, p in enumerate(pitches):
        a = act[i]
        on = a > 0
        if not on.any():
            continue
        edges = np.flatnonzero(np.diff(np.concatenate([[0], on.astype(int), [0]])))
        for s, e in zip(edges[::2], edges[1::2]):
            cuts = [s]
            seg = a[s:e]
            jump = np.flatnonzero(seg[2:] > 2.0 * np.maximum(seg[:-2], 1e-12)) + 2
            for j in jump:
                if j + s - cuts[-1] >= min_f:
                    cuts.append(j + s)
            cuts.append(e)
            for c0, c1 in zip(cuts[:-1], cuts[1:]):
                if c1 - c0 >= min_f:
                    vel = float(np.sqrt(a[c0:c1].max() / peak))
                    t0 = snap(c0 * hop / fs, flux_t, flux)
                    t1 = (c1 * hop / fs) - 0.5 * n_fft / fs * 0.5
                    out.append([round(float(t0), 4), round(float(max(min_s, t1 - t0)), 4), int(p), round(vel, 3)])
    return sorted(out)


def onset_flux(m, fs):
    """Times and values of a short-window positive log spectral flux."""
    hop = int(round(0.005 * fs))
    S = np.abs(stft(m, 1024 * max(1, int(round(fs / 44100))), hop))
    fl = np.maximum(np.diff(np.log(S + 1e-6), axis=1), 0).sum(0)
    return (np.arange(len(fl)) + 1) * hop / fs, fl


def snap(t, ft, fl, win=0.12):
    sel = np.flatnonzero(np.abs(ft - t) <= win)
    if len(sel) == 0:
        return t
    return float(ft[sel[np.argmax(fl[sel])]])


def note_f1(ref, est, tol=0.05):
    """One-to-one match by pitch and onset; returns precision, recall, f1 and counts."""
    if not ref or not est:
        return {"precision": 0.0, "recall": 0.0, "f1": 0.0, "ref": len(ref), "est": len(est)}
    r = np.array([[n[0], n[2]] for n in ref], float)
    e = np.array([[n[0], n[2]] for n in est], float)
    dt = np.abs(r[:, None, 0] - e[None, :, 0])
    ok = (dt <= tol) & (r[:, None, 1] == e[None, :, 1])
    cost = np.where(ok, dt, 1e6)
    ri, ei = linear_sum_assignment(cost)
    hits = int(ok[ri, ei].sum())
    p, rc = hits / len(est), hits / len(ref)
    f = 2 * p * rc / (p + rc) if p + rc else 0.0
    return {"precision": round(p, 3), "recall": round(rc, 3), "f1": round(f, 3), "ref": len(ref), "est": len(est)}


def _mel(fs, n_fft, n_mels=64, fmin=30.0):
    fmax = min(16000.0, fs / 2)
    mel = lambda f: 2595 * np.log10(1 + f / 700)
    inv = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = inv(np.linspace(mel(fmin), mel(fmax), n_mels + 2))
    f = np.fft.rfftfreq(n_fft, 1 / fs)
    fb = np.zeros((n_mels, len(f)))
    for i in range(n_mels):
        lo, c, hi = pts[i], pts[i + 1], pts[i + 2]
        fb[i] = np.clip(np.minimum((f - lo) / (c - lo), (hi - f) / (hi - c)), 0, None)
    return fb


def logmel(y, fs, n_fft=2048, hop=512):
    m = np.atleast_2d(y).mean(0)
    S = np.abs(stft(m, n_fft, hop)) ** 2
    return 10 * np.log10(_mel(fs, n_fft) @ S + 1e-12)


def logmel_distance(a, b, fs, floor_db=80.0):
    A, B = logmel(a, fs), logmel(b, fs)
    n = min(A.shape[1], B.shape[1])
    A, B = A[:, :n], B[:, :n]
    top = max(A.max(), B.max())
    A, B = np.maximum(A, top - floor_db), np.maximum(B, top - floor_db)
    return float(np.mean(np.abs(A - B)))


def si_sdr(ref, est):
    ref, est = np.atleast_2d(ref).mean(0), np.atleast_2d(est).mean(0)
    n = min(len(ref), len(est))
    ref, est = ref[:n], est[:n]
    a = np.dot(est, ref) / (np.dot(ref, ref) + 1e-20)
    t = a * ref
    return float(10 * np.log10((t @ t + 1e-20) / ((est - t) @ (est - t) + 1e-20)))
