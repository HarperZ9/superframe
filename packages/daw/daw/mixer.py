# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The mixer: gain and equal-power pan per track, a send to the room, a master limiter.

Pan law: theta = (pan + 1) pi / 4, left = cos(theta), right = sin(theta), so left^2 + right^2 = 1 at every
position (constant power). The room bus convolves the summed sends with the room's left and right impulse
responses. The master limiter takes the gain each sample needs to stay under the ceiling, holds the
minimum over a lookahead window, smooths the release with a one-pole filter, and never lets the result
exceed the hold, so no sample passes the ceiling.
"""
import math

import numpy as np
from scipy.ndimage import minimum_filter1d
from scipy.signal import lfilter, oaconvolve

from .arrange import render_track


def db(x):
    return 10.0 ** (np.asarray(x, float) / 20.0)


def pan_gains(pan):
    theta = (np.clip(pan, -1, 1) + 1) * math.pi / 4
    return np.cos(theta), np.sin(theta)


def place(mono, gain_db, pan):
    """Mono buffer to stereo with per-sample gain (dB) and pan."""
    g = db(gain_db) * mono
    left, right = pan_gains(pan)
    return np.stack([g * left, g * right], 1)


def limit(x, ceiling, fs, lookahead=0.005, release=0.08):
    """Peak limiter over a stereo buffer; returns the limited buffer and the gain curve."""
    peak = np.max(np.abs(x), 1)
    need = np.minimum(1.0, ceiling / np.maximum(peak, 1e-12))
    w = max(1, int(lookahead * fs))
    hold = minimum_filter1d(need, size=2 * w + 1, mode="nearest")
    a = math.exp(-1.0 / (release * fs))
    smooth = lfilter([1 - a], [1, -a], hold - 1.0) + 1.0
    gain = np.minimum(hold, smooth)
    return x * gain[:, None], gain


def mix(arr, rng, stems_out=None):
    """Render every track and the room; returns the stereo master (n, 2)."""
    n, fs = arr.n(), arr.fs
    master, send = np.zeros((n, 2)), np.zeros(n)
    for tr in arr.tracks:
        mono = render_track(arr, tr, rng)
        st = place(mono, tr.control("gain_db", n, fs), tr.control("pan", n, fs))
        if stems_out is not None:
            stems_out[tr.name] = st
        master += st
        send += mono * db(tr.control("gain_db", n, fs)) * tr.send
    if arr.room is not None and np.any(send):
        hl, hr = arr.room.impulse_responses(fs, rng)
        wet = np.stack([oaconvolve(send, hl)[:n], oaconvolve(send, hr)[:n]], 1)
        master += wet * db(arr.room_return_db) / max(1.0, np.max(np.abs(wet)))
    out, _ = limit(master, arr.ceiling, fs)
    return out
