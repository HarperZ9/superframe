# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Tungsten R(T) from Desai et al. 1984 Table 5: forward ratio, inversion, local coefficient and exponent.

Interpolation is linear in (T, rho) between table rows, which the table spacing (50 to 100 K above
300 K) keeps within the table's own uncertainty for these smooth curves.
"""
import math

from . import load

_TAB = load("tungsten_desai1984")["rows"]
_T = [r["T_K"] for r in _TAB if r["T_K"] >= 200]
_R = [r["rho_1e-8_ohm_m"] for r in _TAB if r["T_K"] >= 200]


def rho(t):
    """Resistivity in 1e-8 ohm m at t kelvin (200 to 3600 K)."""
    if not _T[0] <= t <= _T[-1]:
        raise ValueError(f"T = {t} K outside 200-3600 K")
    for i in range(1, len(_T)):
        if t <= _T[i]:
            f = (t - _T[i - 1]) / (_T[i] - _T[i - 1])
            return _R[i - 1] + f * (_R[i] - _R[i - 1])
    return _R[-1]


def ratio(t, t0=296.0):
    return rho(t) / rho(t0)


def temperature(r_ratio, t0=296.0):
    """Invert R(T)/R(t0) = r_ratio by bisection on the monotonic table."""
    target = r_ratio * rho(t0)
    if not _R[0] <= target <= _R[-1]:
        raise ValueError(f"ratio {r_ratio} outside the table")
    lo, hi = _T[0], _T[-1]
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        if rho(mid) < target:
            lo = mid
        else:
            hi = mid
    return 0.5 * (lo + hi)


def alpha(t, window=30.0):
    """Local d ln(rho)/dT per kelvin: least-squares slope of the table rows within t +/- window, over rho(t).
    The rows near room temperature are 2 to 20 K apart and rounded to 0.01e-8 ohm m, so a slope over one
    5 K interval carries about +/-0.4e-3 /K of rounding; the window averages that out."""
    pts = [(a, b) for a, b in zip(_T, _R) if abs(a - t) <= window]
    n = len(pts)
    mt, mr = sum(a for a, _ in pts) / n, sum(b for _, b in pts) / n
    slope = sum((a - mt) * (b - mr) for a, b in pts) / sum((a - mt) ** 2 for a, _ in pts)
    return slope / rho(t)


def exponent(t1, t2):
    """Effective power-law exponent gamma in R ~ T^gamma between t1 and t2."""
    return math.log(rho(t2) / rho(t1)) / math.log(t2 / t1)
