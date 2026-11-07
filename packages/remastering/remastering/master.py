# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The mastering chain: EQ (linear or minimum phase), multiband compression, width, loudness to target, true-peak
limit, dither. Presets name the targets; reference match fits the EQ and the dynamics to a chosen track.

Loudness is set by gain before the limiter and checked after it; because the limiter takes level off the peaks,
the gain is corrected and the limiter rerun (two passes), and the receipt records the measured result, not the
target.
"""
import numpy as np
from scipy.signal import welch

from . import dither as D
from . import dynamics as DY
from . import eq as EQ
from . import loudness as LD
from . import stereo as ST

PRESETS = {
    "streaming": {"target_lufs": -14.0, "ceiling_dbtp": -1.0, "eq": [], "eq_phase": "linear",
                  "multiband": {"crossovers": [120.0, 1000.0, 6000.0],
                                "bands": [{"threshold": -24, "ratio": 2.0, "attack": 0.03, "release": 0.25},
                                          {"threshold": -22, "ratio": 1.6, "attack": 0.02, "release": 0.2},
                                          {"threshold": -24, "ratio": 1.5, "attack": 0.01, "release": 0.15},
                                          {"threshold": -28, "ratio": 1.4, "attack": 0.005, "release": 0.1}]},
                  "width": 1.0, "mono_below": 120.0, "bits": 16, "dither": "lipshitz5"},
    "dynamic": {"target_lufs": -18.0, "ceiling_dbtp": -1.0, "eq": [], "eq_phase": "linear", "multiband": None,
                "width": 1.0, "mono_below": None, "bits": 24, "dither": "none"},
    "archival": {"target_lufs": None, "ceiling_dbtp": -1.0, "eq": [], "eq_phase": "linear", "multiband": None,
                 "width": 1.0, "mono_below": None, "bits": 24, "dither": "none"},
}


def ltas_db(y, fs, nper=8192):
    """Long-term average spectrum of the mono sum, dB, and its frequencies."""
    m = np.atleast_2d(y).mean(0)
    f, p = welch(m, fs, nperseg=min(nper, len(m)), window="hann")
    return f, 10 * np.log10(np.maximum(p, 1e-30))


def smooth_octave(f, db, fraction=6):
    """Fractional-octave smoothing in the power domain."""
    out = np.empty_like(db)
    p = 10 ** (db / 10)
    for i, fc in enumerate(f):
        if fc <= 0:
            out[i] = db[i]
            continue
        lo, hi = fc * 2 ** (-0.5 / fraction), fc * 2 ** (0.5 / fraction)
        sel = (f >= lo) & (f <= hi)
        out[i] = 10 * np.log10(p[sel].mean())
    return out


def match_curve(y, ref, fs, limit_db=12.0, lo=30.0, hi=18000.0):
    """EQ curve (freqs, dB) that moves y's smoothed long-term spectrum onto the reference's, level-normalised."""
    f, a = ltas_db(y, fs)
    _, b = ltas_db(ref, fs)
    d = smooth_octave(f, b, 3) - smooth_octave(f, a, 3)
    band = (f >= 200) & (f <= 4000)
    d -= np.median(d[band])
    d = np.clip(d, -limit_db, limit_db)
    d[f < lo] = d[np.argmax(f >= lo)]
    d[f > hi] = d[np.argmin(f <= hi) - 1]
    return f[1:], d[1:]


def fit_ratio(y, fs, target_lra, threshold_offset=-6.0, ratios=(1.0, 1.25, 1.5, 2.0, 3.0, 4.0)):
    """Broadband compression ratio whose output LRA lands nearest the reference's (threshold relative to the
    input's integrated loudness)."""
    thr = LD.integrated(y, fs) + threshold_offset
    best = (1.0, abs(LD.lra(y, fs) - target_lra))
    for r in ratios[1:]:
        out, _ = DY.compress(y, fs, threshold=thr, ratio=r, attack=0.02, release=0.3)
        err = abs(LD.lra(out, fs) - target_lra)
        if err < best[1]:
            best = (r, err)
    return {"threshold": thr, "ratio": best[0], "attack": 0.02, "release": 0.3}


def reference_settings(y, ref, fs):
    """A preset fitted to a reference: EQ curve, broadband ratio, loudness and ceiling from the reference."""
    f, d = match_curve(y, ref, fs)
    m = LD.measure(ref, fs)
    eqd = EQ.apply_fir(y, EQ.fir_from_curve(f, d, fs))
    comp = fit_ratio(eqd, fs, m["lra_lu"])
    return {"target_lufs": m["integrated_lufs"], "ceiling_dbtp": min(-0.1, m["true_peak_dbtp"]), "eq": [],
            "eq_curve": [f.tolist(), d.tolist()], "eq_phase": "linear", "multiband": None, "compressor": comp,
            "width": 1.0, "mono_below": None, "bits": 24, "dither": "none", "reference": m}


def run(y, fs, settings, seed=0, before=None):
    """Master (channels, n). Returns (float output on the PCM grid, int PCM, report). `before` may carry a loudness
    measurement the caller already made of the same input."""
    s = settings
    before = before or LD.measure(y, fs, DY.peak_envelope(y))
    x = np.atleast_2d(np.asarray(y, np.float64))
    if s.get("eq_curve"):
        f, d = s["eq_curve"]
        x = EQ.apply_fir(x, EQ.fir_from_curve(np.array(f), np.array(d), fs))
    if s.get("eq"):
        x = EQ.linear_phase(x, s["eq"], fs) if s.get("eq_phase") == "linear" else EQ.minimum_phase(x, s["eq"], fs)
    if s.get("compressor"):
        x, _ = DY.compress(x, fs, **s["compressor"])
    if s.get("multiband"):
        mb = s["multiband"]
        x, _ = DY.multiband(x, fs, mb["crossovers"], _relative(mb["bands"], x, fs))
    if x.shape[0] == 2 and (s.get("width", 1.0) != 1.0 or s.get("mono_below")):
        x = ST.width(x, s.get("width", 1.0), s.get("mono_below"), fs)
    gain_db = 0.0
    pk = DY.peak_envelope(x)                         # oversampled once; every gain trial reuses it
    pw = LD._weighted_power(x, fs)                   # K-weighted once; every gain trial reuses it
    sub = LD.subblocks(pw, fs)
    blk = 8                                          # the search runs the limiter law on 8-sample peak blocks
    nb = len(pk) // blk
    pkd = pk[: nb * blk].reshape(nb, blk).max(1)
    for _ in range(8):
        g = 10 ** (gain_db / 20)
        if s.get("target_lufs") is None:
            break
        gd = DY.limit_gain(pkd, g, fs / blk, s["ceiling_dbtp"])
        gfull = np.concatenate([np.repeat(gd, blk), np.full(len(pk) - nb * blk, gd[-1] if nb else 1.0)])
        err = s["target_lufs"] - LD.integrated_with_gain(pw, g * gfull, fs, sub)
        if abs(err) < 0.02:
            break
        gain_db += err
    g = 10 ** (gain_db / 20)
    z = x * (g * DY.limit_gain(pk, g, fs, s["ceiling_dbtp"]))[None, :]
    z, _ = DY.true_peak_limit(z, fs, s["ceiling_dbtp"], passes=2)   # verify between samples, trim any remainder
    out, pcm = D.requantise(z, s.get("bits", 24), s.get("dither", "none"), seed=seed)
    after = LD.measure(out, fs)
    return out, pcm, {"before": before, "after": after, "gain_db": round(gain_db, 3), "settings": _public(s)}


def _relative(bands, x, fs):
    """Band thresholds in the presets are relative to -14 LUFS programme; shift them to this input's loudness."""
    shift = LD.integrated(x, fs) - (-14.0)
    return [dict(b, threshold=b["threshold"] + shift) for b in bands]


def _public(s):
    return {k: v for k, v in s.items() if k != "eq_curve"} | ({"eq_curve_points": len(s["eq_curve"][0])} if s.get("eq_curve") else {})
