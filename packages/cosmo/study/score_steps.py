# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Score time-step schemes against a reference run on the same initial conditions.

    python packages/cosmo/study/score_steps.py ref420.npz ref840.npz cand1.npz cand2.npz ... [--json out.json]

For each k band and redshift: P_cand / P_ref. A candidate passes a band when |P_cand / P_ref - 1| is at most
|P_840 / P_ref - 1| + 0.002: the change from doubling the reference's steps, plus a 0.2 percent floor for
bands where that change is near zero.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402

FLOOR = 0.002


def ratios(ref, other):
    out = {}
    for z in ("1", "0"):
        k, nm = ref[f"k_z{z}"], ref[f"nmodes_z{z}"]
        if not np.allclose(k, other[f"k_z{z}"]):
            raise ValueError("k bins differ: the runs must share box and measurement mesh")
        out[z] = {b: v["mean_ratio"] for b, v in reference.bands(k, other[f"pk_z{z}"] / ref[f"pk_z{z}"], nm).items()}
    return out


def main():
    args = sys.argv[1:]
    dest = None
    if "--json" in args:
        i = args.index("--json")
        dest, args = args[i + 1], args[:i] + args[i + 2:]
    ref, ref2, cands = np.load(args[0]), np.load(args[1]), args[2:]
    spread = ratios(ref, ref2)
    res = {"reference": args[0], "doubled": args[1], "floor": FLOOR, "spread": spread, "candidates": {}}
    for c in cands:
        r = ratios(ref, np.load(c))
        ok = {z: {b: abs(v - 1) <= abs(spread[z][b] - 1) + FLOOR for b, v in r[z].items()} for z in r}
        res["candidates"][Path(c).name] = {"ratio": r, "pass": ok, "all_pass": all(all(v.values()) for v in ok.values())}
        for z in r:
            print(f"{Path(c).name[:44]:44s} z={z}", " ".join(f"{v:.4f}{'' if ok[z][b] else '*'}" for b, v in r[z].items()))
        print("   all bands pass:", res["candidates"][Path(c).name]["all_pass"])
    if dest:
        Path(dest).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
