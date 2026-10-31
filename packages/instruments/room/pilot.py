# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Pilot (exploratory, seeds 1 and 2 only): is the estimator alive, and what resolving width fits?"""
import sys
import time
import numpy as np
sys.dont_write_bytecode = True
import meter  # noqa: E402
import trial  # noqa: E402
if len(sys.argv) > 2:
    meter.DELTA_PER_BW, meter.PENCIL_DELTA_PER_BW = float(sys.argv[1]), float(sys.argv[2])
rows = []
METHOD = "all" if "--box" in sys.argv else "fast"
for seed in (1, 2):
    rng = np.random.default_rng(seed)
    for sp in ("ideal", "laptop", "phone"):
        for k in range(4):
            t = time.perf_counter()
            r = trial.run(rng, speaker=sp, method=METHOD)
            e = r["est"]
            rows.append(r)
            print(sp, round(r["V"], 1), "t60", round(r["t60"], 2), "est", round(e.get("t60", 0), 2),
                  "band", round(e.get("f_lo", 0), 1), round(e.get("f_hi", 0), 1), "peaks", len(e.get("peaks", [])),
                  "modes", len(e.get("pencil_modes", [])), "true", r["n_modes_true_in_band"],
                  *[f"{k} {r.get('errV_' + k, 9):+.2f}" for k in ("S1", "S2", "S3", "S4")],
                  f"{time.perf_counter() - t:.1f}s", flush=True)
for key in ("errV_S1", "errV_S2", "errV_S3", "errV_S4", "errS_S3", "errT60", "errAlpha"):
    v = np.array([abs(r.get(key, np.nan)) for r in rows])
    print(key, "median |err|", round(float(np.nanmedian(v)), 3))
