# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Median filtering on the GPU when torch with CUDA is present, else scipy. A median of an odd count selects one of
its inputs, and both paths pad by repeating the edge value (scipy's mode "nearest"), so the two return the same
bits; the tests hold them to that whenever torch is installed. REMASTER_GPU=0 forces the scipy path."""
import os

import numpy as np
from scipy.ndimage import median_filter

_TORCH = None


def _torch():
    global _TORCH
    if _TORCH is None:
        _TORCH = False
        if os.environ.get("REMASTER_GPU", "1") != "0":
            try:
                import torch
                if torch.cuda.is_available():
                    _TORCH = torch
            except ImportError:
                pass
    return _TORCH


def medfilt(a, size, axis, force_cpu=False):
    """Median over `size` (odd) samples along `axis` (0 or 1) of a 2-D array, edges repeated; float32 in and out."""
    a = np.asarray(a, np.float32)
    if size <= 1:
        return a.copy()
    t = None if force_cpu else _torch()
    if not t:
        sz = (size, 1) if axis == 0 else (1, size)
        return median_filter(a, size=sz, mode="nearest")
    x = t.from_numpy(np.ascontiguousarray(a if axis == 1 else a.T, dtype=np.float32)).cuda()
    h = size // 2
    x = t.nn.functional.pad(x[None], (h, h), mode="replicate")[0]
    rows = x.shape[0]
    out = t.empty((rows, x.shape[1] - 2 * h), dtype=x.dtype, device=x.device)
    step = max(1, int(2e8 // (size * x.shape[1] * 4)))
    for r in range(0, rows, step):
        out[r:r + step] = x[r:r + step].unfold(1, size, 1).sort(dim=2).values[:, :, h]   # sort: deterministic
    res = out.cpu().numpy()
    return res if axis == 1 else res.T.copy()


def medfilt_t(x, size, axis):
    """The same median on a CUDA tensor (bins, frames), staying on the device."""
    t = _torch()
    h = size // 2
    y = x if axis == 1 else x.T
    y = t.nn.functional.pad(y[None], (h, h), mode="replicate")[0]
    rows = y.shape[0]
    out = t.empty((rows, y.shape[1] - 2 * h), dtype=y.dtype, device=y.device)
    step = max(1, int(2e8 // (size * y.shape[1] * 4)))
    for r in range(0, rows, step):
        out[r:r + step] = y[r:r + step].unfold(1, size, 1).sort(dim=2).values[:, :, h]
    return out if axis == 1 else out.T


def gpu():
    """The torch module when a CUDA device is usable, else None."""
    return _torch() or None


def fir(y, h):
    """Full linear convolution of each row of y (channels, n) with h, float64. On the GPU by FFT (torch, cuFFT) when
    present, else scipy's fftconvolve. The two agree to rounding (about 1e-15 relative), not bit for bit; which one
    ran is recorded by the caller."""
    y2 = np.atleast_2d(np.asarray(y, np.float64))
    t = _torch()
    if not t:
        from scipy.signal import fftconvolve
        out = fftconvolve(y2, np.asarray(h, np.float64)[None, :], mode="full", axes=1)
    else:
        n = y2.shape[1] + len(h) - 1
        nfft = 1 << int(np.ceil(np.log2(n)))
        Y = t.fft.rfft(t.from_numpy(y2).cuda(), nfft)
        H = t.fft.rfft(t.from_numpy(np.asarray(h, np.float64)).cuda(), nfft)
        out = t.fft.irfft(Y * H[None, :], nfft)[:, :n].cpu().numpy()
    return out if np.ndim(y) == 2 else out[0]


def device_name():
    t = _torch()
    return "cuda" if t else "cpu"


def peak_env(y, h, factor):
    """max over channels and over the `factor` interpolated values at each base-rate sample of |y upsampled by
    factor with filter h| (h at the high rate, odd length, delay (len - 1) / 2). On the GPU when present."""
    t = _torch()
    y2 = np.atleast_2d(np.asarray(y, np.float64))
    n = y2.shape[1]
    d = (len(h) - 1) // 2
    if not t:
        return None
    x = t.from_numpy(y2).cuda()
    best = None
    for ph in range(factor):
        sub = np.asarray(h[(ph + d) % factor::factor], np.float64) * factor
        shift = (ph + d) // factor
        m = n + len(sub) - 1
        nfft = 1 << int(np.ceil(np.log2(m)))
        Y = t.fft.rfft(x, nfft)
        H = t.fft.rfft(t.from_numpy(sub).cuda(), nfft)
        v = t.fft.irfft(Y * H[None, :], nfft)[:, shift:shift + n].abs().amax(0)
        best = v if best is None else t.maximum(best, v)
    return best.cpu().numpy()
