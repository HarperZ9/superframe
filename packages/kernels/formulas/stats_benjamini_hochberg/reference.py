# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""stats.benjamini_hochberg/1: the reference, the known answers, the properties and the planted-bad controls.

Benjamini-Hochberg step-up, given as adjusted p values: sort p ascending (ties keep input order), then from
rank m down to 1, adjusted = min(previous, p * (m / rank)), starting from 1. Forming m / rank first
keeps every adjusted value at or above its p after rounding (p * m / rank can land one ulp below p). A test is rejected at false
discovery rate q when its adjusted value is at most q, which is the same set as "the r smallest, r the
largest rank with p(r) <= q r / m".
"""
from ..core import Refusal, finite, refused

MAX_LEN = 1_000_000

SPEC = {
    "id": "stats.benjamini_hochberg/1",
    "row": "STA-002",
    "export": "fk_stats_benjamini_hochberg",
    "formula": "sort p; from rank m down to 1, adj = min(adj_next, p (m / rank)) with adj_(m+1) = 1; "
               "reject = adj <= q",
    "inputs": [("p_values", "probability", "1 to 1,000,000 values, each finite and 0 <= p <= 1"),
               ("q", "probability", "finite, 0 < q <= 1")],
    "array_inputs": ["p_values"],
    "outputs": [("adjusted", "probability"), ("reject", "1")],
    "array_outputs": {"adjusted": "p_values", "reject": "p_values"},
    "loss": "Controls the expected share of false rejections at q for independent tests or tests with "
            "positive regression dependence (Benjamini and Yekutieli 2001); under arbitrary dependence it "
            "needs the larger Benjamini-Yekutieli factor, which is a different kernel. The family must be "
            "fixed before the p values are seen. The p values are taken as valid; the kernel cannot check "
            "how they were made.",
    "mode": "bit-identical",
    "known_answers": [
        "Benjamini and Hochberg 1995, the 15 p values of the thrombolysis example, as printed in the SciPy "
        "1.17.1 documentation of false_discovery_control: four rejections at q 0.05 and adjusted values "
        "0.0015, 0.003, 0.0095, 0.035625, 0.0603, 0.06385714, ..., 1",
        "the reject flags of all eight families in packages/_vectors/stats_vectors.json"],
    "properties": ["adjusted values are monotone in the raw p values and never below them",
                   "every p value at most q / m is rejected",
                   "permuting the input permutes the output the same way"],
    "controls": ["Bonferroni (p m) passed off as Benjamini-Hochberg", "a step-down walk (no running minimum)",
                 "an empty family returned as empty instead of a refusal"],
    "provenance": {
        "source": "SciPy 1.17.1, scipy.stats.false_discovery_control docstring (installed copy, read "
                  "2026-11-15), which reproduces the example of Benjamini and Hochberg 1995 (JRSS B 57, 289) "
                  "with its adjusted values. The 1995 paper is unread (Wiley, subscriber only).",
        "body_from": "packages/lattice/lattice/stats.py:39 bh, the same walk, held to "
                     "packages/_vectors/stats_vectors.json by packages/lattice/tests/test_stats_vectors.py",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}

THROMBOLYSIS = [0.0001, 0.0004, 0.0019, 0.0095, 0.0201, 0.0278, 0.0298, 0.0344, 0.0459, 0.3240, 0.4262,
                0.5719, 0.6528, 0.7590, 1.000]
THROMBOLYSIS_ADJUSTED = [0.0015, 0.003, 0.0095, 0.035625, 0.0603, 0.06385714, 0.06385714, 0.0645, 0.0765,
                         0.486, 0.58118182, 0.714875, 0.75323077, 0.81321429, 1.0]


def reference(p_values, q):
    if not isinstance(p_values, (list, tuple)) or not 1 <= len(p_values) <= MAX_LEN or not all(
            finite(v) and 0.0 <= v <= 1.0 for v in p_values):
        return Refusal("p_values", p_values, "1 to 1,000,000 values, each finite and 0 <= p <= 1")
    if not finite(q) or not (q > 0.0) or q > 1.0:
        return Refusal("q", q, "finite, 0 < q <= 1")
    p = [float(v) for v in p_values]
    m = len(p)
    order = sorted(range(m), key=lambda i: p[i])   # Python's sort is stable: ties keep input order
    adjusted = [0.0] * m
    reject = [0.0] * m
    run = 1.0
    for rank in range(m, 0, -1):
        i = order[rank - 1]
        v = p[i] * (float(m) / float(rank))   # m / rank >= 1 after rounding, so v >= p
        if v < run:
            run = v
        adjusted[i] = run
        reject[i] = 1.0 if run <= q else 0.0
    return (tuple(adjusted), tuple(reject))


def _vectors():
    import json
    from pathlib import Path
    path = Path(__file__).resolve().parents[3] / "_vectors" / "stats_vectors.json"
    return [f for f in json.loads(path.read_text(encoding="utf-8"))["families"] if f["p"]]


GRID = [{"p_values": THROMBOLYSIS, "q": 0.05}, {"p_values": THROMBOLYSIS[::-1], "q": 0.1},
        {"p_values": [0.5], "q": 0.05}, {"p_values": [0.01, 0.01, 0.01, 0.04], "q": 0.05},
        {"p_values": [0.0, 1.0, 0.0, 1.0], "q": 1.0}, {"p_values": [1e-300, 0.3, 0.3000000001], "q": 0.25},
        {"p_values": [(i * 7919 % 1000) / 1000.0 for i in range(1, 600)], "q": 0.2},
        {"p_values": [], "q": 0.05}, {"p_values": [0.2, 1.1], "q": 0.05}, {"p_values": [0.2, -0.1], "q": 0.05},
        {"p_values": [0.2, float("nan")], "q": 0.05}, {"p_values": [0.2], "q": 0.0},
        {"p_values": [0.2], "q": 1.5}, {"p_values": [0.2], "q": float("nan")}]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    adj, rej = fn(THROMBOLYSIS, 0.05)
    yield "known answer: Benjamini and Hochberg 1995 example rejects four at q 0.05", rej == (1.0,) * 4 + (0.0,) * 11
    yield "known answer: its adjusted values match the printed eight decimals", all(
        abs(a - b) < 5e-9 for a, b in zip(adj, THROMBOLYSIS_ADJUSTED))
    fams = _vectors()
    yield f"known answer: reject flags of the {len(fams)} shared families", len(fams) >= 7 and all(
        [bool(x) for x in fn(f["p"], f["alpha"])[1]] == f["bh"] for f in fams)
    raw = GRID[6]["p_values"]
    adj6 = fn(raw, 0.2)[0]
    pairs = sorted(zip(raw, adj6))
    yield "property: adjusted values are monotone in p and never below p", all(
        b[1] >= a[1] for a, b in zip(pairs, pairs[1:])) and all(a >= p for p, a in pairs)
    small = [0.001, 0.0049, 0.3, 0.9, 0.6, 0.002, 0.7, 0.8, 0.95, 0.99]
    yield "property: every p at most q / m is rejected", all(
        r == 1.0 for p, r in zip(small, fn(small, 0.05)[1]) if p <= 0.05 / len(small))
    perm = [THROMBOLYSIS[(7 * i) % 15] for i in range(15)]
    padj = fn(perm, 0.05)[0]
    yield "property: permuting the input permutes the output", all(
        padj[i] == adj[(7 * i) % 15] for i in range(15))
    for name, args in (("p_values", ([], 0.05)), ("p_values", ([0.1, 1.2], 0.05)),
                       ("p_values", ([0.1, float("nan")], 0.05)), ("p_values", (None, 0.05)),
                       ("q", ([0.1], 0.0)), ("q", ([0.1], 2.0)), ("q", ([0.1], None))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _bonferroni(p_values, q):
    r = reference(p_values, q)
    if refused(r):
        return r
    m = len(p_values)
    adj = tuple(min(1.0, p * m) for p in p_values)
    return (adj, tuple(1.0 if a <= q else 0.0 for a in adj))


def _no_running_min(p_values, q):
    r = reference(p_values, q)
    if refused(r):
        return r
    m = len(p_values)
    order = sorted(range(m), key=lambda i: p_values[i])
    adj = [0.0] * m
    for rank, i in enumerate(order, start=1):
        adj[i] = min(1.0, p_values[i] * m / rank)
    return (tuple(adj), tuple(1.0 if a <= q else 0.0 for a in adj))


def _empty_ok(p_values, q):
    if isinstance(p_values, (list, tuple)) and len(p_values) == 0:
        return ((), ())
    return reference(p_values, q)


PLANTED = {"Bonferroni (p m) passed off as Benjamini-Hochberg": _bonferroni,
           "a step-down walk (no running minimum)": _no_running_min,
           "an empty family returned as empty instead of a refusal": _empty_ok}
