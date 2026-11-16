# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""colour.srgb_transfer/1: the reference, the known answers, the properties and the planted-bad controls.

The sRGB transfer function of IEC 61966-2-1 in both directions, on the closed range 0 to 1:
  decode (direction 0): v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055)^(12/5)
  encode (direction 1): v <= 0.0031308 ? 12.92 v : 1.055 v^(5/12) - 0.055

The powers 12/5 and 5/12 are rational, so each is a whole-number root found by Newton's method in a fixed
number of steps and then a whole-number power, with + - * / only (the route packages/colourmix uses). The
BuildLang body runs the same operations in the same order and gives the same bits; a check holds both
within 3e-15 of a library pow.
"""
import math

from ..core import Refusal, finite, refused

STEPS = 48

SPEC = {
    "id": "colour.srgb_transfer/1",
    "row": "COL-001",
    "export": "fk_colour_srgb_transfer",
    "formula": "decode: v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055)^(12/5); "
               "encode: v <= 0.0031308 ? 12.92 v : 1.055 v^(5/12) - 0.055",
    "inputs": [("value", "1", "finite, 0 <= v <= 1"), ("direction", "1", "0 (decode) or 1 (encode)")],
    "outputs": [("result", "1")],
    "loss": "The standard's piecewise curve, which is close to a 2.2 power display and is not a measured "
            "display. Its published constants do not join exactly: the two decode pieces differ by 2.3e-9 at "
            "0.04045, and 0.0031308 x 12.92 is 0.040449936, not 0.04045. Values outside 0 to 1 (the extended "
            "form that mirrors negatives) are refused, not clipped.",
    "mode": "bit-identical",
    "known_answers": ["decode 0.5 gives 0.2140411404822 (the registry value 0.21404)",
                      "decode and encode fix 0 and 1 (encode 1 gives 1 - 2^-53, as 1.055 - 0.055 does in binary)",
                      "encode 0.0031308 gives 0.040449936 on the linear piece"],
    "properties": ["encode(decode(v)) returns v within 3e-15 on 0 to 1",
                   "both directions rise monotonically",
                   "the power pieces agree with a library pow within 3e-15"],
    "controls": ["a plain 2.2 power curve", "the 0.03928 threshold of the 1996 draft",
                 "decode with the offset 0.055 left out"],
    "provenance": {
        "source": "W3C CSS Color Module Level 4, sample code conversions.js (lin_sRGB, gam_sRGB), read "
                  "2026-11-15 from the csswg-drafts repository: thresholds 0.04045 and 0.0031308, slope "
                  "12.92, offset 0.055, scale 1.055, exponent 2.4. The specification cites the sRGB standard "
                  "(IEC 61966-2-1:1999), which is unread (paid).",
        "body_from": "packages/colourmix/bld/transfer.bld (cm_modern_encode, cm_modern_decode), which uses the "
                     "same constants and rational-power route; 46 engine copies hold the same constants "
                     "(CALLERS.tsv in the formula registry)",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def ipow(y, n):
    p = 1.0
    for _ in range(n):
        p = p * y
    return p


def root(x, q):
    """The q-th root of x for 0 < x <= 1: STEPS Newton steps down from 1."""
    qf = float(q)
    y = 1.0
    for _ in range(STEPS):
        y = ((qf - 1.0) * y + x / ipow(y, q - 1)) / qf
    return y


def ratpow(x, num, den):
    return ipow(root(x, den), num)


def reference(value, direction):
    if not finite(value) or value < 0.0 or value > 1.0:
        return Refusal("value", value, "finite, 0 <= v <= 1")
    if direction not in (0, 1) or isinstance(direction, bool):
        return Refusal("direction", direction, "0 (decode) or 1 (encode)")
    v = float(value)
    if direction == 0:
        if v <= 0.04045:
            return (v / 12.92,)
        return (ratpow((v + 0.055) / 1.055, 12, 5),)
    if v <= 0.0031308:
        return (12.92 * v,)
    return (1.055 * ratpow(v, 5, 12) - 0.055,)


GRID = [{"value": v, "direction": d}
        for v in (0.0, 1e-300, 0.0031308, 0.0031309, 0.02, 0.04045, 0.040451, 0.2, 0.5, 0.735, 0.999999, 1.0,
                  -1e-12, 1.0000001, -0.5, float("nan"), float("inf"))
        for d in (0, 1, 2, -1, 0.5)]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    half = fn(0.5, 0)[0]
    yield "known answer: decode 0.5 is 0.2140411404822", abs(half - ((0.5 + 0.055) / 1.055) ** 2.4) < 3e-15 \
        and abs(half - 0.2140411404822) < 1e-13
    # 1.055 - 0.055 rounds to 1 - 2^-53 in binary, as the library form does; the kernel keeps that ulp.
    yield "known answer: 0 and 1 are fixed in both directions (1 ulp)", all(
        abs(fn(v, d)[0] - v) <= 2.3e-16 for v in (0.0, 1.0) for d in (0, 1)) and fn(0.0, 0) == (0.0,)
    yield "known answer: encode 0.0031308 is 0.040449936", abs(fn(0.0031308, 1)[0] - 0.040449936) < 1e-15
    xs = [i / 4096 for i in range(4097)]
    yield "property: encode(decode(v)) returns v within 3e-15", max(
        abs(fn(fn(x, 0)[0], 1)[0] - x) for x in xs) < 3e-15
    dec = [fn(x, 0)[0] for x in xs]
    enc = [fn(x, 1)[0] for x in xs]
    yield "property: both directions rise monotonically", all(b > a for a, b in zip(dec, dec[1:])) and all(
        b > a for a, b in zip(enc, enc[1:]))
    worst = max(max(abs(fn(x, 0)[0] - (x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4)),
                    abs(fn(x, 1)[0] - (12.92 * x if x <= 0.0031308 else 1.055 * math.pow(x, 1 / 2.4) - 0.055)))
                for x in xs)
    yield "property: agrees with a library pow within 3e-15", worst < 3e-15
    for name, args in (("value", (-0.01, 0)), ("value", (1.01, 1)), ("value", (float("nan"), 0)),
                       ("value", (None, 0)), ("direction", (0.5, 2)), ("direction", (0.5, -1)),
                       ("direction", (0.5, 0.5))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _gamma_22(value, direction):
    r = reference(value, direction)
    if refused(r):
        return r
    return (float(value) ** 2.2,) if direction == 0 else (float(value) ** (1 / 2.2),)


def _old_threshold(value, direction):
    r = reference(value, direction)
    if refused(r) or direction != 0:
        return r
    return (value / 12.92,) if value <= 0.03928 else (ratpow((value + 0.055) / 1.055, 12, 5),)


def _no_offset(value, direction):
    r = reference(value, direction)
    if refused(r) or direction != 0 or value <= 0.04045:
        return r
    return (ratpow(value / 1.055, 12, 5),)


PLANTED = {"a plain 2.2 power curve": _gamma_22,
           "the 0.03928 threshold of the 1996 draft": _old_threshold,
           "decode with the offset 0.055 left out": _no_offset}
