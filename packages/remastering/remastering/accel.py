# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sample-by-sample recursions that cannot be vectorised: the attack/release follower, the noise-shaping
quantiser and the waveguide loop. Each is written once in plain Python; when numba is installed the same source
is compiled (no fastmath, so IEEE operations run in the same order) and the tests hold the two to bit identity.
Without numba the pure-Python path runs, slower and with the same bits."""
import math

import numpy as np

try:
    import numba
    HAVE_NUMBA = True
except ImportError:  # optional accelerator
    numba = None
    HAVE_NUMBA = False


def _follow(x, a_att, a_rel):
    """One-pole follower with separate attack and release coefficients: rises with a_att, falls with a_rel."""
    y = np.empty_like(x)
    s = 0.0
    for i in range(x.shape[0]):
        v = x[i]
        a = a_att if v > s else a_rel
        s = a * s + (1.0 - a) * v
        y[i] = s
    return y


def _shape_quantise(x, dither, coefs, scale):
    """Error-feedback quantiser: v = x - sum c_k e[n-k]; q = round((v + d) * scale) / scale; e = q - v."""
    k = coefs.shape[0]
    hist = np.zeros(k)
    out = np.empty_like(x)
    for i in range(x.shape[0]):
        fb = 0.0
        for j in range(k):
            fb += coefs[j] * hist[j]
        v = x[i] - fb
        q = math.floor((v + dither[i]) * scale + 0.5) / scale
        e = q - v
        for j in range(k - 1, 0, -1):
            hist[j] = hist[j - 1]
        hist[0] = e
        out[i] = q
    return out


def _waveguide(excitation, total, n, a, g):
    """daw.waveguide.string's loop: delay n, two-point average, first-order allpass, loop gain g."""
    buf = np.zeros(n)
    y = np.zeros(total)
    ap_x = 0.0
    ap_y = 0.0
    prev = 0.0
    m = excitation.shape[0]
    for i in range(total):
        out = buf[i % n]
        avg = 0.5 * (out + prev)
        prev = out
        ap = a * avg + ap_x - a * ap_y
        ap_x = avg
        ap_y = ap
        v = g * ap + (excitation[i] if i < m else 0.0)
        buf[i % n] = v
        y[i] = v
    return y


PY = {"follow": _follow, "shape_quantise": _shape_quantise, "waveguide": _waveguide}
if HAVE_NUMBA:
    JIT = {k: numba.njit(cache=False, fastmath=False)(f) for k, f in PY.items()}
else:
    JIT = PY


def follow(x, a_att, a_rel, fast=True):
    return (JIT if fast else PY)["follow"](np.ascontiguousarray(x, np.float64), float(a_att), float(a_rel))


def shape_quantise(x, dither, coefs, scale, fast=True):
    return (JIT if fast else PY)["shape_quantise"](np.ascontiguousarray(x, np.float64),
                                                   np.ascontiguousarray(dither, np.float64),
                                                   np.ascontiguousarray(coefs, np.float64), float(scale))


def waveguide(excitation, total, n, a, g, fast=True):
    return (JIT if fast else PY)["waveguide"](np.ascontiguousarray(excitation, np.float64), int(total), int(n),
                                              float(a), float(g))
