# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A stiff waveguide string (gap G19): piano inharmonicity from a cascade of allpass filters in the loop.

A real string has bending stiffness, so its partials are stretched: f_n = n f0 sqrt(1 + B n^2) (Fletcher 1964),
with B the inharmonicity coefficient. In a waveguide the same effect needs a loop delay that falls with
frequency, so high partials come round sooner. M identical first-order allpasses
D(z) = (a + z^-1) / (1 + a z^-1) with -1 < a < 0 have a phase delay of (1 - a) / (1 + a) samples at DC falling
to 1 sample at Nyquist: that is the dispersion (after Van Duyne and Smith 1994, who cascade allpasses the same way).

Design. For a candidate a, the loop is filled out to one period fs / f0 at the fundamental (integer delay,
two-point average, a tuning allpass, then the M dispersion stages), and the partials are read off the loop's
own phase: partial k sits where the loop phase reaches -2 pi k. The a (and M from a short list) that best
match the target partials 1 to K in cents is chosen by a bounded scalar search. Nothing is tabled; the fit is
checked in the tests by rendering a note and fitting B back from its measured partials.

piano_b(midi): B per note measured from recordings of a Steinway model B (packages/measured
data/piano_b_iowa.json, built by build/b_piano_b.py from the University of Iowa MIS piano, one fit of
f_n = n f0 sqrt(1 + B n^2) per note). Notes whose fit has quality "good" are used as they are; between them B is
interpolated in log B; above the last measured note (D flat 7) and where the table has no row, the treble is
extended by a straight line in log B fitted to the measured notes from C4 up, and the bass is held at B0.
piano_b_textbook(midi) is the earlier smooth curve (from memory, low confidence), kept so renders made with it
can be repeated.
"""
import math
from functools import lru_cache

import numpy as np
from scipy.optimize import minimize_scalar
from scipy.signal import sosfilt

STAGES = (1, 2, 3, 4, 5, 6, 8, 10, 12, 16)


def piano_b_textbook(midi):
    return float(np.clip(10 ** (-4.0 + (midi - 48) * 1.0 / 60.0), 2e-5, 3e-3))


@lru_cache(maxsize=1)
def _measured_b():
    from . import PKG  # noqa: F401  (sets sys.path for measured)
    from measured import load
    rows = [r for r in load("piano_b_iowa")["rows"] if r["quality"] == "good"]
    m = np.array([r["midi"] for r in rows], float)
    lb = np.log10([r["B"] for r in rows])
    top = m >= 60
    slope, icept = np.polyfit(m[top], lb[top], 1)
    return m, lb, slope, icept


def piano_b(midi):
    """Measured B for a MIDI note (fractional notes interpolate); see the module notes for the edges."""
    m, lb, slope, icept = _measured_b()
    if midi > m[-1]:
        return float(10 ** (icept + slope * midi))
    return float(10 ** np.interp(midi, m, lb))


def _ap_phase(c, w):
    e = np.exp(-1j * w)
    return np.unwrap(np.angle((c + e) / (1 + c * e)))


def _layout(f0, fs, a, m):
    """Integer delay n and tuning-allpass coefficient that make the whole loop one period at f0."""
    w0 = 2 * math.pi * f0 / fs
    disp = -m * _ap_phase(a, np.array([1e-9, w0]))[1] / w0          # phase delay of the stages at f0
    rest = fs / f0 - 0.5 - disp
    n = int(math.floor(rest))
    d = rest - n
    if d < 0.1:
        n -= 1
        d += 1.0
    if n < 2:
        raise ValueError("too much dispersion delay for this pitch; use fewer stages")
    return n, (1 - d) / (1 + d)


def partials(f0, fs, a, m, count=10, grid=1 << 15):
    """Frequencies of partials 1..count of the loop (phase crossings of -2 pi k)."""
    n, t = _layout(f0, fs, a, m)
    w = np.linspace(1e-6, math.pi * 0.98, grid)
    ph = -w * n - w / 2 + _ap_phase(t, w) + m * _ap_phase(a, w)
    out = []
    for k in range(1, count + 1):
        i = np.searchsorted(-ph, 2 * math.pi * k)
        if i <= 0 or i >= len(w):
            break
        x0, x1, y0, y1 = w[i - 1], w[i], -ph[i - 1], -ph[i]
        out.append((x0 + (2 * math.pi * k - y0) * (x1 - x0) / (y1 - y0)) * fs / (2 * math.pi))
    return np.array(out)


@lru_cache(maxsize=512)
def design(f0, fs, b, count=10):
    """(a, m) whose loop partials best match n f0 sqrt(1 + b n^2) / sqrt(1 + b), in cents, over partials below
    0.4 fs, plus the error of the loop's own fitted B (one percent weighs as three cents), so treble notes
    with few partials keep their B. b = 0 gives no stages."""
    if b <= 0:
        return 0.0, 0
    k = np.arange(1, count + 1)
    target = k * f0 * np.sqrt((1 + b * k ** 2) / (1 + b))
    k = k[target < 0.4 * fs]
    target = target[: len(k)]
    best = None
    for m in STAGES:
        def err(a):
            try:
                p = partials(f0, fs, a, m, len(k))
            except ValueError:
                return 1e9
            if len(p) < len(k):
                return 1e9
            cents = float(np.mean((1200 * np.log2(p / target)) ** 2))
            if len(k) < 3:
                return cents
            slope, icept = np.polyfit(k ** 2.0, (p / k) ** 2, 1)      # the loop's own B, as fit_b reads it
            return cents + (300.0 * (slope / icept / b - 1)) ** 2      # one percent of B weighs as three cents
        grid = np.linspace(-0.95, -1e-4, 48)                       # coarse scan first: the error has local minima
        j = int(np.argmin([err(a) for a in grid]))
        lo, hi = grid[max(j - 1, 0)], grid[min(j + 1, len(grid) - 1)]
        r = minimize_scalar(err, bounds=(lo, hi), method="bounded", options={"xatol": 1e-6})
        if best is None or r.fun < best[0]:
            best = (r.fun, r.x, m)
    return float(best[1]), int(best[2])


def stiff_string(f0, seconds, fs, excitation, t60=6.0, b=1e-4):
    """The waveguide string with M dispersion stages. The loop delay is at least n samples, so the loop runs in
    blocks of n: each block's feedback depends only on output already written. The loop filters run as
    cascaded second-order sections (sosfilt) with carried state, which stays stable where one expanded
    polynomial of 16 repeated poles would not."""
    a, m = design(f0, fs, b)
    n, t = _layout(f0, fs, a, m)
    g = min(10 ** (-3 / (t60 * f0)) / math.cos(math.pi * f0 / fs), 0.99999)
    sos = [[g * t, g, 0.0, 1.0, t, 0.0], [0.5, 0.5, 0.0, 1.0, 0.0, 0.0]] + [[a, 1.0, 0.0, 1.0, a, 0.0]] * m
    sos = np.array(sos)
    zi = np.zeros((len(sos), 2))
    total = int(seconds * fs)
    x = np.zeros(total)
    x[: min(total, len(excitation))] = excitation[:total]
    v = np.zeros(total)
    for s in range(0, total, n):
        e = min(s + n, total)
        u = v[s - n:e - n] if s >= n else np.zeros(e - s)
        out, zi = sosfilt(sos, u, zi=zi)
        v[s:e] = x[s:e] + out
    return v


def fit_b(y, fs, f0, count=8):
    """Measure B from a rendered note: the strongest peak near each expected partial, then a straight-line fit of
    f_n^2 / n^2 = F^2 + F^2 B n^2 (Fletcher's law with F free), so no single partial sets the reference."""
    seg = y[: min(len(y), 3 * fs)]
    sp = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), 1 << 21))
    fr = np.fft.rfftfreq(1 << 21, 1 / fs)
    f = []
    for k in range(1, count + 1):
        c = k * f0 if k == 1 else f[-1] / (k - 1) * k
        band = (fr > c * (1 - 0.3 / k)) & (fr < c * (1 + 0.3 / k + 0.02))
        f.append(fr[band][np.argmax(sp[band])])
    f = np.array(f)
    n = np.arange(1, count + 1)
    slope, icept = np.polyfit(n ** 2.0, f ** 2 / n ** 2, 1)
    return float(slope / icept), f
