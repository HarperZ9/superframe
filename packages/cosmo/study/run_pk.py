# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A LambdaCDM box from z = 49 to z = 0 and its matter power spectrum against halofit.

    python packages/cosmo/study/run_pk.py --n 256 --box 256 --backend torch
    python packages/cosmo/study/run_pk.py --n 128 --box 256 --backend numpy

Writes <out>/pk_n<N>_L<box>_<backend>.json and .npz (P(k) at z = 1 and z = 0, a projected density slab,
wall time, and GPU joules from NVML's energy counter when the run is on CUDA). Default out: out/cosmo.
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
from cosmolab import background, halofit, ic, linear, pm, power, reference  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402


def step_grid(a_init, n_log=10, a_switch=0.1, n_lin=45):
    """Log steps through the early, fast-growing era, then steps linear in a to a = 1."""
    early = np.geomspace(a_init, a_switch, n_log + 1)
    late = np.linspace(a_switch, 1.0, n_lin + 1)
    return np.unique(np.concatenate([early, late, [0.5]]))


def slab(pos, box, ng, thickness):
    """Projected overdensity of particles with z < thickness, cloud in cell on an ng^2 grid."""
    sel = pos[:, 2] < thickness
    p = pos[sel][:, :2] / box * ng
    i0 = np.floor(p).astype(np.int64)
    d = p - i0
    img = np.zeros((ng, ng))
    for cx in (0, 1):
        for cy in (0, 1):
            w = (d[:, 0] if cx else 1 - d[:, 0]) * (d[:, 1] if cy else 1 - d[:, 1])
            np.add.at(img, ((i0[:, 0] + cx) % ng, (i0[:, 1] + cy) % ng), w)
    return img / img.mean() - 1.0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=128)
    ap.add_argument("--box", type=float, default=256.0)
    ap.add_argument("--mesh-factor", type=int, default=2)
    ap.add_argument("--backend", default="auto")
    ap.add_argument("--seed", type=int, default=20261106)
    ap.add_argument("--a-init", type=float, default=0.02)
    ap.add_argument("--steps-late", type=int, default=45, help="steps linear in a from a = 0.1 to 1")
    ap.add_argument("--deconvolve", type=int, default=0, choices=(0, 1, 2),
                    help="cloud-in-cell windows divided out of the Green's function (0, 1 or 2)")
    ap.add_argument("--order", type=int, default=1, choices=(1, 2), help="Lagrangian order of the ICs")
    ap.add_argument("--float-atomics", action="store_true", help="CUDA deposit by float atomics (not bitwise)")
    ap.add_argument("--tag", default="", help="suffix for output names")
    ap.add_argument("--random-amplitude", action="store_true", help="draw |delta_k| too (default: fixed)")
    ap.add_argument("--out", default=os.environ.get("COSMO_OUT", "out/cosmo"))
    a = ap.parse_args()

    cosmo = background.Cosmology()
    plin = linear.LinearPower(cosmo)
    ops = get_backend(a.backend, **({"deterministic": False} if a.float_atomics else {}))
    n, box, ng = a.n, a.box, a.n * a.mesh_factor
    t0 = time.perf_counter()
    pos, mom, _ = ic.zeldovich(cosmo, plin, box, n, a.a_init, a.seed, fixed=not a.random_amplitude,
                              order=a.order)
    t_ic = time.perf_counter() - t0
    solver = pm.PMSolver(cosmo, box, ng, n ** 3, ops, deconvolve=a.deconvolve)
    grid = step_grid(a.a_init, n_lin=a.steps_late)
    snaps = {}

    def keep(at, p, m):
        if abs(at - 0.5) < 1e-12:
            snaps[0.5] = ops.to_numpy(p).astype(np.float64)

    window = None
    if ops.name.startswith("torch-cuda"):
        import nvml
        window = nvml.Window()
    x, p = ops.asarray(pos), ops.asarray(mom)
    del pos, mom
    ops.sync()
    if window:
        window.__enter__()
    t1 = time.perf_counter()
    x, p = solver.run(x, p, grid, callback=keep)
    ops.sync()
    wall = time.perf_counter() - t1
    if window:
        window.__exit__(None, None, None)
    final32 = np.ascontiguousarray(ops.to_numpy(x))
    sha = hashlib.sha256(final32.tobytes()).hexdigest()
    final = final32.astype(np.float64)
    del x, p, solver

    result = {"n": n, "box_mpc_h": box, "mesh": ng, "backend": ops.name, "steps": len(grid) - 1, "deconvolve": a.deconvolve,
              "order": a.order, "deterministic": getattr(ops, "deterministic", True), "final_positions_sha256": sha,
              "a_init": a.a_init, "seed": a.seed, "fixed_amplitude": not a.random_amplitude,
              "cosmology": cosmo.__dict__, "ic_seconds": t_ic, "run_seconds": wall,
              "gpu_joules_nvml": window.joules if window else None, "pk": {}}
    arrays = {}
    for z, posz in ((1.0, snaps[0.5]), (0.0, final)):
        aa = 1.0 / (1.0 + z)
        k, pk, nm = power.power_spectrum(ops.asarray(posz), box, ng, ops, n ** 3, cosmo=cosmo)
        ref = halofit.halofit(k, lambda kk: plin(kk, aa), float(cosmo.omega_m_a(aa)))
        emu, emu_boost = reference.cosmicemu(k, z), reference.cosmicemu_boost(k, z)
        lin = plin(k, aa)
        arrays.update({f"k_z{z:g}": k, f"pk_z{z:g}": pk, f"nmodes_z{z:g}": nm, f"halofit_z{z:g}": ref,
                       f"plin_z{z:g}": lin, f"emu_z{z:g}": emu})
        result["pk"][f"z{z:g}"] = reference.bands(k, pk / ref, nm)
        result["pk_vs_emu"] = result.get("pk_vs_emu", {})
        result["pk_vs_emu"][f"z{z:g}"] = reference.bands(k, pk / emu, nm)
        result["boost_vs_emu"] = result.get("boost_vs_emu", {})
        result["boost_vs_emu"][f"z{z:g}"] = reference.bands(k, pk / lin / emu_boost, nm)
    arrays["slab"] = slab(final, box, 1024, box / 16)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    stem = out / f"pk_n{n}_L{box:g}_{ops.name}{f'_dc{a.deconvolve}' if a.deconvolve else ''}_s{len(grid) - 1}{'_2lpt' if a.order == 2 else ''}{a.tag}"
    np.savez_compressed(f"{stem}.npz", **arrays)
    Path(f"{stem}.json").write_text(json.dumps(result, indent=1))
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
