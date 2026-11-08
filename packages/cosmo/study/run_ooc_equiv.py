# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Out-of-core slab stepping (cosmolab.ooc) against the in-core lean engine on the same initial conditions.

    python packages/cosmo/study/run_ooc_equiv.py --n 256 --box 256 --mesh 512 --levels 3 --slabs 4
    python packages/cosmo/study/run_ooc_equiv.py ... --ghost 1 --skip-incore --ref out.json   # planted

Both runs take the block-step schedule of run_block.py and re-sort on sort_plan (the in-core engine with
sort_policy="plan"). Pass: the final positions and momenta hash the same. Records both hashes, the time and
NVML joules of each, the ghost width in cells, the drift and skin diagnostics, and P(k) bands of the
out-of-core run over the in-core one (deposited the same way), so a failing ghost width has a size.
"""
import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parents[2] / "joules"))
from cosmolab import background, ic, lean, linear, ooc, power, reference, stepping  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402
from run_pk import step_grid  # noqa: E402


def digest(cols):
    h = hashlib.sha256()
    for c in cols:
        h.update(np.ascontiguousarray(c).tobytes())
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=64)
    ap.add_argument("--box", type=float, default=64.0)
    ap.add_argument("--mesh", type=int, default=128)
    ap.add_argument("--seed", type=int, default=20261106)
    ap.add_argument("--steps-log", type=int, default=20)
    ap.add_argument("--steps-late", type=int, default=90)
    ap.add_argument("--levels", type=int, default=3)
    ap.add_argument("--eta", type=float, default=0.1)
    ap.add_argument("--eps", type=float, default=None)
    ap.add_argument("--slabs", type=int, default=4)
    ap.add_argument("--ghost", type=int, default=None, help="ghost cells (default: ooc.ghost_cells bound)")
    ap.add_argument("--drift-max", type=float, default=1.0)
    ap.add_argument("--exchange", type=int, default=None, help="sub-steps between window loads (default: a global step)")
    ap.add_argument("--fft", default="full", choices=("full", "sliced"), help="mesh transform of both engines")
    ap.add_argument("--fft-slabs", type=int, default=8)
    ap.add_argument("--fft-pencils", type=int, default=8)
    ap.add_argument("--store", default=None, help="directory for memory-mapped columns (default: host RAM)")
    ap.add_argument("--skip-incore", action="store_true")
    ap.add_argument("--compare-skin", action="store_true", help="also run in-core on the skin re-sort rule")
    ap.add_argument("--ref", default=None, help="json of an earlier run whose in-core hashes to compare against")
    ap.add_argument("--max-gib", type=float, default=6.0)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()

    cosmo = background.Cosmology()
    plin = linear.camb_power(cosmo)
    ops = get_backend("torch")
    t = ops.torch
    t.cuda.set_per_process_memory_fraction(min(1.0, a.max_gib * 2 ** 30 / t.cuda.get_device_properties(0).total_memory))
    n, box, ng = a.n, a.box, a.mesh
    eps = a.eps if a.eps is not None else box / n / 30
    grid = step_grid(0.02, n_log=a.steps_log, n_lin=a.steps_late)
    dk = ic.linear_delta_k(plin, box, n, a.seed, fixed=True)
    pos, mom = ic.from_delta_k_f32(cosmo, dk, box, n, 0.02, 2)
    del dk
    pos = [ops.to_numpy(c) if isinstance(c, t.Tensor) else np.asarray(c) for c in pos]
    mom = [ops.to_numpy(c) if isinstance(c, t.Tensor) else np.asarray(c) for c in mom]
    import nvml
    res = {"n": n, "box": box, "mesh": ng, "levels": a.levels, "eta": a.eta, "eps": eps, "seed": a.seed,
           "slabs": a.slabs, "global_steps": len(grid) - 1, "exchange": a.exchange, "fft": a.fft,
           "fft_slabs": a.fft_slabs, "fft_pencils": a.fft_pencils}
    k_in = pk_in = None
    if not a.skip_incore:
        t.cuda.reset_peak_memory_stats()
        with nvml.Window() as win:
            t0 = time.perf_counter()
            eng = lean.CudaEngine(cosmo, box, ng, n ** 3, pos, mom, ops, eps=eps, track_ids=False, sort_policy="plan",
                                  fft=a.fft, fft_slabs=a.fft_slabs, fft_pencils=a.fft_pencils)
            stepping.BlockStepper(cosmo, eps, a.eta, a.levels).run(eng, grid)
            ops.sync()
            res["incore_seconds"] = time.perf_counter() - t0
        res["incore_joules"] = win.joules
        res["incore_peak_gib"] = t.cuda.max_memory_allocated() / 2 ** 30
        res["incore_pos_sha256"] = digest([ops.to_numpy(c) for c in eng.x])
        res["incore_mom_sha256"] = digest([ops.to_numpy(c) for c in eng.p])
        res["incore_resorts"], res["incore_skin_violations"] = eng.resorts, eng.skin_violations
        k_in, pk_in, nm = power.power_spectrum(None, box, ng, ops, n ** 3, delta=lean.deposit(ops, eng.x, box, ng, n ** 3))
        del eng
        t.cuda.empty_cache()
        if a.compare_skin:
            eng = lean.CudaEngine(cosmo, box, ng, n ** 3, pos, mom, ops, eps=eps, track_ids=False)
            stepping.BlockStepper(cosmo, eps, a.eta, a.levels).run(eng, grid)
            res["skin_pos_sha256"], res["skin_resorts"] = digest([ops.to_numpy(c) for c in eng.x]), eng.resorts
            _, pk_s, _ = power.power_spectrum(None, box, ng, ops, n ** 3, delta=lean.deposit(ops, eng.x, box, ng, n ** 3))
            res["plan_over_skin"] = {b: v["mean_ratio"] - 1 for b, v in reference.bands(k_in, pk_in / pk_s, nm).items()}
            del eng
            t.cuda.empty_cache()
    elif a.ref:
        ref = json.loads(Path(a.ref).read_text())
        res["incore_pos_sha256"], res["incore_mom_sha256"] = ref["incore_pos_sha256"], ref["incore_mom_sha256"]
        k_in, pk_in = np.array(ref["k"]), np.array(ref["pk_incore"])
    if a.store:
        Path(a.store).mkdir(parents=True, exist_ok=True)
    t.cuda.reset_peak_memory_stats()
    with nvml.Window() as win:
        t0 = time.perf_counter()
        run = ooc.SlabRunner(cosmo, box, ng, n ** 3, pos, mom, ops, eps, a.levels, nslabs=a.slabs, ghost=a.ghost,
                             drift_max=a.drift_max, store_path=a.store, exchange=a.exchange, fft=a.fft,
                             fft_slabs=a.fft_slabs, fft_pencils=a.fft_pencils)
        try:
            run.run(stepping.BlockStepper(cosmo, eps, a.eta, a.levels), grid)
        except ooc.GhostTooNarrow as e:      # a planted narrow ghost may fail this way instead of by hash
            res["failed"] = str(e)
        ops.sync()
        res["ooc_seconds"] = time.perf_counter() - t0
    res["ooc_joules"] = win.joules
    res["ooc_peak_gib"] = t.cuda.max_memory_allocated() / 2 ** 30
    res.update({"ghost_cells": run.ghost, "chaining_cells": run.nc, "cell_mpc_h": run.cs, "rcut": run.rcut,
                "skin": run.skin, "ooc_resorts": run.resorts, "ooc_skin_violations": run.skin_violations,
                "max_step_drift": run.max_step_drift, "drift_violations": run.drift_violations,
                "ooc_pair_evals_per_particle": run.pair_evals / n ** 3, "window_loads": run.loads})
    res["ooc_pos_sha256"] = digest([run.store[c] for c in ooc.COLS[:3]])
    res["ooc_mom_sha256"] = digest([run.store[c] for c in ooc.COLS[3:6]])
    res["equal"] = res["ooc_pos_sha256"] == res.get("incore_pos_sha256") and res["ooc_mom_sha256"] == res.get("incore_mom_sha256")
    if "failed" in res:
        res["equal"] = False
        Path(a.out).write_text(json.dumps(res, indent=1))
        print(json.dumps(res, indent=1))
        return
    k, pk, nm = power.power_spectrum(None, box, ng, ops, n ** 3, delta=run.deposit())
    res["k"], res["pk_ooc"] = k.tolist(), pk.tolist()
    if pk_in is not None:
        res["pk_incore"] = np.asarray(pk_in).tolist()
        res["ooc_over_incore"] = {b: v["mean_ratio"] - 1 for b, v in reference.bands(k, pk / np.asarray(pk_in), nm).items()}
    out = Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(res, indent=1))
    print(json.dumps({kk: v for kk, v in res.items() if kk not in ("k", "pk_ooc", "pk_incore")}, indent=1))


if __name__ == "__main__":
    main()
