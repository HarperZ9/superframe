# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""colour.xyz_to_cielab/1: the reference, the known answers, the properties and the planted-bad controls.

CIE 1976 L*a*b* from tristimulus values and a reference white, with the CIE's exact rational constants:
  t = X / Xn (and Y / Yn, Z / Zn);  f(t) = t > e ? t^(1/3) : (K t + 16) / 116,  e = 216 / 24389, K = 24389 / 27
  L = 116 f(Y/Yn) - 16;  a = 500 (f(X/Xn) - f(Y/Yn));  b = 200 (f(Y/Yn) - f(Z/Zn))

The cube root is 64 Newton steps from 1 with + - * / only, so the BuildLang body gives the same bits; a check
holds it within 2 ulp of a library cube root over the accepted range.
"""
from ..core import Refusal, finite, positive, refused

EPS = 216.0 / 24389.0
KAPPA = 24389.0 / 27.0
STEPS = 64
T_MAX = 1000.0

SPEC = {
    "id": "colour.xyz_to_cielab/1",
    "row": "COL-003",
    "export": "fk_colour_xyz_to_cielab",
    "formula": "f(t) = t > 216/24389 ? cbrt(t) : (24389/27 t + 16) / 116; L = 116 fy - 16, "
               "a = 500 (fx - fy), b = 200 (fy - fz)",
    "inputs": [("x", "1", "finite, 0 <= X <= 1000 Xn"), ("y", "1", "finite, 0 <= Y <= 1000 Yn"),
               ("z", "1", "finite, 0 <= Z <= 1000 Zn"), ("white_x", "1", "finite and > 0"),
               ("white_y", "1", "finite and > 0"), ("white_z", "1", "finite and > 0")],
    "outputs": [("L", "1"), ("a", "1"), ("b", "1")],
    "loss": "One reference white and one fixed viewing condition; no adaptation (convert to the white "
            "first), no surround or luminance effects (those need CIECAM02 or CAM16). Lab is only roughly "
            "uniform: Delta E 1976 overstates differences in saturated colours. X, Y and Z must share one "
            "scale with the white. Negative tristimulus values are refused.",
    "mode": "bit-identical",
    "known_answers": ["the white gives L 100, a 0, b 0 exactly",
                      "Y / Yn = 216 / 24389 gives L 8 on both pieces (116 x 6/29 - 16 = 24 - 16)",
                      "Y / Yn = 0.18 gives L 49.496108"],
    "properties": ["f is continuous at the threshold, value and slope, with the exact constants",
                   "a neutral (X/Xn = Y/Yn = Z/Zn) has a = b = 0",
                   "the cube root agrees with a library cube root within 2 ulp"],
    "controls": ["the rounded constants 0.008856 and 7.787", "the cube root dropped (L = 116 Y - 16)",
                 "a and b scales swapped (200 and 500)"],
    "provenance": {
        "source": "W3C CSS Color Module Level 4, sample code conversions.js (XYZ_to_Lab), read 2026-11-15: "
                  "e = 216/24389 and K = 24389/27, with the comment that the CIE standard now defines them as "
                  "rational fractions; L = 116 f1 - 16, a = 500 (f0 - f1), b = 200 (f1 - f2). CIE 15:2004 "
                  "and ISO/CIE 11664-4 are unread (paid).",
        "body_from": "packages/decompose/design_parts/design_parts/imageio.py:67 and superframe/lib/study/"
                     "cmath.mjs:22 (exact constants); packages/rooms/core/spectra.js:80 and four other copies "
                     "use the rounded 0.008856 and 7.787, which move L by at most 3.8e-5 and a by 1.6e-4",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def cbrt(t):
    y = 1.0
    for _ in range(STEPS):
        y = (2.0 * y + t / (y * y)) / 3.0
    return y


def f(t):
    if t > EPS:
        return cbrt(t)
    return (KAPPA * t + 16.0) / 116.0


def reference(x, y, z, white_x, white_y, white_z):
    for name, w in (("white_x", white_x), ("white_y", white_y), ("white_z", white_z)):
        if not positive(w):
            return Refusal(name, w, "finite and > 0")
    ts = []
    for name, v, w, axis in (("x", x, white_x, "X"), ("y", y, white_y, "Y"), ("z", z, white_z, "Z")):
        if not finite(v) or v < 0.0:
            return Refusal(name, v, f"finite, 0 <= {axis} <= 1000 {axis}n")
        t = float(v) / float(w)
        if not t <= T_MAX:
            return Refusal(name, v, f"finite, 0 <= {axis} <= 1000 {axis}n")
        ts.append(t)
    fx, fy, fz = f(ts[0]), f(ts[1]), f(ts[2])
    return (116.0 * fy - 16.0, 500.0 * (fx - fy), 200.0 * (fy - fz))


D65 = (0.95047, 1.0, 1.08883)
ORDER = ["x", "y", "z", "white_x", "white_y", "white_z"]


def _grid():
    rows = []
    for v in ((0.95047, 1.0, 1.08883), (0.18, 0.18, 0.2), (0.4124, 0.2126, 0.0193), (0.0, 0.0, 0.0),
              (EPS, EPS, EPS), (0.005, 0.004, 0.003), (950.0, 1000.0, 1088.0), (951.0, 1.0, 1.0),
              (-1e-9, 0.5, 0.5), (0.5, float("nan"), 0.5), (0.5, 0.5, float("inf"))):
        rows.append(dict(zip(ORDER, v + D65)))
    for w in ((0.0, 1.0, 1.0), (1.0, -1.0, 1.0), (1.0, 1.0, float("nan")), (0.9642, 1.0, 0.8251)):
        rows.append(dict(zip(ORDER, (0.3, 0.4, 0.5) + w)))
    return rows


GRID = _grid()


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    yield "known answer: the white gives L 100, a 0, b 0", fn(*D65, *D65) == (100.0, 0.0, 0.0)
    L8 = fn(EPS, EPS, EPS, 1.0, 1.0, 1.0)
    yield "known answer: Y at the threshold gives L 8", abs(L8[0] - 8.0) < 1e-13
    yield "known answer: Y / Yn 0.18 gives L 49.496108", abs(fn(0.18, 0.18, 0.18, 1, 1, 1)[0] - 49.4961076101) < 1e-9
    below = fn(EPS * (1 - 1e-12), EPS * (1 - 1e-12), EPS * (1 - 1e-12), 1, 1, 1)[0]
    above = fn(EPS * (1 + 1e-12), EPS * (1 + 1e-12), EPS * (1 + 1e-12), 1, 1, 1)[0]
    yield "property: f is continuous at the threshold", abs(above - below) < 1e-9
    slope_lin = KAPPA * EPS * 1e-6
    slope_root = fn(1, EPS * (1 + 1e-6), 1, 1, 1, 1)[0] - fn(1, EPS, 1, 1, 1, 1)[0]
    yield "property: the slope of L joins at the threshold", abs(slope_root / slope_lin - 1) < 1e-5
    low = fn(0.008, 0.008, 0.008, 1, 1, 1)[0]
    yield "known answer: Y / Yn 0.008 gives L = 24389/27 x 0.008 = 7.226370", abs(low - KAPPA * 0.008) < 1e-12
    c = fn(0.5, 0.18, 0.05, 1, 1, 1)
    r3 = [t ** (1.0 / 3.0) for t in (0.5, 0.18, 0.05)]
    want = (116 * r3[1] - 16, 500 * (r3[0] - r3[1]), 200 * (r3[1] - r3[2]))
    yield "known answer: (0.5, 0.18, 0.05) of the white gives the formula's L, a, b", all(
        abs(g - w) < 1e-12 for g, w in zip(c, want))
    neutral = [fn(s * D65[0], s * D65[1], s * D65[2], *D65) for s in (0.001, 0.05, 0.5, 2.0)]
    yield "property: a neutral has a = b = 0", all(abs(r[1]) < 1e-12 and abs(r[2]) < 1e-12 for r in neutral)
    worst = 0.0
    t = EPS * 1.0000001
    while t < T_MAX:
        exact = t ** (1.0 / 3.0)
        worst = max(worst, abs(cbrt_of(fn, t) - exact) / exact)
        t *= 1.37
    yield "property: the cube root is within 2 ulp of a library cube root", worst < 4.5e-16
    for name, args in (("x", (-0.1, 0.5, 0.5) + D65), ("y", (0.5, float("nan"), 0.5) + D65),
                       ("z", (0.5, 0.5, 2000.0) + D65), ("x", (None, 0.5, 0.5) + D65),
                       ("white_x", (0.5, 0.5, 0.5, 0.0, 1.0, 1.0)), ("white_z", (0.5, 0.5, 0.5, 1.0, 1.0, -1.0))):
        got = fn(*args)
        yield f"refusal: {args[:3]!r} with white {args[3:]!r} names {name}", refused(got) and got.input == name


def cbrt_of(fn, t):
    """The cube root inside fn, read back from L: L = 116 cbrt(t) - 16 for Y = t, Yn = 1."""
    return (fn(t, t, t, 1.0, 1.0, 1.0)[0] + 16.0) / 116.0


def _with(fn_of_t):
    def planted(*args, **kw):
        vals = dict(zip(ORDER, args), **kw)
        r = reference(**vals)
        if refused(r):
            return r
        ts = [vals["x"] / vals["white_x"], vals["y"] / vals["white_y"], vals["z"] / vals["white_z"]]
        return fn_of_t(*ts)
    return planted


def _rounded(tx, ty, tz):
    g = [cbrt(t) if t > 0.008856 else 7.787 * t + 16.0 / 116.0 for t in (tx, ty, tz)]
    return (116.0 * g[1] - 16.0, 500.0 * (g[0] - g[1]), 200.0 * (g[1] - g[2]))


def _no_root(tx, ty, tz):
    return (116.0 * ty - 16.0, 500.0 * (tx - ty), 200.0 * (ty - tz))


def _swapped(tx, ty, tz):
    fx, fy, fz = f(tx), f(ty), f(tz)
    return (116.0 * fy - 16.0, 200.0 * (fx - fy), 500.0 * (fy - fz))


PLANTED = {"the rounded constants 0.008856 and 7.787": _with(_rounded),
           "the cube root dropped (L = 116 Y - 16)": _with(_no_root),
           "a and b scales swapped (200 and 500)": _with(_swapped)}
