# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Requantisation with TPDF dither and error-feedback noise shaping.

TPDF dither: the sum of two independent uniform values of 1 LSB each, so the error is independent of the signal in
its first two moments (Lipshitz, Wannamaker and Vanderkooy 1992). Noise shaping: the quantiser's error is fed back
through a filter so its spectrum is pushed away from the ear's most sensitive region. The "lipshitz5" set is the
five-tap modified E-weighted filter for 44.1 kHz from Lipshitz, Vanderkooy and Wannamaker 1991 (values from memory,
checked here only by the measured noise spectrum, not against the paper). "hp2" is (1 - z^-1)^2. The noise
transfer function is 1 - sum c_k z^-k.
The noise generator is seeded, so the output bits repeat."""
import numpy as np

from . import accel

SHAPES = {"none": [], "hp2": [2.0, -1.0], "lipshitz5": [2.033, -2.165, 1.959, -1.590, 0.6149]}


def requantise(y, bits=16, shape="lipshitz5", seed=0, fast=True):
    """(channels, n) float in [-1, 1] -> the same grid as `bits`-bit PCM, still as float; returns (out, int array)."""
    y = np.atleast_2d(np.asarray(y, np.float64))
    scale = float(2 ** (bits - 1))
    rng = np.random.default_rng(seed)
    coefs = np.array(SHAPES[shape], np.float64)
    out = np.empty_like(y)
    for c in range(y.shape[0]):
        d = (rng.random(y.shape[1]) - rng.random(y.shape[1])) / scale    # TPDF, +-1 LSB
        if coefs.size == 0:
            out[c] = np.floor((y[c] + d) * scale + 0.5) / scale
        else:
            out[c] = accel.shape_quantise(y[c], d, coefs, scale, fast=fast)
    out = np.clip(out, -1.0, (scale - 1) / scale)
    return out, np.round(out * scale).astype(np.int32)
