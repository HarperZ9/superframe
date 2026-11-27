# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""chron.radiocarbon_calibrate/1: the reference, the known answers, the properties and the planted-bad controls.

Calibration projects a conventional radiocarbon age (14C yr BP, with its one-sigma error) onto a calibration
curve. At each calendar age t of a stated grid the curve gives a 14C age mu(t) and its error sigma(t), read by
linear interpolation between the curve's points. The likelihood of t is the normal density of the measured age
about mu(t) with the two errors combined in quadrature:
  s(t)^2 = error^2 + sigma(t)^2,   f(t) = exp(-(age - mu(t))^2 / (2 s(t)^2)) / s(t)
(the constant 1/sqrt(2 pi) cancels in the normalisation). The density is f over its grid sum times the grid
step, so it integrates to 1 over the grid. A highest-density region at level L holds every grid cell whose
probability is at least the threshold reached when the cells, sorted from most to least probable, first sum to
L; it can be several intervals.

exp is computed with + - * / only (a Cody-Waite reduction and a degree 14 Taylor series in Horner form), so
the BuildLang body gives the same bits; it agrees with a library exp within 1e-15 relative.
"""
import math

from ..core import Refusal, finite, finite_array, refused
from . import curves

R_AGE = "finite, and inside the 14C ages the curve spans"
R_ERROR = "finite and > 0"
R_GRID = ("2 or more evenly spaced calendar ages inside the curve's span, with the density at both ends below "
          "1e-6 of its peak")
R_CAL = "2 or more finite calendar ages, strictly decreasing or strictly increasing"
R_CURVE_AGE = "finite 14C ages, one per curve calendar age"
R_CURVE_ERR = "finite errors >= 0, one per curve calendar age"
R_LEVEL = "finite, > 0 and < 1"
TAIL = 1e-6

SPEC = {
    "id": "chron.radiocarbon_calibrate/1",
    "row": "CHR-001",
    "export": "fk_chron_radiocarbon_calibrate",
    "formula": "s(t)^2 = e^2 + sigma(t)^2; f(t) = exp(-(a - mu(t))^2 / (2 s(t)^2)) / s(t); density = f / (sum f "
               "* step); highest-density region at L = cells with probability >= the threshold where the sorted "
               "cells first reach L",
    "inputs": [("age", "yr_14C", R_AGE), ("error", "yr_14C", R_ERROR), ("grid", "yr_cal", R_GRID),
               ("curve_cal_bp", "yr_cal", R_CAL), ("curve_age", "yr_14C", R_CURVE_AGE),
               ("curve_error", "yr_14C", R_CURVE_ERR), ("level_inner", "1", R_LEVEL),
               ("level_outer", "1", R_LEVEL)],
    "array_inputs": ["grid", "curve_cal_bp", "curve_age", "curve_error"],
    "outputs": [("density", "1/yr_cal"), ("hdr_inner", "1"), ("hdr_outer", "1")],
    "array_outputs": {"density": "grid", "hdr_inner": "grid", "hdr_outer": "grid"},
    "loss": "One age, one curve, no priors: the result is the likelihood normalised on the grid, which is the "
            "posterior only under a uniform prior on the grid (a Bayesian model with phases or sequences needs "
            "more priors). The curve is linear between its points, and its errors are taken as independent "
            "from point to point; IntCal20's own covariance is not used. Density beyond the grid ends is "
            "dropped (the grid is refused when an end holds more than 1e-6 of the peak). exp below -700 is "
            "taken as 0. A highest-density region is a set of grid cells, so its ends are known to one grid "
            "step. Reservoir offsets, mixed curves and the post-bomb range are not handled.",
    "mode": "bit-identical",
    "known_answers": [],      # filled from KNOWN below
    "properties": ["the density integrates to 1 over the grid, at grid steps 1 and 2",
                   "on a straight curve mu(t) = t with sigma 40, an age error of 30 gives a density with mean the "
                   "age and standard deviation 50 (the errors add in quadrature)",
                   "shifting the grid and the curve's calendar ages by 1000 years leaves the density's bits "
                   "unchanged", "reversing the grid reverses the density (within 1e-15) and the regions",
                   "the inner region lies inside the outer, and each holds at least its level",
                   "exp_neg agrees with a library exp within 1e-15 relative on [-700, 0]"],
    "controls": ["the curve's error ignored (s = the age's error alone)",
                 "the nearest curve point in place of linear interpolation",
                 "one equal-tailed interval in place of the highest-density region",
                 "the density not divided by the grid step"],
    "provenance": {
        "source": "Method read at source as text, never run: joeroe/c14 R/cal_calibration.R at 3d0a1af4 "
                  "(dnorm of the age about the interpolated curve with sd sqrt(error^2 + curve error^2)) and "
                  "R/cal_summary.R (highest-density threshold: sort, first cumulative >= level, keep every "
                  "density >= it); ISAAKiel/calibrator src/uncal_date.cpp at 226bfbab (the same combined "
                  "variance, with a Student t of 100 degrees of freedom and no 1/s factor); steko/iosacal "
                  "iosacal/core.py and hpd.py at edf6de4f (Gaussian with 1/s on a curve interpolated to 1 "
                  "year). Known answers from the published outputs listed in known_answers, read 2026-11-16. "
                  "Curve: IntCal20 (Reimer et al. 2020, Radiocarbon 62(4) 725-757), file hash in curves.py.",
        "body_from": "new; no radiocarbon calibration was found in superframe, buildlang, the site, "
                     "mission-control or the 2026-11-15 session outputs (searched 2026-11-16)",
        "checked_by": "radiocarbon worker, 2026-11-16",
    },
}

TOL_YR = 3.0      # endpoint tolerance in years, set before the comparison: published ends are whole years
TOL_PP = 0.5      # interval probability tolerance in percentage points, iosacal only

# (source, age, error, levels, what is compared, published value). "intervals" compares every interval of a
# region in order (start, end in cal BP, and for iosacal the probability in percent); "envelope" compares the
# earliest start and latest end of a region.
KNOWN = [
    ("iosacal user's manual, c14.iosa.it/en/latest/how.html (P-769, IntCal20 default curve)", 7505, 93,
     (0.682, 0.954), "intervals", {"inner": [(8386, 8283, 42.1), (8266, 8199, 26.0)],
                                   "outer": [(8515, 8500, 0.8), (8457, 8163, 89.7), (8137, 8116, 1.0),
                                             (8102, 8039, 3.9)]}),
    ("iosacal quantiles demo, c14.iosa.it/en/latest/quantiles_demo.html, IntCal20", 2000, 300, (0.682, 0.954),
     "envelope", {"inner": (2330, 1611), "outer": (2710, 1355)}),
    ("iosacal quantiles demo", 3000, 260, (0.682, 0.954), "envelope",
     {"inner": (3453, 2854), "outer": (3834, 2494)}),
    ("iosacal quantiles demo", 4500, 50, (0.682, 0.954), "envelope", {"inner": (5287, 5052), "outer": (5312, 4976)}),
    ("iosacal quantiles demo", 6500, 70, (0.682, 0.954), "envelope", {"inner": (7474, 7324), "outer": (7562, 7273)}),
    ("rcarbon vignette (CRAN, rcarbon.html), D001, IntCal20: three one-sigma intervals", 5700, 30,
     (0.6826, 0.9544), "intervals", {"inner": [(6532, 6520), (6500, 6440), (6422, 6409)],
                                     "outer": [(6600, 6589), (6562, 6401)]}),
    ("rcarbon vignette, D002", 4820, 40, (0.6826, 0.9544), "intervals",
     {"inner": [(5593, 5573), (5528, 5481)], "outer": [(5645, 5645), (5602, 5470)]}),
    ("rcarbon vignette, D003", 6450, 40, (0.6826, 0.9544), "intervals",
     {"inner": [(7422, 7414), (7399, 7328)], "outer": [(7426, 7280)]}),
    ("rcarbon vignette, D004", 7200, 30, (0.6826, 0.9544), "intervals",
     {"inner": [(8019, 7975)], "outer": [(8158, 8147), (8110, 8099), (8039, 7939)]}),
    ("Bchron vignette (CRAN, Bchron.html), Ox-123456, IntCal20, 95% regions", 11553, 230, (0.683, 0.95),
     "intervals", {"outer": [(14012, 13923), (13874, 13059), (13025, 13004)]}),
    ("Bchron vignette, Date1, IntCal20, 95% region", 3445, 50, (0.683, 0.95), "intervals",
     {"outer": [(3834, 3572)]}),
] + [("c14 README at 3d0a1af4 (Ganj Dareh, ppnd data), IntCal20, 95.4% range " + lab, a, e, (0.683, 0.954),
      "envelope", {"outer": (hi, lo)})
     for lab, a, e, lo, hi in [("GaK 807", 10400, 150, 11751, 12709), ("OxA 2099", 8840, 110, 9557, 10193),
                               ("OxA 2100", 9010, 110, 9748, 10486), ("OxA 2101", 8850, 100, 9560, 10197),
                               ("OxA 2102", 8690, 110, 9490, 10144), ("SI 922", 8570, 210, 9034, 10181),
                               ("SI 923", 8625, 195, 9142, 10202), ("SI 924", 8640, 90, 9470, 10106),
                               ("SI 925", 8385, 75, 9141, 9534)]]

SPEC["known_answers"] = [f"{a} +- {e} 14C BP on IntCal20 at levels {lv}: {kind} {pub} ({src}); ends within "
                         f"{TOL_YR:g} yr" for src, a, e, lv, kind, pub in KNOWN]


def exp_neg(x):
    """e^x for x <= 0, with + - * / only. 0 below -700."""
    if x < -700.0:
        return 0.0
    k = int(-x * 1.4426950408889634 + 0.5)
    kf = float(k)
    r = (x + kf * 6.93147180369123816490e-01) + kf * 1.90821492927058770002e-10
    p = 1.0
    n = 14.0
    while n >= 1.0:
        p = 1.0 + r * p / n
        n = n - 1.0
    i = 0
    while i < k:
        p = p * 0.5
        i = i + 1
    return p


def _monotone(c):
    """+1 strictly increasing, -1 strictly decreasing, 0 neither."""
    up = all(c[i + 1] > c[i] for i in range(len(c) - 1))
    down = all(c[i + 1] < c[i] for i in range(len(c) - 1))
    return 1 if up else -1 if down else 0


def _interp(t, cal, val, sign):
    """Linear interpolation of val at calendar age t; cal is monotone in the direction sign."""
    lo, hi = 0, len(cal) - 1
    tk = t * sign
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if cal[mid] * sign <= tk:
            lo = mid
        else:
            hi = mid
    w = (t - cal[lo]) / (cal[lo + 1] - cal[lo])
    return val[lo] + (val[lo + 1] - val[lo]) * w


def _likelihood(age, error, grid, cal, mu_c, sig_c, sign):
    out = []
    for t in grid:
        mu = _interp(t, cal, mu_c, sign)
        sg = _interp(t, cal, sig_c, sign)
        s2 = error * error + sg * sg
        z = age - mu
        out.append(exp_neg(-(z * z) / (2.0 * s2)) / math.sqrt(s2))
    return out


def _hdr(mass, level):
    order = sorted(range(len(mass)), key=lambda i: -mass[i])
    cum = 0.0
    thr = mass[order[-1]]
    for i in order:
        cum = cum + mass[i]
        if cum >= level:
            thr = mass[i]
            break
    return tuple(1.0 if m >= thr else 0.0 for m in mass)


def _validate(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    if not finite(age):
        return Refusal("age", age, R_AGE)
    if not finite(error) or not error > 0.0:
        return Refusal("error", error, R_ERROR)
    if not finite_array(grid, 2):
        return Refusal("grid", grid, R_GRID)
    h = grid[1] - grid[0]
    if h == 0.0 or any(grid[i + 1] - grid[i] != h for i in range(len(grid) - 1)):
        return Refusal("grid", grid, R_GRID)
    if not finite_array(curve_cal_bp, 2) or _monotone(curve_cal_bp) == 0:
        return Refusal("curve_cal_bp", curve_cal_bp, R_CAL)
    if not finite_array(curve_age, 1) or len(curve_age) != len(curve_cal_bp):
        return Refusal("curve_age", curve_age, R_CURVE_AGE)
    if not finite_array(curve_error, 1) or len(curve_error) != len(curve_cal_bp) or min(curve_error) < 0.0:
        return Refusal("curve_error", curve_error, R_CURVE_ERR)
    for name, lv in (("level_inner", level_inner), ("level_outer", level_outer)):
        if not finite(lv) or not 0.0 < lv < 1.0:
            return Refusal(name, lv, R_LEVEL)
    lo, hi = min(curve_cal_bp), max(curve_cal_bp)
    if min(grid) < lo or max(grid) > hi:
        return Refusal("grid", grid, R_GRID)
    if age < min(curve_age) or age > max(curve_age):
        return Refusal("age", age, R_AGE)
    return None


def reference(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    bad = _validate(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer)
    if bad:
        return bad
    sign = _monotone(curve_cal_bp)
    f = _likelihood(float(age), float(error), [float(t) for t in grid], [float(c) for c in curve_cal_bp],
                    [float(a) for a in curve_age], [float(e) for e in curve_error], sign)
    peak = max(f)
    if not peak > 0.0 or f[0] > TAIL * peak or f[-1] > TAIL * peak:
        return Refusal("grid", grid, R_GRID)
    total = 0.0
    for v in f:
        total = total + v
    step = abs(float(grid[1]) - float(grid[0]))
    density = tuple(v / (total * step) for v in f)
    mass = [v / total for v in f]
    return density, _hdr(mass, float(level_inner)), _hdr(mass, float(level_outer))


# ---- helpers for callers: a grid from the curve, the intervals of a region, and calibrate by curve id ----

def default_grid(age, error, cal, mu_c, sig_c, span=8.0, margin=50.0):
    """A 1-year grid, decreasing in cal BP, covering every curve point within `span` combined sigmas of the
    age, widened by `margin` years and cut to the curve's span. Two curve ends when no point qualifies, so
    the kernel's own refusal speaks."""
    near = [c for c, m, s in zip(cal, mu_c, sig_c) if abs(age - m) <= span * math.sqrt(error * error + s * s)]
    lo_c, hi_c = min(cal), max(cal)
    if not near:
        return [hi_c, lo_c]
    hi = min(hi_c, math.ceil(max(near) + margin))
    lo = max(lo_c, math.floor(min(near) - margin))
    return [float(t) for t in range(int(hi), int(lo) - 1, -1)]


def intervals(grid, region, density):
    """[(start, end, probability)] for each run of cells in a region, in grid order."""
    step = abs(grid[1] - grid[0])
    out, i = [], 0
    while i < len(grid):
        if region[i]:
            j = i
            while j + 1 < len(grid) and region[j + 1]:
                j += 1
            out.append((grid[i], grid[j], sum(density[i:j + 1]) * step))
            i = j + 1
        else:
            i += 1
    return out


def calibrate(age, error, curve="intcal20", levels=(0.683, 0.954), grid=None, kernel=None):
    """Calibrate one age against a curve id. Returns the kernel's result with the grid and the intervals of
    each region, or the kernel's Refusal."""
    cal, mu_c, sig_c = curves.load(curve)
    if grid is None:
        grid = default_grid(age, error, cal, mu_c, sig_c)
    fn = kernel or reference
    r = fn(age, error, grid, cal, mu_c, sig_c, levels[0], levels[1])
    if refused(r):
        return r
    density, inner, outer = r
    return {"curve": curve, "sha256": curves.CURVES[curve]["sha256"], "grid": list(grid), "density": density,
            "levels": levels, "inner": intervals(grid, inner, density), "outer": intervals(grid, outer, density)}


# ---- checks ----

def _straight(sigma=40.0, lo=0.0, hi=2000.0, step=10.0):
    """A straight test curve, mu(t) = t, decreasing in cal BP like a .14c file."""
    n = int((hi - lo) / step)
    cal = tuple(hi - i * step for i in range(n + 1))
    return cal, cal, tuple(sigma for _ in cal)


def _years(hi, lo, step=1.0):
    n = int(round(abs(hi - lo) / abs(step)))
    return [hi - i * step for i in range(n + 1)]


def _region_ok(got, pub):
    if len(got) != len(pub):
        return False
    for g, p in zip(got, pub):
        if abs(g[0] - p[0]) > TOL_YR or abs(g[1] - p[1]) > TOL_YR:
            return False
        if len(p) > 2 and abs(g[2] * 100.0 - p[2]) > TOL_PP:
            return False
    return True


def _envelope(got):
    return (max(max(a, b) for a, b, _ in got), min(min(a, b) for a, b, _ in got))


def _known(fn, age, error, levels, kind, pub):
    r = calibrate(age, error, levels=levels, kernel=fn)
    if refused(r):
        return False
    for region in ("inner", "outer"):
        if region not in pub:
            continue
        if kind == "intervals" and not _region_ok(r[region], pub[region]):
            return False
        if kind == "envelope":
            env = _envelope(r[region])
            if abs(env[0] - pub[region][0]) > TOL_YR or abs(env[1] - pub[region][1]) > TOL_YR:
                return False
    return True


def _refusal_cases(cal, mu, sg, g1):
    good = [1000.0, 30.0, g1, cal, mu, sg, 0.683, 0.954]
    cases = [("age", 2, [2500.0]), ("age", 2, [-500.0]), ("age", 0, float("nan")), ("error", 1, 0.0),
             ("error", 1, -5.0), ("grid", 2, [1000.0]), ("grid", 2, [1000.0, 999.0, 997.0]),
             ("grid", 2, _years(2500.0, 1500.0)), ("grid", 2, _years(1100.0, 900.0)),
             ("curve_cal_bp", 3, tuple([5.0] * len(cal))), ("curve_age", 4, mu[:-1]),
             ("curve_error", 5, tuple([-1.0] * len(cal))), ("level_inner", 6, 1.0), ("level_outer", 7, 0.0)]
    for name, at, bad in cases:
        args = list(good)
        if name == "age" and isinstance(bad, list):
            args[0] = bad[0]
            args[2] = _years(2000.0, 0.0)
        else:
            args[at] = bad
        yield name, args


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    for src, a, e, lv, kind, pub in KNOWN:
        yield f"known answer: {a} +- {e} on IntCal20, {kind} ({src.split(',')[0]})", _known(fn, a, e, lv, kind, pub)

    cal, mu, sg = _straight()
    g1 = _years(1500.0, 500.0)
    d1 = fn(1000.0, 30.0, g1, cal, mu, sg, 0.683, 0.954)
    g2 = _years(1500.0, 500.0, 2.0)
    d2 = fn(1000.0, 30.0, g2, cal, mu, sg, 0.683, 0.954)
    yield "property: the density integrates to 1 at grid steps 1 and 2", abs(sum(d1[0]) - 1.0) < 1e-12 \
        and abs(sum(d2[0]) * 2.0 - 1.0) < 1e-12
    mean = sum(t * p for t, p in zip(g1, d1[0]))
    sd = math.sqrt(sum((t - mean) ** 2 * p for t, p in zip(g1, d1[0])))
    yield "property: a straight curve with sigma 40 and an error of 30 gives mean 1000 and sd 50", \
        abs(mean - 1000.0) < 1e-6 and abs(sd - 50.0) < 0.01
    shifted = fn(1000.0, 30.0, [t + 1000.0 for t in g1], tuple(c + 1000.0 for c in cal), mu, sg, 0.683, 0.954)
    yield "property: shifting the grid and the curve's calendar ages by 1000 leaves the bits unchanged", \
        shifted == d1
    back = fn(1000.0, 30.0, g1[::-1], cal, mu, sg, 0.683, 0.954)
    yield "property: reversing the grid reverses the density and the regions", \
        all(abs(x - y) <= 1e-15 * abs(y) for x, y in zip(back[0][::-1], d1[0])) \
        and back[1][::-1] == d1[1] and back[2][::-1] == d1[2]
    ic, imu, isg = curves.load("intcal20")
    g = default_grid(5700.0, 30.0, ic, imu, isg)
    dens, inner, outer = fn(5700.0, 30.0, g, ic, imu, isg, 0.6826, 0.9544)
    yield "property: the inner region lies inside the outer and each holds at least its level", \
        all(o >= i for i, o in zip(inner, outer)) and sum(p for p, m in zip(dens, inner) if m) >= 0.6826 \
        and sum(p for p, m in zip(dens, outer) if m) >= 0.9544 and abs(sum(dens) - 1.0) < 1e-12
    xs = [-700.0 * i / 997.0 for i in range(998)] + [-1e-300, -0.5, -0.3465, -0.3466]
    yield "property: exp_neg agrees with a library exp within 1e-15 relative", \
        all(abs(exp_neg(x) - math.exp(x)) <= 1e-15 * math.exp(x) for x in xs)

    for name, args in _refusal_cases(cal, mu, sg, g1):
        got = fn(*args)
        yield f"refusal: {name} = {str(args[[n for n, _, _ in SPEC['inputs']].index(name)])[:24]} names " \
              f"{name} with a message", refused(got) and got.input == name and name in str(got)
    far = calibrate(60000.0, 100.0, kernel=fn)
    yield "refusal: 60000 BP on IntCal20 (beyond its 50100 14C yr) names the age", \
        refused(far) and far.input == "age" and "curve" in str(far)


def __getattr__(name):
    """GRID is built on first use, since it reads IntCal20 through curves.load."""
    if name != "GRID":
        raise AttributeError(name)
    cal, mu, sg = _straight()
    ic, imu, isg = curves.load("intcal20")
    base = dict(age=1000.0, error=30.0, grid=_years(1500.0, 500.0), curve_cal_bp=cal, curve_age=mu,
                curve_error=sg, level_inner=0.683, level_outer=0.954)
    grid = [dict(base), dict(base, grid=_years(1500.0, 500.0, 2.0), level_inner=0.5, level_outer=0.99),
            dict(base, grid=_years(500.0, 1500.0, -1.0), curve_cal_bp=cal[::-1], curve_age=mu[::-1],
                 curve_error=sg[::-1]),
            dict(base, curve_error=tuple(0.0 for _ in sg))]
    for name, args in _refusal_cases(cal, mu, sg, base["grid"]):
        grid.append(dict(zip([n for n, _, _ in SPEC["inputs"]], args)))
    for a, e in ((7505.0, 93.0), (5700.0, 30.0), (11553.0, 230.0), (2000.0, 300.0), (10400.0, 150.0)):
        grid.append(dict(age=a, error=e, grid=default_grid(a, e, ic, imu, isg), curve_cal_bp=ic, curve_age=imu,
                         curve_error=isg, level_inner=0.683, level_outer=0.954))
    grid.append(dict(age=60000.0, error=100.0, grid=[ic[0], ic[-1]], curve_cal_bp=ic, curve_age=imu,
                     curve_error=isg, level_inner=0.683, level_outer=0.954))
    return grid


# ---- planted-bad controls: each must fail at least one check ----

def _no_curve_error(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    zero = tuple(0.0 for _ in curve_error) if finite_array(curve_error, 1) else curve_error
    return reference(age, error, grid, curve_cal_bp, curve_age, zero, level_inner, level_outer)


def _nearest_point(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    bad = _validate(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer)
    if bad:
        return bad
    f = []
    for t in grid:
        i = min(range(len(curve_cal_bp)), key=lambda j: abs(curve_cal_bp[j] - t))
        s2 = error * error + curve_error[i] ** 2
        f.append(exp_neg(-((age - curve_age[i]) ** 2) / (2.0 * s2)) / math.sqrt(s2))
    total, step = sum(f), abs(grid[1] - grid[0])
    mass = [v / total for v in f]
    return tuple(v / (total * step) for v in f), _hdr(mass, level_inner), _hdr(mass, level_outer)


def _equal_tailed(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    r = reference(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer)
    if refused(r):
        return r
    step = abs(grid[1] - grid[0])

    def central(level):
        cum, lo_i, hi_i = 0.0, None, None
        for i, p in enumerate(r[0]):
            cum += p * step
            if lo_i is None and cum >= (1.0 - level) / 2.0:
                lo_i = i
            if hi_i is None and cum >= 1.0 - (1.0 - level) / 2.0:
                hi_i = i
        return tuple(1.0 if lo_i <= i <= hi_i else 0.0 for i in range(len(grid)))
    return r[0], central(level_inner), central(level_outer)


def _not_per_year(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer):
    r = reference(age, error, grid, curve_cal_bp, curve_age, curve_error, level_inner, level_outer)
    if refused(r):
        return r
    step = abs(grid[1] - grid[0])
    return tuple(p * step for p in r[0]), r[1], r[2]


PLANTED = {"the curve's error ignored (s = the age's error alone)": _no_curve_error,
           "the nearest curve point in place of linear interpolation": _nearest_point,
           "one equal-tailed interval in place of the highest-density region": _equal_tailed,
           "the density not divided by the grid step": _not_per_year}
