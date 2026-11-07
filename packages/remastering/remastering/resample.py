# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Band-limited resampling: a Kaiser-windowed sinc run polyphase (scipy's upfirdn core), designed from a spec.

For a rate change fs_in -> fs_out = fs_in L / M, the filter runs at fs_in L. Passband edge 0.4535 of the lower rate
(20 kHz at 44.1 kHz), stopband edge at the lower rate's Nyquist, so nothing above the new Nyquist folds back.
Attenuation A dB sets the Kaiser beta (0.1102 (A - 8.7)) and the length ((A - 7.95) / (2.285 dw) + 1, Kaiser 1974).
`spec()` measures the designed filter on a dense grid: passband ripple and worst stopband level, both in dB.
"""
import math
from functools import lru_cache

import numpy as np
from scipy.signal import firwin, resample_poly

from .kernels import fir

PASS_FRACTION = 0.4535


@lru_cache(maxsize=32)
def design(fs_in, fs_out, atten_db=140.0, pass_fraction=PASS_FRACTION, stop_fraction=0.5):
    """(h, L, M, fp, fs_stop); h has unity gain at DC."""
    g = math.gcd(int(fs_in), int(fs_out))
    L, M = int(fs_out) // g, int(fs_in) // g
    low = min(fs_in, fs_out)
    fp, fsb = pass_fraction * low, stop_fraction * low
    f_up = fs_in * L
    dw = 2 * math.pi * (fsb - fp) / f_up
    n = int(math.ceil((atten_db - 7.95) / (2.285 * dw))) + 1
    n += (n % 2 == 0)                                   # odd length: symmetric, integer group delay
    beta = 0.1102 * (atten_db - 8.7) if atten_db > 50 else 0.5842 * (atten_db - 21) ** 0.4 + 0.07886 * (atten_db - 21)
    h = firwin(n, (fp + fsb) / 2, window=("kaiser", beta), fs=f_up)   # unity DC gain; resample_poly scales by L
    return h, L, M, fp, fsb


def resample(y, fs_in, fs_out, atten_db=140.0):
    """Resample (channels, n) or (n,) along the last axis; the output is aligned (filter delay removed)."""
    if int(fs_in) == int(fs_out):
        return np.asarray(y, np.float64).copy()
    h, L, M, _, _ = design(int(fs_in), int(fs_out), float(atten_db))
    return resample_poly(np.asarray(y, np.float64), L, M, axis=-1, window=h)


@lru_cache(maxsize=8)
def _os_filter(factor, atten_db=100.0):
    """Interpolator for true peak: passband 0.45 fs, images from 0.55 fs up."""
    f_up = factor
    dw = 2 * math.pi * (0.55 - 0.45) / f_up
    n = int(math.ceil((atten_db - 7.95) / (2.285 * dw))) + 1
    n += (n % 2 == 0)
    return firwin(n, 0.5, window=("kaiser", 0.1102 * (atten_db - 8.7)), fs=f_up)


def oversample(y, factor):
    """Integer-factor band-limited interpolation, polyphase by FFT convolution (one phase per output offset); the
    output is aligned with the input (sample i lands at i * factor)."""
    y = np.asarray(y, np.float64)
    h = _os_filter(int(factor)) * factor
    taps = len(h)
    d = (taps - 1) // 2                                       # filter delay at the high rate
    two = y.ndim == 2
    y2 = np.atleast_2d(y)
    n = y2.shape[1]
    out = np.zeros((y2.shape[0], n * factor))
    for ph in range(factor):
        # output index m = i*factor + ph needs taps h[k] with (m + d - k) divisible by factor
        sub = h[(ph + d) % factor::factor]
        shift = (ph + d) // factor
        full = fir(y2, sub)
        out[:, ph::factor] = full[:, shift:shift + n]
    return out if two else out[0]


def downsample(y, factor):
    return resample_poly(np.asarray(y, np.float64), 1, factor, axis=-1, window=_os_filter(int(factor)))


def spec(fs_in, fs_out, atten_db=140.0, nfft=1 << 22):
    """Measured response of the designed filter (dense FFT grid): passband ripple (peak to peak, dB) and the worst
    stopband level."""
    h, L, M, fp, fsb = design(int(fs_in), int(fs_out), float(atten_db))
    f_up = fs_in * L
    H = np.fft.rfft(h, nfft)
    f = np.fft.rfftfreq(nfft, 1 / f_up)
    mag = 20 * np.log10(np.maximum(np.abs(H), 1e-300))
    pb = mag[f <= fp]
    sb = mag[f >= fsb]
    return {"fs_in": fs_in, "fs_out": fs_out, "taps": len(h), "L": L, "M": M, "passband_hz": fp, "stopband_hz": fsb,
            "passband_ripple_db": float(pb.max() - pb.min()), "stopband_db": float(sb.max()), "design_atten_db": atten_db}


def resample_fft(y, fs_in, fs_out, pad_s=0.5):
    """Whole-signal FFT resampler for long buffers: zero-pad both ends, transform once, keep the band up to the
    passband edge (0.4535 of the lower rate) at unity, roll off to zero at the lower Nyquist with a raised cosine,
    and transform back at the new length. The band limit is the same as `design`'s; the transition is a cosine
    rather than a Kaiser window, and `fft_spec` measures it with tones. On the GPU (cuFFT, float64) when present."""
    if int(fs_in) == int(fs_out):
        return np.asarray(y, np.float64).copy()
    from .kernels import _torch
    y2 = np.atleast_2d(np.asarray(y, np.float64))
    n = y2.shape[1]
    pad = int(pad_s * fs_in)
    N = n + 2 * pad
    M = int(round(N * fs_out / fs_in))
    low = min(fs_in, fs_out)
    fp, fsb = PASS_FRACTION * low, 0.5 * low
    kmax = min(N, M) // 2 + 1
    f = np.arange(kmax) * fs_in / N
    taper = np.where(f <= fp, 1.0, np.where(f >= fsb, 0.0, 0.5 * (1 + np.cos(np.pi * (f - fp) / (fsb - fp)))))
    scale = M / N
    t = _torch()
    if t:
        x = t.nn.functional.pad(t.from_numpy(y2).cuda(), (pad, pad))
        X = t.fft.rfft(x)[:, :kmax] * t.from_numpy(taper).cuda()[None, :] * scale
        out = t.fft.irfft(X, M).cpu().numpy()
    else:
        import scipy.fft as sfft
        X = sfft.rfft(np.pad(y2, ((0, 0), (pad, pad))), axis=1, workers=-1)[:, :kmax] * taper[None, :] * scale
        out = sfft.irfft(X, M, axis=1, workers=-1)
    a = int(round(pad * fs_out / fs_in))
    m = int(round(n * fs_out / fs_in))
    out = out[:, a:a + m]
    return out if np.ndim(y) == 2 else out[0]


def fft_spec(fs_in, fs_out, seconds=2.0):
    """Measured with tones through resample_fft: worst passband gain error (dB) up to the passband edge and the
    worst level of a tone between the new Nyquist and the old one (it must vanish)."""
    t = np.arange(int(seconds * fs_in)) / fs_in
    low = min(fs_in, fs_out)
    errs, stops = [], []
    for f in np.linspace(100, PASS_FRACTION * low * 0.999, 25):
        y = resample_fft(np.sin(2 * np.pi * f * t), fs_in, fs_out)
        seg = y[len(y) // 4: 3 * len(y) // 4]
        errs.append(20 * np.log10(np.sqrt(2 * np.mean(seg ** 2))))
    if fs_out < fs_in:
        for f in np.linspace(0.5 * fs_out * 1.001, 0.5 * fs_in * 0.98, 15):
            y = resample_fft(np.sin(2 * np.pi * f * t), fs_in, fs_out)
            stops.append(20 * np.log10(np.abs(y[len(y) // 4: 3 * len(y) // 4]).max() + 1e-300))
    return {"fs_in": fs_in, "fs_out": fs_out, "passband_error_db": float(np.max(np.abs(errs))),
            "stopband_db": float(max(stops)) if stops else None}
