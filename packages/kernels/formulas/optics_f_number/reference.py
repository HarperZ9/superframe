# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""optics.f_number/1: the reference, the known answer, the properties and the planted-bad controls."""
from ..core import Refusal, finite, positive, refused

SPEC = {
    "id": "optics.f_number/1",
    "row": "OPT-007",
    "export": "fk_optics_f_number",
    "formula": "N = |f| / D",
    "inputs": [("focal_length", "m", "finite and not 0"), ("aperture_diameter", "m", "finite and > 0")],
    "outputs": [("f_number", "1")],
    "loss": "Object at infinity; the stop's image is the pupil. The working f-number of a close focus and "
            "the T-number (transmission) are separate quantities.",
    "mode": "bit-identical",
    "known_answers": ["f 50 mm over D 25 mm is N 2 (the definition, exact in binary)"],
    "properties": ["scaling f and D by one factor leaves N unchanged", "N is linear in |f|",
                   "the sign of f does not change N"],
    "controls": ["a class default (15) returned when D is missing", "D / f in place of f / D"],
    "provenance": {
        "source": "N = f / D with D the entrance pupil diameter. Read 2026-11-15 as a pointer: Wikipedia "
                  "'F-number', which cites Smith, Hecht, Greivenkamp and ISO 517:2008. ISO 517 is unread "
                  "(paywalled).",
        "body_from": "mission-control 2026-10-31-unbuilt-instruments/vbench/budget/record.py:70 without its "
                     "default of 15, 5 or 10 for a missing f or D",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def reference(focal_length, aperture_diameter):
    if not finite(focal_length) or focal_length == 0.0:
        return Refusal("focal_length", focal_length, "finite and not 0")
    if not positive(aperture_diameter):
        return Refusal("aperture_diameter", aperture_diameter, "finite and > 0")
    return (abs(float(focal_length)) / float(aperture_diameter),)


GRID = [{"focal_length": f, "aperture_diameter": d}
        for f in (0.05, -0.05, 0.0, 1e-9, 2.0, 0.035, float("nan"), float("inf"))
        for d in (0.025, 0.0, -0.01, 1e-12, 0.0125, 3.0, float("nan"), float("inf"))]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    yield "known answer: 50 mm over 25 mm is exactly 2", fn(0.05, 0.025) == (2.0,)
    yield "property: one scale on f and D leaves N unchanged", fn(0.05 * 4, 0.025 * 4) == fn(0.05, 0.025)
    yield "property: N is linear in |f|", fn(0.2, 0.025) == (4 * fn(0.05, 0.025)[0],)
    yield "property: the sign of f does not change N", fn(-0.05, 0.025) == fn(0.05, 0.025)
    for bad in (0.0, -0.025, float("nan"), float("inf"), None):
        r = fn(0.05, bad)
        yield f"refusal: D = {bad!r} names the aperture", refused(r) and r.input == "aperture_diameter"
    r = fn(0.0, 0.025)
    yield "refusal: f = 0 names the focal length", refused(r) and r.input == "focal_length"


def _class_default(focal_length, aperture_diameter):
    """The fault this kernel replaces: a prior handed back as if it were a measurement."""
    if not positive(aperture_diameter):
        return (15.0,)
    return reference(focal_length, aperture_diameter)


def _inverted(focal_length, aperture_diameter):
    r = reference(focal_length, aperture_diameter)
    return r if refused(r) else (1.0 / r[0],)


PLANTED = {"a class default (15) returned when D is missing": _class_default,
           "D / f in place of f / D": _inverted}
