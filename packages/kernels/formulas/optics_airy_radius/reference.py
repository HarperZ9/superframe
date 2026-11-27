# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""optics.airy_radius/1: the reference, the known answers, the properties and the planted-bad controls."""
import math

from ..core import Refusal, positive, refused

# First zero of the Bessel function J1 divided by pi. OEIS A115369 prints the zero as
# 3.8317059702075123156...; checks() recomputes it from the power series of J1.
K = 1.2196698912665045

SPEC = {
    "id": "optics.airy_radius/1",
    "row": "OPT-008",
    "export": "fk_optics_airy_radius",
    "formula": "r = k * lambda * N, k = j(1,1) / pi = 1.2196698912665045",
    "inputs": [("wavelength", "m", "finite and > 0"), ("f_number", "1", "finite and > 0")],
    "outputs": [("radius", "m")],
    "loss": "Circular clear pupil, no aberration, incoherent scalar far field, small angles. A central "
            "obstruction, an apodised pupil or a fast lens (N below about 1) moves the first dark ring.",
    "mode": "bit-identical",
    "known_answers": ["k equals the first zero of J1 over pi to 1e-15 (zero printed by OEIS A115369)",
                      "550 nm at N 2 gives 1.3416 um"],
    "properties": ["r is linear in lambda and in N",
                   "r times the incoherent cutoff 1 / (lambda N) equals k for every lambda and N"],
    "controls": ["k = 1.22 (the rounded textbook literal)", "k = 1.21967 (the study literal)",
                 "the diameter 2.44 lambda N returned as the radius"],
    "provenance": {
        "source": "OEIS A115369, 'Decimal expansion of first zero of BesselJ(1,z)', read 2026-11-15: "
                  "3.8317059702075123156. NIST DLMF 10.21 defines the zeros. Airy 1835 is unread.",
        "body_from": "packages/rooms/core/constants.js airyFactor (1.22) and the five inline copies; the "
                     "constant is replaced by j(1,1) / pi (ADJUDICATION.md, OPT-008)",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def reference(wavelength, f_number):
    if not positive(wavelength):
        return Refusal("wavelength", wavelength, "finite and > 0")
    if not positive(f_number):
        return Refusal("f_number", f_number, "finite and > 0")
    return ((K * float(wavelength)) * float(f_number),)


def bessel_j1(x):
    """J1 by its power series, summed until the terms vanish. Good to about 1e-15 for x below 10."""
    term = x / 2.0
    total, m = term, 0
    while abs(term) > 1e-20:
        m += 1
        term *= -(x * x / 4.0) / (m * (m + 1))
        total += term
    return total


def first_zero_of_j1():
    lo, hi = 3.0, 4.5   # J1 is positive at 3 and negative at 4.5
    for _ in range(80):
        mid = 0.5 * (lo + hi)
        lo, hi = (mid, hi) if bessel_j1(mid) > 0 else (lo, mid)
    return 0.5 * (lo + hi)


GRID = [{"wavelength": w, "f_number": n}
        for w in (550e-9, 380e-9, 700e-9, 1.0, 0.0, -1e-9, 1e-300, float("nan"), float("inf"))
        for n in (2.0, 1.4, 22.0, 0.0, -2.0, 1e-12, float("nan"), float("inf"))]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    lam, n = 550e-9, 2.0
    r = fn(lam, n)
    k = r[0] / (lam * n)
    exact = first_zero_of_j1() / math.pi
    yield "known answer: k is the first zero of J1 over pi (1e-12 relative)", abs(k / exact - 1) < 1e-12
    yield "known answer: OEIS A115369 zero 3.8317059702075123", abs(k * math.pi / 3.8317059702075123 - 1) < 1e-12
    yield "known answer: 550 nm at N 2 is 1.3416 um", abs(r[0] - 1.3416e-6) < 5e-11
    yield "property: linear in lambda", abs(fn(2 * lam, n)[0] / r[0] - 2) < 1e-15
    yield "property: linear in N", abs(fn(lam, 8 * n)[0] / r[0] - 8) < 1e-15
    worst = max(abs(fn(w, m)[0] * (1.0 / (w * m)) / exact - 1)
                for w in (380e-9, 550e-9, 700e-9, 10.6e-6) for m in (1.0, 2.8, 16.0))
    yield "property: r times the cutoff 1 / (lambda N) equals k", worst < 1e-12
    for name, args in (("wavelength", (0.0, n)), ("wavelength", (float("nan"), n)), ("wavelength", (None, n)),
                       ("f_number", (lam, 0.0)), ("f_number", (lam, float("inf"))), ("f_number", (lam, -2.0))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _with_k(k):
    def planted(wavelength, f_number):
        r = reference(wavelength, f_number)
        return r if refused(r) else ((k * float(wavelength)) * float(f_number),)
    return planted


PLANTED = {"k = 1.22 (the rounded textbook literal)": _with_k(1.22),
           "k = 1.21967 (the study literal)": _with_k(1.21967),
           "the diameter 2.44 lambda N returned as the radius": _with_k(2 * K)}
