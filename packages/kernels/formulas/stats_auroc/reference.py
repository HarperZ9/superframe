# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""stats.auroc/1: the reference, the known answers, the properties and the planted-bad controls.

The area under the ROC curve as the Mann-Whitney probability that a positive outscores a negative, with
one tie rule: a tied pair counts one half. The reference counts every pair:
  A = (2 * #{s_pos > s_neg} + #{s_pos = s_neg}) / (2 n_pos n_neg)
The BuildLang body uses the rank form, A = (R_pos - n_pos (n_pos + 1) / 2) / (n_pos n_neg) with R_pos the sum
of the positives' mid-ranks. Both numerators are exact multiples of one half below 2^52 and the division is
correctly rounded, so the two give the same bits.
"""
from ..core import Refusal, finite_array, refused

MAX_PAIRS = 2.0 ** 50

SPEC = {
    "id": "stats.auroc/1",
    "row": "STA-007",
    "export": "fk_stats_auroc",
    "formula": "A = (2 #{pos > neg} + #{pos = neg}) / (2 n_pos n_neg); equal to the mid-rank Mann-Whitney U "
               "over n_pos n_neg",
    "inputs": [("positive", "1", "1 or more finite scores, n_pos n_neg <= 2^50"),
               ("negative", "1", "1 or more finite scores, n_pos n_neg <= 2^50")],
    "array_inputs": ["positive", "negative"],
    "outputs": [("auc", "probability")],
    "loss": "Uses the order of the scores only, so it says nothing about calibration. Ties count one half, "
            "the trapezoid rule of the ROC curve and the mid-rank Mann-Whitney statistic; a rule that drops "
            "ties or counts them whole gives a different number. A higher score is taken to mean more likely "
            "positive. No interval is computed.",
    "mode": "bit-identical",
    "known_answers": ["labels 0,0,1,1 with scores 0.1,0.4,0.35,0.8 give 0.75 (scikit-learn 1.9.1 "
                      "roc_auc_score gives 0.75)",
                      "perfect separation gives 1, reversed separation 0, all scores equal 0.5"],
    "properties": ["A(pos, neg) = 1 - A(neg, pos)", "unchanged by a strictly increasing transform of the "
                   "scores", "0 <= A <= 1"],
    "controls": ["ties counted as wins", "ties dropped from the numerator and the denominator",
                 "ordinal ranks (ties broken by input order) in the rank form"],
    "provenance": {
        "source": "scikit-learn 1.9.1 roc_auc_score (installed copy, run 2026-11-15) for the known answer and "
                  "the tie rule; Hanley and McNeil 1982 (Radiology 143, 29), which states the equivalence "
                  "with the Wilcoxon statistic, is unread.",
        "body_from": "mission-control 2026-10-02-mmbu/features/validate.py:59 (rank form with scipy "
                     "rankdata mid-ranks)",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}


def reference(positive, negative):
    if not finite_array(positive, 1):
        return Refusal("positive", positive, "1 or more finite scores, n_pos n_neg <= 2^50")
    if not finite_array(negative, 1) or float(len(positive)) * float(len(negative)) > MAX_PAIRS:
        return Refusal("negative", negative, "1 or more finite scores, n_pos n_neg <= 2^50")
    twice = 0
    for s in positive:
        for t in negative:
            twice += 2 if s > t else 1 if s == t else 0
    return (float(twice) / (2.0 * float(len(positive)) * float(len(negative))),)


GRID = [{"positive": [0.35, 0.8], "negative": [0.1, 0.4]}, {"positive": [1, 2, 3], "negative": [0, -1]},
        {"positive": [0, -1], "negative": [1, 2, 3]}, {"positive": [5, 5, 5], "negative": [5, 5]},
        {"positive": [1, 2, 2, 3, 7], "negative": [2, 2, 0, 3, 3, 9, 1]},
        {"positive": [(i * 37) % 101 / 7.0 for i in range(300)], "negative": [(i * 53) % 97 / 5.0 for i in range(211)]},
        {"positive": [], "negative": [1.0]}, {"positive": [1.0], "negative": []},
        {"positive": [float("nan")], "negative": [1.0]}, {"positive": [1.0], "negative": [float("-inf")]}]


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    yield "known answer: scores 0.1, 0.4 (negative) and 0.35, 0.8 (positive) give 0.75", fn(
        [0.35, 0.8], [0.1, 0.4]) == (0.75,)
    yield "known answer: separation gives 1 and 0, all equal gives 0.5", fn([2, 3], [0, 1]) == (1.0,) \
        and fn([0, 1], [2, 3]) == (0.0,) and fn([4, 4, 4], [4, 4]) == (0.5,)
    p, n = GRID[4]["positive"], GRID[4]["negative"]
    yield "known answer: a tied sample gives 37/70 (ties count one half)", fn(p, n) == (37.0 / 70.0,)
    big_p, big_n = GRID[5]["positive"], GRID[5]["negative"]
    yield "property: A(pos, neg) = 1 - A(neg, pos)", abs(fn(big_p, big_n)[0] + fn(big_n, big_p)[0] - 1) < 1e-15 \
        and abs(fn(p, n)[0] + fn(n, p)[0] - 1) < 1e-15
    yield "property: unchanged by a strictly increasing transform", fn(
        [v ** 3 + 2 for v in p], [v ** 3 + 2 for v in n]) == fn(p, n)
    a = fn(big_p, big_n)[0]
    yield "property: 0 <= A <= 1", 0.0 <= a <= 1.0
    for name, args in (("positive", ([], [1.0])), ("negative", ([1.0], [])),
                       ("positive", ([float("nan")], [1.0])), ("negative", ([1.0], [float("inf")])),
                       ("positive", (None, [1.0])), ("negative", ([1.0], None))):
        got = fn(*args)
        yield f"refusal: {args!r} names {name}", refused(got) and got.input == name


def _ties_win(positive, negative):
    r = reference(positive, negative)
    if refused(r):
        return r
    wins = sum(1 for s in positive for t in negative if s >= t)
    return (wins / (len(positive) * len(negative)),)


def _ties_dropped(positive, negative):
    r = reference(positive, negative)
    if refused(r):
        return r
    wins = sum(1 for s in positive for t in negative if s > t)
    pairs = sum(1 for s in positive for t in negative if s != t)
    return (wins / pairs if pairs else 0.5,)


def _ordinal_ranks(positive, negative):
    r = reference(positive, negative)
    if refused(r):
        return r
    scores = list(positive) + list(negative)
    order = sorted(range(len(scores)), key=lambda i: scores[i])
    rank = [0.0] * len(scores)
    for pos, i in enumerate(order):
        rank[i] = pos + 1.0
    rp = sum(rank[:len(positive)])
    n_p, n_n = len(positive), len(negative)
    return ((rp - n_p * (n_p + 1) / 2.0) / (n_p * n_n),)


PLANTED = {"ties counted as wins": _ties_win, "ties dropped from the numerator and the denominator": _ties_dropped,
           "ordinal ranks (ties broken by input order) in the rank form": _ordinal_ranks}
