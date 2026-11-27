# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""stats.wilson_interval/1: the reference, the known answers, the properties and the planted-bad controls.

The Wilson score interval for a binomial proportion, k successes in n trials, at a normal quantile z:
  p = k / n,  d = 1 + z^2 / n,  c = (p + z^2 / (2n)) / d,  h = z sqrt(p (1 - p) / n + z^2 / (4 n^2)) / d
  low = max(0, c - h),  high = min(1, c + h)
In exact arithmetic low is 0 at k = 0 and high is 1 at k = n; the kernel sets those two ends exactly (c + h
rounds to 1 - 2^-53 at k = n) and otherwise clamps to 0 and 1 against rounding only.
"""
import math

from ..core import Refusal, finite, refused

SPEC = {
    "id": "stats.wilson_interval/1",
    "row": "STA-001",
    "export": "fk_stats_wilson_interval",
    "formula": "c = (p + z^2/(2n)) / (1 + z^2/n); h = z sqrt(p(1-p)/n + z^2/(4n^2)) / (1 + z^2/n); "
               "[max(0, c - h), min(1, c + h)]",
    "inputs": [("successes", "count", "a whole number, 0 <= k <= n"),
               ("trials", "count", "a whole number, 1 <= n <= 2^53"),
               ("z", "1", "finite, 0 < z <= 10")],
    "outputs": [("low", "probability"), ("high", "probability")],
    "loss": "Inverts the normal approximation to the binomial score test, with no continuity correction. "
            "Coverage swings around the nominal level as n and p change and dips below it for p near 0 or 1 "
            "at small n; the Clopper-Pearson interval is the exact, wider alternative. z is the two-sided "
            "quantile the caller chooses (1.959963984540054 for 95 percent); the kernel computes no "
            "quantile. Trials must be independent with one success probability.",
    "mode": "bit-identical",
    "known_answers": ["NIST/SEMATECH e-Handbook 7.2.4.1: n 200, p 0.13 (k 26), z 1.645 gives the lower bound "
                      "0.09577",
                      "k 0 of n 10 at z 1.96 gives [0, 0.2775401687666] (packages/_vectors/stats_vectors.json)",
                      "all ten Wilson rows of packages/_vectors/stats_vectors.json within 1e-12"],
    "properties": ["the interval for n - k is the mirror (1 - high, 1 - low) of the interval for k",
                   "0 <= low <= k/n <= high <= 1, with low exactly 0 at k 0 and high exactly 1 at k n",
                   "the width shrinks as n grows at a fixed k/n"],
    "controls": ["the Wald interval p -/+ z sqrt(p(1-p)/n) passed off as Wilson",
                 "z^2/(4n) in place of z^2/(4n^2)", "a NaN interval returned at n 0 instead of a refusal"],
    "provenance": {
        "source": "NIST/SEMATECH e-Handbook of Statistical Methods, section 7.2.4.1, 'Confidence intervals' "
                  "(itl.nist.gov/div898/handbook/prc/section2/prc241.htm), read 2026-11-15: the Wilson limits "
                  "with denominator 1 + z^2/n and the worked lower bound 0.09577. Wilson 1927 (JASA 22, 209) "
                  "is unread (JSTOR).",
        "body_from": "packages/lenspipe/lenspipe/tolerance.py:93 and the shared convention in "
                     "packages/_vectors/stats_vectors.json; the study copy read in the registry returned NaN "
                     "at n 0",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def whole(x):
    return finite(x) and float(x) == math.floor(x)


def reference(successes, trials, z):
    if not whole(trials) or trials < 1 or trials > 2.0 ** 53:
        return Refusal("trials", trials, "a whole number, 1 <= n <= 2^53")
    if not whole(successes) or successes < 0 or successes > trials:
        return Refusal("successes", successes, "a whole number, 0 <= k <= n")
    if not finite(z) or not (z > 0.0) or z > 10.0:
        return Refusal("z", z, "finite, 0 < z <= 10")
    k, n, z = float(successes), float(trials), float(z)
    p = k / n
    z2 = z * z
    d = 1.0 + z2 / n
    c = (p + z2 / (2.0 * n)) / d
    h = z * math.sqrt(p * (1.0 - p) / n + z2 / (4.0 * n * n)) / d
    low, high = c - h, c + h
    if k == 0.0 or low < 0.0:   # exact at k = 0; otherwise a clamp against rounding only
        low = 0.0
    if k == n or high > 1.0:    # exact at k = n
        high = 1.0
    return (low, high)


GRID = [{"successes": k, "trials": n, "z": z}
        for n in (1, 2, 10, 200, 2513, 1e9, 0, -3, 2.5, float("nan"))
        for k in (0, 1, 26, n, n - 1, -1, 0.5, float("inf"))
        for z in (1.959963984540054, 1.645, 1.0, 0.0, 10.0, 10.5, float("nan"))]


def _vectors():
    import json
    from pathlib import Path
    path = Path(__file__).resolve().parents[3] / "_vectors" / "stats_vectors.json"
    return json.loads(path.read_text(encoding="utf-8"))["wilson"]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    low, high = fn(26, 200, 1.645)
    yield "known answer: NIST 7.2.4.1, n 200, k 26, z 1.645 gives low 0.09577", round(low, 5) == 0.09577
    lo0, hi0 = fn(0, 10, 1.96)
    yield "known answer: k 0 of 10 at 1.96 is [0, 0.2775401687666]", lo0 == 0.0 and abs(hi0 - 0.2775401687666166) < 1e-13
    rows = _vectors()
    yield f"known answer: the {len(rows)} shared Wilson vectors within 1e-12", len(rows) >= 10 and all(
        max(abs(a - b) for a, b in zip(fn(r["k"], r["n"], r["z"]), r["interval"])) < 1e-12 for r in rows)
    mirror = all(max(abs(a - b) for a, b in zip(fn(n - k, n, 1.96), (1 - fn(k, n, 1.96)[1], 1 - fn(k, n, 1.96)[0])))
                 < 1e-14 for n in (1, 7, 50, 1000) for k in range(0, n + 1, max(1, n // 7)))
    yield "property: the interval for n - k mirrors the interval for k", mirror
    inside = all(0.0 <= fn(k, n, 1.96)[0] <= k / n <= fn(k, n, 1.96)[1] <= 1.0
                 for n in (1, 3, 40, 999) for k in range(0, n + 1, max(1, n // 9)))
    ends = fn(0, 40, 1.96)[0] == 0.0 and fn(40, 40, 1.96)[1] == 1.0
    yield "property: 0 <= low <= k/n <= high <= 1, exact at the ends", inside and ends
    widths = [fn(3 * m, 10 * m, 1.96) for m in (1, 4, 16, 64)]
    yield "property: the width shrinks as n grows", all(
        (b[1] - b[0]) < (a[1] - a[0]) for a, b in zip(widths, widths[1:]))
    for name, args in (("trials", (0, 0, 1.96)), ("trials", (1, 2.5, 1.96)), ("successes", (11, 10, 1.96)),
                       ("successes", (-1, 10, 1.96)), ("successes", (0.5, 10, 1.96)), ("z", (1, 10, 0.0)),
                       ("z", (1, 10, float("nan"))), ("trials", (1, None, 1.96))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _wald(successes, trials, z):
    r = reference(successes, trials, z)
    if refused(r):
        return r
    p = successes / trials
    h = z * math.sqrt(p * (1 - p) / trials)
    return (max(0.0, p - h), min(1.0, p + h))


def _quarter_n(successes, trials, z):
    r = reference(successes, trials, z)
    if refused(r):
        return r
    k, n = float(successes), float(trials)
    p, z2 = k / n, z * z
    d = 1.0 + z2 / n
    c = (p + z2 / (2.0 * n)) / d
    h = z * math.sqrt(p * (1.0 - p) / n + z2 / (4.0 * n)) / d
    return (max(0.0, c - h), min(1.0, c + h))


def _nan_at_zero(successes, trials, z):
    if trials == 0:
        return (float("nan"), float("nan"))
    return reference(successes, trials, z)


PLANTED = {"the Wald interval p -/+ z sqrt(p(1-p)/n) passed off as Wilson": _wald,
           "z^2/(4n) in place of z^2/(4n^2)": _quarter_n,
           "a NaN interval returned at n 0 instead of a refusal": _nan_at_zero}
