# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The electron beams: raster in time, gaussian spots that grow with current, the grille's colour
selection, and the phosphor light each excitation emits inside an exposure window.

Every beam sample (line j, position x) carries energy E = V I dx / v and lands at a known time t.
Its light inside the window [a, b] is eta E (F(b - t) - F(a - t)), with F the phosphor's
cumulative decay. The spot spreads E over the face cells by the exact gaussian mass of each cell
(erf), renormalised over the taps so the scatter conserves energy to rounding. The grille passes
mask_transmission of each gun onto that gun's stripe in the triad below.
"""
import math

import numpy as np

SQ2 = math.sqrt(2.0)


def erf(x, xp):
    """Abramowitz and Stegun 7.1.26, |error| < 1.5e-7, from + - * / exp only."""
    s, a = xp.sign(x), xp.abs(x)
    t = 1.0 / (1.0 + 0.3275911 * a)
    y = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t
    return s * (1.0 - y * xp.exp(-a * a))


def mass(lo, hi, sig, xp):
    return 0.5 * (erf(hi / (sig * SQ2), xp) - erf(lo / (sig * SQ2), xp))


def excite(tube, src):
    """(3, lines, samples) beam energy in J and spot sigma in mm for a source frame (H, W, 3)."""
    d = tube.drive(src)
    I = np.stack([tube.current(d[..., c], c) for c in range(3)])
    return tube.beam_energy(I), tube.sigma(I)


CACHE_WEIGHTS = True   # False runs the uncached path (the bit-identity check compares the two)
CACHE_SIZE = 96        # entries; each is one (lines, samples) float64 array, about 6 MB on the 14 inch tube
_W_CACHE = {}


def _timing_key(tube):
    """Everything beam_time and the tail term read. The weights depend on these, never on the picture."""
    x, _ = tube.beam_x()
    return (tube.T, tube.H, tube.v, tube.raster_w, tube.active_start_s, tube.first_active_line,
            tube.active_lines, x.size, float(x[0]), float(x[-1]))


def _law_key(law):
    if law.law == "kuhn":
        return ("kuhn", tuple(law.exps), law.power, law.t_cut, law.total)
    if law.law == "exponential":
        return ("exponential", tuple(law.w.tolist()), tuple(law.tau.tolist()))
    if law.law == "hyperbolic":
        return ("hyperbolic", law.t0, law.n)
    return None  # an unknown law is never cached


def weights(tube, law, a, b, fields, tail_from=None):
    """(lines, samples) fraction of each sample's light inside [a, b], summed over fields.
    tail_from: oldest explicit field; older fields are added as a steady tail (static scenes).
    The result depends only on beam timing, the decay law, the window and the field list, so it is
    cached on those (read-only array; the cached value is the uncached computation, bit for bit)."""
    lk = _law_key(law) if CACHE_WEIGHTS else None
    if lk is None:
        return _weights(tube, law, a, b, fields, tail_from)
    key = (_timing_key(tube), lk, float(a), float(b), tuple(int(f) for f in fields), tail_from)
    W = _W_CACHE.get(key)
    if W is None:
        W = _weights(tube, law, a, b, fields, tail_from)
        if isinstance(W, np.ndarray):
            W.setflags(write=False)
        if len(_W_CACHE) >= CACHE_SIZE:
            _W_CACHE.pop(next(iter(_W_CACHE)))
        _W_CACHE[key] = W
    return W


def _weights(tube, law, a, b, fields, tail_from=None):
    W = 0.0
    for f in fields:
        t = tube.beam_time(f)
        W = W + law.F(b - t) - law.F(a - t)
    if tail_from is not None:
        t = tube.beam_time(tail_from)
        W = W + (b - a) / tube.T * (1.0 - law.F(a - t + 0.5 * tube.T))
    return W


def _taps(tube, sig_max):
    return int(math.ceil(3.5 * sig_max / tube.dx)) + 1


def scatter(tube, E, sig, xp):
    """Spread beam energy E (lines, samples) with spots sig onto face cells. Returns (face
    energy (rows, cols) on the backend, energy that missed the face in J)."""
    _, m = tube.beam_x()
    K = _taps(tube, float(np.max(sig)))
    yj = tube.line_y()
    rc = np.floor((yj + tube.rows * tube.dx / 2) / tube.dx).astype(np.int64)
    pr = K + int(max(0, -rc.min()) + max(0, rc.max() - tube.rows + 1))
    pc = m + K
    acc = xp.zeros((tube.rows + 2 * pr, tube.cols + 2 * pc))
    Eg, sg = xp.put(E), xp.put(sig)
    lo_y = xp.put(((rc[:, None] * tube.dx) - tube.rows * tube.dx / 2) - yj[:, None])
    wv = [mass(lo_y + t * tube.dx, lo_y + (t + 1) * tube.dx, sg, xp) for t in range(-K, K + 1)]
    wh = [mass((k - 0.5) * tube.dx + 0 * sg, (k + 0.5) * tube.dx + 0 * sg, sg, xp) for k in range(-K, K + 1)]
    nv, nh = sum(wv), sum(wh)
    for ti, t in enumerate(range(-K, K + 1)):
        rows = xp.ints(rc + t + pr)
        Ev = Eg * wv[ti] / nv
        for ki, k in enumerate(range(-K, K + 1)):
            xp.add_rows(acc, rows, k + pc - m, Ev * (wh[ki] / nh))
    face = acc[pr:pr + tube.rows, pc:pc + tube.cols]
    return face, xp.sum(Eg) - xp.sum(face)


def mask(tube, face, c, xp):
    """Gun c's face energy -> energy on its stripe per triad (rows, triads), after the grille."""
    a = xp.get(face).reshape(tube.rows, tube.triads, 3).sum(axis=2)
    return tube.mask_transmission * a


def frame(tube, scene, a, b, history=8, static=True, xp=None, ledger=None, tail=True):
    """Phosphor light (rows, triads, 3) in J emitted inside [a, b] (seconds from field 0's start).
    scene(field_no) -> (H, W, 3) R'G'B' in [0, 1]. ledger, if a dict, collects the energy budget.
    tail: fields older than -history are taken to repeat field -history (a steady tail)."""
    from .backend import Numpy
    xp = xp or Numpy()
    f_hi = int(math.ceil(b / tube.T))
    fields = list(range(-history, f_hi + 1))
    Q = np.zeros((tube.rows, tube.triads, 3))
    old = -history - 1 if tail else None
    groups = [(fields, old)] if static else [([f], old if f == -history else None) for f in fields]
    for flist, tail in groups:
        E, sig = excite(tube, scene(flist[0]))
        for c in range(3):
            law = tube.ph["decay"][c]
            W = weights(tube, law, a, b, flist, tail)
            face, missed = scatter(tube, E[c] * W, sig[c], xp)
            Q[..., c] += tube.ph["eta"][c] * mask(tube, face, c, xp)
            if ledger is not None:
                ledger.setdefault("beam_weighted", [0.0] * 3)[c] += float((E[c] * W).sum())
                ledger.setdefault("missed", [0.0] * 3)[c] += missed
    return Q
