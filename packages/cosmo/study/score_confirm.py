# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Score a set of seeds against Cosmic Emu on a preregistered pass line, and against an earlier set on the
same phases.

    python packages/cosmo/study/score_confirm.py --runs r6/conf/*.npz --base r4/m512/*.npz \
        --planted r6/planted/*.npz --json score_confirm.json

Pass line: the seed mean of P / emulator in every band to k = 5 at z = 0 and z = 1 inside [1 - tol, 1 + tol]
(tol 0.03), on the interlaced estimator where the runs recorded it (pk_il), else the plain one. Runs and base
are paired by the seed in the file name. The planted run and the base set go through the same line, so
the line is shown to fail where it should.
"""
import argparse
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402

BANDS = ("0.0-0.1", "0.1-0.3", "0.3-0.5", "0.5-1.0", "1.0-2.0", "2.0-3.0", "3.0-5.0")


def seed_of(path):
    m = re.search(r"seed(\d+)", Path(path).name)
    return m.group(1) if m else Path(path).stem


def bands(run, key, z, denom="emu"):
    k, w = run[f"k_z{z}"], run[f"nmodes_z{z}"]
    b = reference.bands(k, run[f"{key}_z{z}"] / run[f"{denom}_z{z}"], w)
    return {name: b[name]["mean_ratio"] for name in BANDS if name in b}


def score(paths, key, tol):
    runs = {seed_of(p): np.load(p) for p in paths}
    out, ok = {}, True
    for z in ("0", "1"):
        per = {s: bands(r, key if f"{key}_z{z}" in r else "pk", z) for s, r in runs.items()}
        cells = {}
        for b in BANDS:
            v = np.array([per[s][b] for s in per])
            inside = abs(v.mean() - 1) <= tol
            ok &= bool(inside)
            cells[b] = {"mean": float(v.mean()), "min": float(v.min()), "max": float(v.max()),
                        "seeds_outside": int(np.sum(abs(v - 1) > tol)), "pass": bool(inside)}
        out[f"z{z}"] = cells
    return out, ok


def same_phase(paths, base_paths, key="pk"):
    base = {seed_of(p): np.load(p) for p in base_paths}
    out = {}
    for p in paths:
        s = seed_of(p)
        if s not in base:
            continue
        run = np.load(p)
        out[s] = {}
        for z in ("0", "1"):
            k, w = run[f"k_z{z}"], run[f"nmodes_z{z}"]
            b = reference.bands(k, run[f"{key}_z{z}"] / base[s][f"{key}_z{z}"], w)
            out[s][f"z{z}"] = {name: b[name]["mean_ratio"] - 1 for name in BANDS if name in b}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--runs", nargs="+", required=True)
    ap.add_argument("--base", nargs="*", default=[])
    ap.add_argument("--planted", nargs="*", default=[])
    ap.add_argument("--tol", type=float, default=0.03)
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    res = {"tol": a.tol, "runs": a.runs}
    res["interlaced"], res["pass"] = score(a.runs, "pk_il", a.tol)
    res["plain"], res["pass_plain"] = score(a.runs, "pk", a.tol)
    if a.base:
        res["same_phase_plain_vs_base"] = same_phase(a.runs, a.base)
        if all("pk_il_z0" in np.load(p) for p in a.base):
            res["same_phase_interlaced_vs_base"] = same_phase(a.runs, a.base, "pk_il")
        res["base_plain"], res["base_pass"] = score(a.base, "pk", a.tol)
    if a.planted:
        res["planted"], res["planted_pass"] = score(a.planted, "pk_il", a.tol)
    for name in ("interlaced", "plain", "base_plain", "planted"):
        if name not in res:
            continue
        for z in ("z0", "z1"):
            print(f"{name:11s} {z}", " ".join(f"{b}:{c['mean']:.3f}({c['min']:.3f}-{c['max']:.3f}){'' if c['pass'] else '*'}"
                                              for b, c in res[name][z].items()))
    print("pass", res["pass"], "| base pass", res.get("base_pass"), "| planted pass", res.get("planted_pass"))
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
