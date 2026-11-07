# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A P3M box with block time steps (cosmolab.stepping) on the lean GPU engine (cosmolab.lean), z = 49 to 0.

    python packages/cosmo/study/run_block.py --n 256 --box 128 --eta 0.025 --levels 4
    python packages/cosmo/study/run_block.py --n 512 --box 256 --eps 0.0333 --match-n 256 --linear camb

Writes the same .json and .npz layout as run_pk.py (P(k) at z = 1 and 0 against halofit and the emulator),
plus pair-force evaluations per particle, the level histogram, the number of cell-list rebuilds and the
peak GPU memory. GPU joules come from NVML's energy counter over the step loop.
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
from cosmolab import background, halofit, ic, lean, linear, power, reference, stepping  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402
from run_pk import step_grid  # noqa: E402


def measure(engine, cosmo, plin, box, ng, n3, z):
    delta = lean.deposit(engine.ops, engine.x, box, ng, n3, engine.slabs)
    k, pk, nm = power.power_spectrum(None, box, ng, engine.ops, n3, delta=delta)
    del delta
    aa = 1.0 / (1.0 + z)
    lin = plin(k, aa)
    ref = halofit.halofit(k, lambda kk: plin(kk, aa), float(cosmo.omega_m_a(aa)))
    return {"k": k, "pk": pk, "nmodes": nm, "halofit": ref, "plin": lin, "emu": reference.cosmicemu(k, z)}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=256)
    ap.add_argument("--box", type=float, default=256.0)
    ap.add_argument("--mesh", type=int, default=512)
    ap.add_argument("--seed", type=int, default=20261106)
    ap.add_argument("--a-init", type=float, default=0.02)
    ap.add_argument("--steps-log", type=int, default=10)
    ap.add_argument("--steps-late", type=int, default=45)
    ap.add_argument("--eta", type=float, default=0.025)
    ap.add_argument("--levels", type=int, default=4, help="sub-step levels under each global step")
    ap.add_argument("--eps", type=float, default=None, help="Plummer softening, Mpc/h (default 1/30 spacing)")
    ap.add_argument("--order", type=int, default=2, choices=(1, 2))
    ap.add_argument("--linear", default="eh", choices=("eh", "camb"))
    ap.add_argument("--match-n", type=int, default=None, help="share this coarser lattice's phases")
    ap.add_argument("--plain-long", action="store_true", help="plain kick and drift integrals for the mesh force")
    ap.add_argument("--max-gib", type=float, default=6.0, help="cap on this process's GPU memory (shared card)")
    ap.add_argument("--tag", default="")
    ap.add_argument("--out", default=os.environ.get("COSMO_OUT", "out/cosmo"))
    a = ap.parse_args()

    cosmo = background.Cosmology()
    plin = linear.LinearPower(cosmo) if a.linear == "eh" else linear.camb_power(cosmo)
    os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
    ops = get_backend("torch")
    total = ops.torch.cuda.get_device_properties(0).total_memory / 2 ** 30
    ops.torch.cuda.set_per_process_memory_fraction(min(1.0, a.max_gib / total))
    n, box, ng = a.n, a.box, a.mesh
    eps = a.eps if a.eps is not None else box / n / 30
    t0 = time.perf_counter()
    dk = ic.linear_delta_k(plin, box, n, a.seed, fixed=True, match_n=a.match_n)
    pos, mom = ic.from_delta_k_f32(cosmo, dk, box, n, a.a_init, a.order)
    del dk
    t_ic = time.perf_counter() - t0
    eng = lean.CudaEngine(cosmo, box, ng, n ** 3, pos, mom, ops, eps=eps, track_ids=False)
    del pos, mom
    grid = step_grid(a.a_init, n_log=a.steps_log, n_lin=a.steps_late)
    stepper = stepping.BlockStepper(cosmo, eps, a.eta, a.levels, linear_exact=not a.plain_long)
    snaps, t_meas = {}, [0.0]

    def keep(at, e):
        if abs(at - 0.5) < 1e-12:
            ops.sync()
            t = time.perf_counter()
            snaps[1.0] = measure(e, cosmo, plin, box, ng, n ** 3, 1.0)
            t_meas[0] += time.perf_counter() - t
        print(f"a = {at:.3f} pair evals/particle {e.pair_evals / n ** 3:.1f}", file=sys.stderr, flush=True)

    import nvml
    window = nvml.Window()
    ops.sync()
    window.__enter__()
    t1 = time.perf_counter()
    stepper.run(eng, grid, callback=keep)
    ops.sync()
    wall = time.perf_counter() - t1 - t_meas[0]
    window.__exit__(None, None, None)
    sha = hashlib.sha256(b"".join(np.ascontiguousarray(ops.to_numpy(c)).tobytes() for c in eng.x)).hexdigest()
    snaps[0.0] = measure(eng, cosmo, plin, box, ng, n ** 3, 0.0)
    acts = np.array([s[0] for s in stepper.stats], dtype=float)
    result = {"n": n, "box_mpc_h": box, "mesh": ng, "backend": ops.name, "force": "p3m-block",
              "global_steps": len(grid) - 1, "linear_exact": not a.plain_long, "levels": a.levels, "eta": a.eta, "eps": eps, "order": a.order,
              "linear": a.linear, "match_n": a.match_n, "seed": a.seed, "a_init": a.a_init,
              "rs": eng.rs, "rcut": eng.rcut, "chaining_cells": eng.nc,
              "pair_evals_per_particle": float(acts.sum() / n ** 3),
              "clamped_level_requests": int(sum(s[1] for s in stepper.stats)), "cell_list_builds": eng.resorts,
              "ic_seconds": t_ic, "run_seconds": wall,
              "pk_seconds_inside_loop": t_meas[0], "gpu_joules_nvml": window.joules,
              "peak_gpu_gib": ops.torch.cuda.max_memory_allocated() / 2 ** 30,
              "final_positions_sha256": sha, "cosmology": cosmo.__dict__, "pk_vs_emu": {}, "pk": {}}
    arrays = {}
    for z, m in snaps.items():
        arrays.update({f"{key}_z{z:g}": v for key, v in m.items() if key != "nmodes"})
        arrays[f"nmodes_z{z:g}"] = m["nmodes"]
        arrays[f"halofit_z{z:g}"] = m["halofit"]
        result["pk"][f"z{z:g}"] = reference.bands(m["k"], m["pk"] / m["halofit"], m["nmodes"])
        result["pk_vs_emu"][f"z{z:g}"] = reference.bands(m["k"], m["pk"] / m["emu"], m["nmodes"])
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = out / f"blk_n{n}_L{box:g}_g{len(grid) - 1}_l{a.levels}_eta{a.eta:g}{'_camb' if a.linear == 'camb' else ''}{'_plain' if a.plain_long else ''}{a.tag}"
    np.savez_compressed(f"{stem}.npz", **arrays)
    Path(f"{stem}.json").write_text(json.dumps(result, indent=1))
    print(json.dumps({k: v for k, v in result.items() if k != "cosmology"}, indent=1))


if __name__ == "__main__":
    main()
