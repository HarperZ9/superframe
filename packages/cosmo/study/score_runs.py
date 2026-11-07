# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Score saved runs (run_pk.py .npz files) against halofit and the Cosmic Emu, band by band.

    python packages/cosmo/study/score_runs.py run1.npz run2.npz ... [--json out.json]

For each reference and redshift, prints the mean over runs of the mode-weighted band ratio and the range
across runs. "emu" divides by the emulator's P(k); "emu-boost" divides P / P_lin(input) by the emulator's
P / P_lin(CAMB), which removes the 3.9 percent fit error of the Eisenstein-Hu input spectrum.
"""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402


def score(paths):
    out = {}
    for z in ("1", "0"):
        for ref in ("halofit", "emu", "emu-boost"):
            per = []
            for p in paths:
                d = np.load(p)
                k, pk, nm = d[f"k_z{z}"], d[f"pk_z{z}"], d[f"nmodes_z{z}"]
                if ref == "halofit":
                    r = pk / d[f"halofit_z{z}"]
                elif ref == "emu":
                    r = pk / reference.cosmicemu(k, float(z))
                else:
                    r = pk / d[f"plin_z{z}"] / reference.cosmicemu_boost(k, float(z))
                per.append(reference.bands(k, r, nm))
            out[f"z{z}/{ref}"] = {b: {"mean": float(np.mean([q[b]["mean_ratio"] for q in per])),
                                      "lo": float(min(q[b]["mean_ratio"] for q in per)),
                                      "hi": float(max(q[b]["mean_ratio"] for q in per))} for b in per[0]}
    return out


def main():
    args = sys.argv[1:]
    dest = None
    if "--json" in args:
        i = args.index("--json")
        dest = args[i + 1]
        args = args[:i] + args[i + 2:]
    res = score(args)
    for key, bands in res.items():
        print(f"{key:14s}", "  ".join(f"{b}: {v['mean']:.3f} ({v['lo']:.3f}-{v['hi']:.3f})" for b, v in bands.items()))
    if dest:
        Path(dest).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
