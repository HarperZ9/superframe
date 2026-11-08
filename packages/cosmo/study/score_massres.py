# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Same-phase resolution factor: R = band mean of P_hi / P_lo - 1 per seed, with the seed mean, sample sd
and a Student t interval, for several pairs at once (round eight).

    python packages/cosmo/study/score_massres.py \
        --pair main r8/mhi/*.npz -- r8/mlo/*.npz --pair planted r8/planted/*.npz -- r8/mlo/*seed20261106.npz \
        --absolute r8/mhi/*.npz --json score_massres.json

Each --pair NAME HI... -- LO... pairs files by the seed in the name (seedNNN). Both arms must share k bins
(same box and mesh). Weights are the mode counts of each bin, as in every round since one. --control
checks the scorer on an earlier pair with a recorded value: --control HI LO z band expected.
"""
import argparse
import glob
import json
import re
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402

BANDS = ("0.0-0.1", "0.1-0.3", "0.3-0.5", "0.5-1.0", "1.0-2.0", "2.0-3.0", "3.0-5.0")
T95 = {1: 12.706, 2: 4.303, 3: 3.182, 4: 2.776, 5: 2.571, 6: 2.447, 7: 2.365}


def seed_of(path):
    m = re.search(r"seed(\d+)", Path(path).name)
    return m.group(1) if m else "single"


def band_ratio(hi, lo, key, z):
    k, w = hi[f"k_z{z}"], hi[f"nmodes_z{z}"]
    if not np.allclose(k, lo[f"k_z{z}"]):
        raise ValueError("arms do not share k bins (box or mesh differ)")
    b = reference.bands(k, hi[f"{key}_z{z}"] / lo[f"{key}_z{z}"], w)
    modes = {name: int(w[(k >= float(name.split('-')[0])) & (k < float(name.split('-')[1]))].sum()) for name in b}
    return {name: b[name]["mean_ratio"] - 1 for name in BANDS if name in b}, modes


def stats(values):
    v = np.asarray(values, dtype=float) * 100
    out = {"per_seed_percent": [float(x) for x in v], "mean": float(v.mean()), "min": float(v.min()),
           "max": float(v.max())}
    if len(v) > 1:
        sd = float(v.std(ddof=1))
        half = T95[len(v) - 1] * sd / np.sqrt(len(v))
        out.update({"sd": sd, "ci95": [float(v.mean() - half), float(v.mean() + half)]})
    return out


def score_pair(hi_paths, lo_paths):
    lo = {seed_of(p): p for p in lo_paths}
    seeds, res, modes = [], {}, {}
    for p in hi_paths:
        s = seed_of(p)
        if s not in lo:
            raise ValueError(f"no coarse arm for seed {s}")
        h, l = np.load(p), np.load(lo[s])
        seeds.append(s)
        for key in ("pk_il", "pk"):
            for z in ("0", "1"):
                r, modes[f"z{z}"] = band_ratio(h, l, key, z)
                for b, v in r.items():
                    res.setdefault(key, {}).setdefault(f"z{z}", {}).setdefault(b, []).append(v)
    out = {"seeds": seeds, "modes_per_band": modes}
    for key, name in (("pk_il", "interlaced"), ("pk", "plain")):
        out[name] = {z: {b: stats(v) for b, v in d.items()} for z, d in res[key].items()}
    return out


def closure(base, cell):
    """Carry a measured P / emu by the seed-mean factor; words as preregistered."""
    value = base * (1 + cell["mean"] / 100)
    ci = [base * (1 + v / 100) for v in cell.get("ci95", [cell["mean"]] * 2)]
    verdict = "closes" if value >= 0.990 else ("partly closes" if value >= 0.980 else "does not close")
    return {"base": base, "value": value, "ci95": ci, "verdict": verdict}


def absolute(paths):
    out = {}
    for z in ("0", "1"):
        per = []
        for p in paths:
            d = np.load(p)
            b = reference.bands(d[f"k_z{z}"], d[f"pk_il_z{z}"] / d[f"emu_z{z}"], d[f"nmodes_z{z}"])
            per.append({name: b[name]["mean_ratio"] for name in BANDS if name in b})
        out[f"z{z}"] = {b: {"mean": float(np.mean([x[b] for x in per])), "min": float(min(x[b] for x in per)),
                            "max": float(max(x[b] for x in per))} for b in per[0]}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pair", nargs=3, action="append", default=[], metavar=("NAME", "HI_GLOB", "LO_GLOB"))
    ap.add_argument("--absolute", nargs=2, action="append", default=[], metavar=("NAME", "GLOB"))
    ap.add_argument("--control", nargs=5, default=None, metavar=("HI", "LO", "Z", "BAND", "EXPECTED"))
    ap.add_argument("--closure", type=float, default=None,
                    help="z = 0, k 3-5 reading to carry by the 'main' pair's factor (round seven: 0.976)")
    ap.add_argument("--json", default=None)
    a = ap.parse_args()
    res = {"pairs": {}, "absolute": {}}
    if a.control:
        hi, lo, z, band, want = a.control
        got = band_ratio(np.load(hi), np.load(lo), "pk", z)[0][band] * 100
        res["control"] = {"hi": hi, "lo": lo, "z": z, "band": band, "expected_percent": float(want),
                          "got_percent": got, "pass": abs(got - float(want)) <= 0.01}
        print(f"control z{z} {band}: got {got:.3f} expected {want} pass {res['control']['pass']}")
    for name, hi, lo in a.pair:
        res["pairs"][name] = r = score_pair(sorted(glob.glob(hi)), sorted(glob.glob(lo)))
        for z in ("z0", "z1"):
            print(f"{name:8s} {z}", " ".join(f"{b}:{c['mean']:+.2f}[{c['min']:+.2f},{c['max']:+.2f}]"
                                              for b, c in r["interlaced"][z].items()))
    for name, pattern in a.absolute:
        res["absolute"][name] = r = absolute(sorted(glob.glob(pattern)))
        for z in ("z0", "z1"):
            print(f"abs {name:6s} {z}", " ".join(f"{b}:{c['mean']:.3f}" for b, c in r[z].items()))
    if "b64" in res["pairs"] and "b256" in res["pairs"]:
        g = [res["pairs"][b]["interlaced"]["z0"]["3.0-5.0"]["mean"] for b in ("b64", "b256")]
        res["bridge_gap_3to5"] = abs(g[0] - g[1])
        res["bridge_box_dependent"] = res["bridge_gap_3to5"] > 1.5
        print(f"bridge gap 64 vs 256, z0 3-5: {res['bridge_gap_3to5']:.2f} points")
    if a.closure is not None and "main" in res["pairs"]:
        res["closure"] = closure(a.closure, res["pairs"]["main"]["interlaced"]["z0"]["3.0-5.0"])
        print("closure", res["closure"])
    if a.json:
        Path(a.json).write_text(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
