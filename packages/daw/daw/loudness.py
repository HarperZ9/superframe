# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Loudness in the DAW: ITU-R BS.1770-4 and EBU R128, read through the meter in packages/remastering.

The meter itself (K-weighting, gating, short-term, momentary, loudness range, 4x true peak) lives in
packages/remastering/remastering/loudness.py and is tested there against EBU Tech 3341 and 3342 cases. This
module is the DAW's door to it: one measurement of a stereo buffer, written into every receipt, and the
static gain that moves a piece to a target loudness. A static gain is one number for the whole piece, so it
keeps stems additive (G1): every stem gets the same factor.

Terms: LUFS is loudness units relative to full scale (BS.1770); LU is a difference of LUFS; dBTP is the true
peak, the peak of the signal reconstructed between samples (here at 4x oversampling below 96 kHz).
"""
import math

import numpy as np

from . import PACKAGES

_REMASTERING = PACKAGES / "remastering"


def _meter():
    import sys
    if str(_REMASTERING) not in sys.path:
        sys.path.insert(0, str(_REMASTERING))
    from remastering import loudness as LD   # noqa: E402  (packages/remastering)
    return LD


def measure(stereo, fs):
    """Every R128 number for a (n, channels) buffer: integrated, short-term max, momentary max, LRA, true
    peak and sample peak. Returns a dict of floats rounded to 0.01."""
    y = np.asarray(stereo, np.float64)
    if y.ndim == 1:
        y = y[:, None]
    return _meter().measure(y.T, fs)


def short_term(stereo, fs):
    """Short-term loudness (3 s window, 100 ms step) as an array of LUFS, for a loudness-over-time plot."""
    y = np.asarray(stereo, np.float64)
    return _meter().short_term(np.atleast_2d(y.T), fs)


def momentary(stereo, fs):
    """Momentary loudness (400 ms window, 100 ms step) as an array of LUFS."""
    y = np.asarray(stereo, np.float64)
    return _meter().momentary(np.atleast_2d(y.T), fs)


def gain_to_target(stereo, fs, target_lufs):
    """The static linear gain that moves the buffer's integrated loudness to target_lufs. Integrated loudness
    scales exactly by 20 log10(gain), because K-weighting and the gates are linear and relative."""
    now = _meter().integrated(np.atleast_2d(np.asarray(stereo, np.float64).T), fs)
    if not math.isfinite(now):
        raise ValueError("the buffer is silent to the meter (below the -70 LUFS gate); no target gain exists")
    return 10.0 ** ((target_lufs - now) / 20.0)
