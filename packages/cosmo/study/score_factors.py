# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One-factor effects on P(k): each candidate run against a baseline on the same phases, band by band.

    python packages/cosmo/study/score_factors.py base.npz cand1.npz cand2.npz ... [--json out.json]

Delta = band mean of P_cand / P_base - 1 at z = 1 and 0 (the runs must share box and measurement mesh). For
every run that recorded the interlaced spectrum, also the measurement factor pk_il / pk on its own particles
and the band means of P / emulator for both estimators.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402


def band_means(k, ratio, w):
    return {b: v["mean_ratio"] for b, v in reference.bands(k, ratio, w).items()}


def own(run):
    """Per-run bands: P / emulator for each estimator, and interlaced over plain."""
    out = {}
    for z in ("1", "0"):
        k, w = run[f"k_z{z}"], run[f"nmodes_z{z}"]
        e = {"plain_vs_emu": band_means(k, run[f"pk_z{z}"] / run[f"emu_z{z}"], w)}
        if f"pk_il_z{z}" in run:
            e["il_vs_emu"] = band_means(k, run[f"pk_il_z{z}"] / run[f"emu_z{z}"], w)
            e["il_over_plain"] = band_means(k, run[f"pk_il_z{z}"] / run[f"pk_z{z}"], w)
            e["shot_il_over_emu"] = band_means(k, run[f"shot_il_z{z}"] / run[f"emu_z{z}"], w)
        out[z] = e
    return out


def delta(base, cand, key="pk"):
    out = {}
    for z in ("1", "0"):
        k = base[f"k_z{z}"]
        if not np.allclose(k, cand[f"k_z{z}"]):
            raise ValueError("k bins differ: the runs must share box and measurement mesh")
        out[z] = {b: v - 1 for b, v in band_means(k, cand[f"{key}_z{z}"] / base[f"{key}_z{z}"], base[f"nmodes_z{z}"]).items()}
    return out


def main():
    args = sys.argv[1:]
    dest = None
    if "--json" in args:
        i = args.index("--json")
        dest, args = args[i + 1], args[:i] + args[i + 2:]
    base = np.load(args[0])
    res = {"baseline": args[0], "baseline_bands": own(base), "candidates": {}}
    for c in args[1:]:
        run = np.load(c)
        r = {"delta_plain": delta(base, run), "bands": own(run)}
        if "pk_il_z0" in run and "pk_il_z0" in base:
            r["delta_il"] = delta(base, run, "pk_il")
        res["candidates"][Path(c).name] = r
        for z in ("1", "0"):
            print(f"{Path(c).name[:48]:48s} z={z}", " ".join(f"{b}:{100 * v:+.2f}" for b, v in r["delta_plain"][z].items()))
    if dest:
        Path(dest).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
