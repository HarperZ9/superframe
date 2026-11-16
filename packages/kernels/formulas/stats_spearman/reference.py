# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""stats.spearman/1: the reference, the known answers, the properties and the planted-bad controls.

Spearman's rank correlation: the Pearson correlation of the two rank vectors, with tied values given the
mean of the ranks they span (mid-ranks). The ranks come from a stable sort; the sums run in index order.
"""
import math

from ..core import Refusal, finite_array, refused

MAX_LEN = 1_000_000

SPEC = {
    "id": "stats.spearman/1",
    "row": "STA-008",
    "export": "fk_stats_spearman",
    "formula": "r = sum (ra - mean)(rb - mean) / sqrt(sum (ra - mean)^2 sum (rb - mean)^2), ra and rb the "
               "mid-ranks, mean = (n + 1) / 2",
    "inputs": [("a", "1", "2 to 1,000,000 finite values, not all equal"),
               ("b", "1", "as many finite values as a, not all equal")],
    "array_inputs": ["a", "b"],
    "outputs": [("rho", "1")],
    "loss": "Measures monotone association only; a U-shaped relation can give 0. Ties take mid-ranks, the "
            "convention of SciPy rankdata 'average' and of Kendall and Stuart; the shortcut "
            "1 - 6 sum d^2 / (n (n^2 - 1)) is exact only without ties and is not used. A constant input has "
            "no ranks to correlate and is refused. No p value or interval is computed.",
    "mode": "bit-identical",
    "known_answers": ["the tied sample x 1,2,2,3,3,3,4,5 against y 2,1,3,3,5,4,4,6 gives 0.8386549 "
                      "(scipy.stats.spearmanr 1.17.1 gives 0.8386549; ordinal ranks give 0.9048)",
                      "a strictly increasing map of a gives 1, a strictly decreasing one -1"],
    "properties": ["rho(a, b) = rho(b, a)", "unchanged by any strictly increasing transform of either input",
                   "-1 <= rho <= 1"],
    "controls": ["ordinal ranks from argsort of argsort (ties broken by input order)",
                 "the no-ties shortcut 1 - 6 sum d^2 / (n (n^2 - 1)) on tied data",
                 "1.0 returned for a constant input instead of a refusal"],
    "provenance": {
        "source": "SciPy 1.17.1 reference for scipy.stats.rankdata (default method 'average') and the "
                  "installed spearmanr source, which ranks with rankdata and takes the Pearson coefficient, "
                  "read 2026-11-15. Spearman 1904 and Kendall and Stuart 31.18 are unread.",
        "body_from": "packages/lattice/lattice/stats.py:22 spearman (mid-ranks through scipy). The ordinal "
                     "form in 16 study files is the control (ADJUDICATION.md, STA-008)",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def midranks(x):
    """1-based ranks with ties given the mean of the ranks they span."""
    n = len(x)
    order = sorted(range(n), key=lambda i: x[i])
    ranks = [0.0] * n
    i = 0
    while i < n:
        j = i
        while j + 1 < n and x[order[j + 1]] == x[order[i]]:
            j += 1
        r = (float(i) + float(j)) / 2.0 + 1.0
        for t in range(i, j + 1):
            ranks[order[t]] = r
        i = j + 1
    return ranks


def pearson(ra, rb):
    n = len(ra)
    mean = (float(n) + 1.0) / 2.0
    sxy = sxx = syy = 0.0
    for i in range(n):
        dx, dy = ra[i] - mean, rb[i] - mean
        sxy = sxy + dx * dy
        sxx = sxx + dx * dx
        syy = syy + dy * dy
    r = sxy / math.sqrt(sxx * syy)
    return 1.0 if r > 1.0 else -1.0 if r < -1.0 else r


def _constant(x):
    return all(v == x[0] for v in x)


def reference(a, b):
    if not finite_array(a, 2) or len(a) > MAX_LEN or _constant(a):
        return Refusal("a", a, "2 to 1,000,000 finite values, not all equal")
    if not finite_array(b, 2) or len(b) != len(a) or _constant(b):
        return Refusal("b", b, "as many finite values as a, not all equal")
    return (pearson(midranks([float(v) for v in a]), midranks([float(v) for v in b])),)


TIED_X = [1, 2, 2, 3, 3, 3, 4, 5]
TIED_Y = [2, 1, 3, 3, 5, 4, 4, 6]
GRID = [{"a": TIED_X, "b": TIED_Y}, {"a": TIED_Y, "b": TIED_X}, {"a": [1, 2], "b": [2, 1]},
        {"a": [3.5, -1, 2, 2, 9], "b": [0.1, 0.1, 0.2, 0.3, 0.1]},
        {"a": [(i * 37) % 101 for i in range(500)], "b": [(i * 53) % 97 for i in range(500)]},
        {"a": [1e-300, 2e-300, 3e-300], "b": [1e300, -1e300, 0.0]},
        {"a": [1, 1, 1], "b": [1, 2, 3]}, {"a": [1, 2, 3], "b": [4, 4, 4]}, {"a": [1], "b": [1]},
        {"a": [1, 2, 3], "b": [1, 2]}, {"a": [1, float("nan"), 3], "b": [1, 2, 3]},
        {"a": [1, 2, 3], "b": [1, float("inf"), 3]}, {"a": [], "b": []}]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    r = fn(TIED_X, TIED_Y)[0]
    yield "known answer: the tied sample gives 0.83865492360634 (scipy spearmanr)", abs(r - 0.8386549236063445) < 1e-14
    a = [0.3, 1.7, -2.0, 5.5, 4.0, 0.0, 2.2]
    yield "known answer: an increasing map gives 1, a decreasing one -1", fn(a, [v ** 3 for v in a]) == (1.0,) \
        and fn(a, [-v for v in a]) == (-1.0,)
    yield "property: symmetric in a and b", fn(TIED_X, TIED_Y) == fn(TIED_Y, TIED_X)
    yield "property: unchanged by a strictly increasing transform", fn(
        [math.exp(v) for v in TIED_X], [v * 10 - 3 for v in TIED_Y]) == fn(TIED_X, TIED_Y)
    big = fn(GRID[4]["a"], GRID[4]["b"])[0]
    yield "property: -1 <= rho <= 1", -1.0 <= big <= 1.0 and -1.0 <= r <= 1.0
    for name, args in (("a", ([1, 1, 1], [1, 2, 3])), ("b", ([1, 2, 3], [5, 5, 5])), ("a", ([1], [1])),
                       ("b", ([1, 2, 3], [1, 2])), ("a", ([1, float("nan"), 3], [1, 2, 3])),
                       ("a", (None, [1, 2])), ("b", ([1, 2], None))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _ordinal(a, b):
    r = reference(a, b)
    if refused(r):
        return r

    def ords(x):
        order = sorted(range(len(x)), key=lambda i: x[i])
        ranks = [0.0] * len(x)
        for pos, i in enumerate(order):
            ranks[i] = pos + 1.0
        return ranks
    return (pearson(ords(a), ords(b)),)


def _shortcut(a, b):
    r = reference(a, b)
    if refused(r):
        return r
    ra, rb, n = midranks(a), midranks(b), len(a)
    d2 = sum((x - y) ** 2 for x, y in zip(ra, rb))
    return (1.0 - 6.0 * d2 / (n * (n * n - 1.0)),)


def _one_for_constant(a, b):
    if isinstance(a, (list, tuple)) and len(a) >= 2 and isinstance(b, (list, tuple)) and len(b) == len(a) \
            and (_constant(a) or _constant(b)):
        return (1.0,)
    return reference(a, b)


PLANTED = {"ordinal ranks from argsort of argsort (ties broken by input order)": _ordinal,
           "the no-ties shortcut 1 - 6 sum d^2 / (n (n^2 - 1)) on tied data": _shortcut,
           "1.0 returned for a constant input instead of a refusal": _one_for_constant}
