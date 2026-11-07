# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Loudness to ITU-R BS.1770-4 and EBU R128 (Tech 3341, Tech 3342).

K-weighting: a high shelf (+4 dB above about 1.7 kHz, head effects) and a high pass (RLB, about 38 Hz), from the
analog prototypes through the bilinear transform at any rate, so at 48 kHz they reproduce the standard's tabled
coefficients (checked in the tests). Mean square per channel, channel weights 1, 1, 1, 1.41, 1.41 (L, R, C, Ls,
Rs), loudness = -0.691 + 10 log10(sum G_i z_i).

- momentary: 400 ms window; short-term: 3 s window; both stepped every 100 ms here.
- integrated: 400 ms blocks with 75% overlap, absolute gate -70 LUFS, relative gate -10 LU.
- LRA (Tech 3342): short-term values, absolute gate -70 LUFS, relative gate -20 LU, 95th minus 10th percentile.
- true peak (BS.1770-4 Annex 2): oversampled 4x below 96 kHz, 2x below 192 kHz, with the suite's band-limited
  interpolator, peak of the absolute value in dBTP.
"""
import math

import numpy as np
from scipy.signal import lfilter

from .resample import oversample

WEIGHTS = (1.0, 1.0, 1.0, 1.41, 1.41)


def k_weighting(fs):
    """(b, a) of the shelf and the high pass at `fs`."""
    f0, g, q = 1681.974450955533, 3.999843853973347, 0.7071752369554196
    k = math.tan(math.pi * f0 / fs)
    vh = 10 ** (g / 20)
    vb = vh ** 0.4996667741545416
    a0 = 1 + k / q + k * k
    b1 = [(vh + vb * k / q + k * k) / a0, 2 * (k * k - vh) / a0, (vh - vb * k / q + k * k) / a0]
    a1 = [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    f0, q = 38.13547087602444, 0.5003270373238773
    k = math.tan(math.pi * f0 / fs)
    a0 = 1 + k / q + k * k
    b2 = [1.0, -2.0, 1.0]
    a2 = [1.0, 2 * (k * k - 1) / a0, (1 - k / q + k * k) / a0]
    return (b1, a1), (b2, a2)


def _weighted_power(y, fs):
    """K-weighted squared signal per channel, (channels, n)."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    (b1, a1), (b2, a2) = k_weighting(fs)
    z = lfilter(b2, a2, lfilter(b1, a1, y, axis=1), axis=1)
    return z * z


def _block_power(p, fs, window, step):
    """Channel-weighted mean square over windows of `window` s every `step` s; returns (blocks,)."""
    w, s = int(round(window * fs)), int(round(step * fs))
    n = p.shape[1]
    if n < w:
        return np.zeros(0)
    c = np.concatenate([np.zeros((p.shape[0], 1)), np.cumsum(p, axis=1)], axis=1)
    starts = np.arange(0, n - w + 1, s)
    ms = (c[:, starts + w] - c[:, starts]) / w
    g = np.array([WEIGHTS[i] if i < len(WEIGHTS) else 1.0 for i in range(p.shape[0])])
    return (g[:, None] * ms).sum(0)


def _lufs(power):
    return -0.691 + 10 * np.log10(np.maximum(power, 1e-300))


def integrated(y, fs, _p=None):
    p = _weighted_power(y, fs) if _p is None else _p
    z = _block_power(p, fs, 0.4, 0.1)
    if z.size == 0:
        return float("-inf")
    z = z[_lufs(z) > -70.0]
    if z.size == 0:
        return float("-inf")
    rel = _lufs(z.mean()) - 10.0
    z = z[_lufs(z) > rel]
    return float(_lufs(z.mean())) if z.size else float("-inf")


def momentary(y, fs, _p=None):
    p = _weighted_power(y, fs) if _p is None else _p
    return _lufs(_block_power(p, fs, 0.4, 0.1))


def short_term(y, fs, _p=None):
    p = _weighted_power(y, fs) if _p is None else _p
    return _lufs(_block_power(p, fs, 3.0, 0.1))


def lra(y, fs, _p=None):
    p = _weighted_power(y, fs) if _p is None else _p
    z = _block_power(p, fs, 3.0, 0.1)
    z = z[_lufs(z) > -70.0]
    if z.size == 0:
        return 0.0
    rel = _lufs(z.mean()) - 20.0
    st = _lufs(z[_lufs(z) > rel])
    return float(np.percentile(st, 95) - np.percentile(st, 10))


def true_peak(y, fs):
    """True peak in dBTP."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    factor = 4 if fs < 96000 else (2 if fs < 192000 else 1)
    up = oversample(y, factor) if factor > 1 else y
    pk = float(np.max(np.abs(up))) if up.size else 0.0
    return 20 * math.log10(max(pk, 1e-12))


def sample_peak(y):
    return 20 * math.log10(max(float(np.max(np.abs(y))), 1e-12))


def subblocks(p, fs):
    """Channel-weighted K-weighted power summed over each 100 ms step: every gating block is four of these."""
    s = int(round(0.1 * fs))
    nb = p.shape[1] // s
    g = np.array([WEIGHTS[i] if i < len(WEIGHTS) else 1.0 for i in range(p.shape[0])])
    return (g[:, None] * p[:, : nb * s]).sum(0).reshape(nb, s), s


def integrated_with_gain(p, gain, fs, sub=None):
    """Integrated loudness of y * gain from y's K-weighted power p (K-weighting is linear, and the gain moves slowly
    against the filters' memory, so weighting before or after the gain agrees to a few hundredths of a LU; the final
    result is measured exactly). `sub` is subblocks(p, fs), reusable across calls."""
    rows, s = sub if sub is not None else subblocks(p, fs)
    g2 = np.asarray(gain, np.float64)[: rows.size].reshape(rows.shape) ** 2
    z4 = (rows * g2).sum(1)
    if len(z4) < 4:
        return float("-inf")
    z = (z4[:-3] + z4[1:-2] + z4[2:-1] + z4[3:]) / (4 * s)
    z = z[_lufs(z) > -70.0]
    if z.size == 0:
        return float("-inf")
    rel = _lufs(z.mean()) - 10.0
    z = z[_lufs(z) > rel]
    return float(_lufs(z.mean())) if z.size else float("-inf")


def measure(y, fs, peak_env=None):
    """Every R128 number at once; `peak_env` (from dynamics.peak_envelope) saves a second oversampling."""
    p = _weighted_power(y, fs)
    st = short_term(y, fs, p)
    mo = momentary(y, fs, p)
    return {"integrated_lufs": round(integrated(y, fs, p), 2),
            "short_term_max_lufs": round(float(st.max()), 2) if st.size else None,
            "momentary_max_lufs": round(float(mo.max()), 2) if mo.size else None,
            "lra_lu": round(lra(y, fs, p), 2),
            "true_peak_dbtp": round(true_peak(y, fs) if peak_env is None else 20 * math.log10(max(float(np.max(peak_env)), 1e-12)), 2),
            "sample_peak_dbfs": round(sample_peak(y), 2)}
