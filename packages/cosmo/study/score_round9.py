# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Round nine: the pooled same-phase factor R over eight seeds, the closure on its interval (with and without
the base reading's own seed scatter), and softening convergence D = P(eps 0.0042) / P(eps 0.0083) - 1.

    python packages/cosmo/study/score_round9.py --r8 r8 --r9 r9 --base r7/conf --json r9/score_round9.json

Pairs and statistics come from score_massres (round eight's scorer), unchanged. Words follow
study/prereg/round9_pool_and_softening.json.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
import score_massres as sm  # noqa: E402

LINE = 0.5          # convergence line, percent at z = 0, 3-5
PLANTED_LINE = -1.0  # planted must read at or below this


def closure_words(value, lo):
    if lo >= 0.990:
        return "closes on the interval"
    if value >= 0.990:
        return "closes on the mean only"
    return "partly closes" if value >= 0.980 else "does not close"


def base_stats(paths, z="0", band="3.0-5.0"):
    """Per-seed absolute P / emu of the base runs (round seven), with its t half-width."""
    v = np.array([sm.absolute([p])[f"z{z}"][band]["mean"] for p in paths])
    half = sm.T95[len(v) - 1] * v.std(ddof=1) / np.sqrt(len(v)) if len(v) > 1 else 0.0
    return {"per_seed": v.tolist(), "mean": float(v.mean()), "half": float(half)}


def closure2(base, cell):
    """Factor-only interval (round eight's method) and the interval with the base's own scatter in quadrature."""
    m = base["mean"]
    value = m * (1 + cell["mean"] / 100)
    lo_f, hi_f = (m * (1 + c / 100) for c in cell["ci95"])
    rel_r = (cell["ci95"][1] - cell["mean"]) / 100 / (1 + cell["mean"] / 100)
    rel = float(np.hypot(rel_r, base["half"] / m))
    out = {"base": m, "value": value,
           "factor_only": {"ci95": [lo_f, hi_f], "words": closure_words(value, lo_f)},
           "with_base": {"ci95": [value * (1 - rel), value * (1 + rel)],
                         "words": closure_words(value, value * (1 - rel))}}
    return out


def convergence(cell):
    mean, upper = cell["mean"], cell.get("ci95", [cell["mean"]] * 2)[1]
    if mean >= LINE:
        words = "not converged"
    else:
        words = "converged on the interval" if upper < LINE else "converged on the mean"
    return {"line": LINE, "mean": mean, "upper": upper, "words": words}


def tail(d, first=1.84):
    """Geometric tail of later halvings, r = d / first (inferred, prereg's if_not_converged line)."""
    r = d / first
    return d * r / (1 - r) if 0 < r < 1 else None


def g(root, sub, pattern="*.npz"):
    return sorted(str(p) for p in Path(root, sub).glob(pattern))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--r8", required=True)
    ap.add_argument("--r9", required=True)
    ap.add_argument("--base", required=True, help="round seven's conf directory (z = 0, 3-5 reading 0.976)")
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    res = {"pairs": {}}
    pairs = {"r8": (g(a.r8, "mhi"), g(a.r8, "mlo")), "new5": (g(a.r9, "mhi"), g(a.r9, "mlo")),
             "pooled": (g(a.r8, "mhi") + g(a.r9, "mhi"), g(a.r8, "mlo") + g(a.r9, "mlo")),
             "D": (g(a.r9, "shalf"), g(a.r8, "mhi")), "prev": (g(a.r8, "mhi"), g(a.r8, "mmass"))}
    if g(a.r9, "planted"):
        pairs["planted"] = (g(a.r9, "planted"), g(a.r9, "shalf", "*seed20261106.npz"))
    if g(a.r9, "spure"):
        pairs["D_pure"] = (g(a.r9, "spure"), g(a.r8, "mhi", "*seed20261106.npz"))
    for name, (hi, lo) in pairs.items():
        if not hi:
            continue
        r = res["pairs"][name] = sm.score_pair(hi, lo)
        for z in ("z0", "z1"):
            print(f"{name:8s} {z} n={len(r['seeds'])}", " ".join(
                f"{b}:{c['mean']:+.2f}" + (f"[{c['ci95'][0]:+.2f},{c['ci95'][1]:+.2f}]" if "ci95" in c else "")
                for b, c in r["interlaced"][z].items()))
    r8 = res["pairs"]["r8"]["interlaced"]["z0"]["3.0-5.0"]["mean"]
    res["control"] = {"expected": 2.2375, "got": r8, "pass": abs(r8 - 2.2375) <= 0.01}
    print("scorer control", res["control"])
    base = g(a.base, "", "*.npz")
    res["closure"] = {}
    for z in ("0", "1"):
        b = base_stats(base, z)
        res["closure"][f"z{z}"] = closure2(b, res["pairs"]["pooled"]["interlaced"][f"z{z}"]["3.0-5.0"])
        res["closure"][f"z{z}"]["base_per_seed"] = b["per_seed"]
        print(f"closure z{z}", json.dumps(res["closure"][f"z{z}"]))
    if "D" in res["pairs"] and len(res["pairs"]["D"]["seeds"]) > 1:
        c = res["pairs"]["D"]["interlaced"]["z0"]["3.0-5.0"]
        res["convergence"] = convergence(c)
        res["convergence"]["tail_inferred"] = tail(c["mean"])
        print("convergence", res["convergence"])
    if "planted" in res["pairs"]:
        p = res["pairs"]["planted"]["interlaced"]["z0"]["3.0-5.0"]["mean"]
        res["planted_pass"] = p <= PLANTED_LINE
        print(f"planted {p:+.2f} pass {res['planted_pass']}")
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
