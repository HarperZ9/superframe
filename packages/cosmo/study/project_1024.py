# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Project a 1024^3 out-of-core run (256 Mpc/h, mesh 1024, ghosts every sub-step, sliced FFT) from measured
runs, and apply the run rule (peak GPU under --max-gib, energy under --max-mj).

    python packages/cosmo/study/project_1024.py --equiv e2.json --disk e2_disk.json --io io_raw.json \
        --io-mmap io_mmap.json --ref512 blk_512.json --sliced512 sliced512.json --out proj.json

Every input is a measurement; the scaling rules are inferred and named in the output:
  compute   8 x the 512^3 in-core run's time and whole-card joules (same pair evaluations per particle:
            eight times the particles, an eighth of the r_cut volume), times the slab-to-in-core ratio
            measured at 256^3 with the RAM store
  traffic   each exchange reads every window (slab plus ghosts) and writes every slab back, 25 bytes a
            particle; 2^L exchanges a global step; at the measured store bandwidth on E:
  power     whole-card watts while the slab run waits on the disk, from the disk run minus the RAM run
  GPU       bytes per window particle at 256^3, plus the full cell tables at the 1024 mesh's chaining grid;
            the mesh phase from the sliced FFT's peak at mesh 512, times 8, over the slab count
"""
import argparse
import json
import math
from pathlib import Path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--equiv", required=True)
    ap.add_argument("--disk", required=True)
    ap.add_argument("--io", required=True, help="raw unbuffered store bandwidth (best case)")
    ap.add_argument("--io-mmap", required=True, help="memory-mapped store bandwidth (the code as built)")
    ap.add_argument("--ref512", required=True)
    ap.add_argument("--sliced512", required=True)
    ap.add_argument("--n", type=int, default=1024)
    ap.add_argument("--box", type=float, default=256.0)
    ap.add_argument("--levels", type=int, default=3)
    ap.add_argument("--global-steps", type=int, default=110)
    ap.add_argument("--ghost", type=int, default=6, help="ghost cells at the 1024 mesh (bound, D = 0.25)")
    ap.add_argument("--fft-slabs", type=int, default=64, help="slabs and pencils of the sliced FFT at 1024")
    ap.add_argument("--max-gib", type=float, default=6.0)
    ap.add_argument("--max-mj", type=float, default=3.0)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    load = lambda p: json.loads(Path(p).read_text())
    e2, disk, io, iom, r512, s512 = (load(p) for p in (a.equiv, a.disk, a.io, a.io_mmap, a.ref512, a.sliced512))
    n3 = a.n ** 3
    # chaining grid at the 1024 mesh, as lean.CudaEngine builds it (r_s 1.25 cells, r_cut 4.5 r_s, skin 0.15)
    rcut = 4.5 * 1.25 * a.box / a.n
    nc = int(math.floor(a.box * 2 / (rcut * 1.15)))
    per_layer = n3 / nc
    # GPU bytes per window particle at 256^3: peak minus the cell tables, over the largest window
    nc256, g256, s256 = e2["chaining_cells"], e2["ghost_cells"], e2["slabs"]
    win256 = e2["n"] ** 3 / nc256 * (math.ceil(nc256 / s256) + 2 * g256)
    tables = lambda ncc: ncc ** 3 * 24 / 2 ** 30
    bpp = (e2["ooc_peak_gib"] - tables(nc256)) * 2 ** 30 / win256
    room = a.max_gib - tables(nc) - 0.3
    layers = int(room * 2 ** 30 / bpp / per_layer)
    slab = layers - 2 * a.ghost
    if slab < 1:
        raise SystemExit("no slab fits")
    nslabs = math.ceil(nc / slab)
    peak = tables(nc) + bpp * per_layer * (slab + 2 * a.ghost) / 2 ** 30
    # one slab or pencil block of the spectrum: 8x the mesh at 1024, divided among more slabs
    mesh_peak = s512["peak_gpu_gib_sliced"] * 8 * s512["slabs"] / a.fft_slabs
    # compute: 8 x 512^3 in-core, times the slab/in-core ratio at 256^3 (RAM store)
    ratio_t = e2["ooc_seconds"] / e2["incore_seconds"]
    ratio_j = e2["ooc_joules"] / e2["incore_joules"]
    t_comp = 8 * r512["run_seconds"] * ratio_t
    j_comp = 8 * r512["gpu_joules_nvml"] * ratio_j
    # traffic: per exchange read windows, write slabs, 25 bytes a particle
    exchanges = a.global_steps * 2 ** a.levels
    rd = n3 * 25 * (slab + 2 * a.ghost) / slab
    wr = n3 * 25
    t_io_raw = exchanges * (rd / (io["read_gb_s"] * 1e9) + wr / (io["write_gb_s"] * 1e9))
    t_io_mm = exchanges * (rd / (iom["read_gb_s"] * 1e9) + wr / (iom["write_gb_s"] * 1e9))
    watts_wait = (disk["ooc_joules"] - e2["ooc_joules"]) / max(1.0, disk["ooc_seconds"] - e2["ooc_seconds"])
    if watts_wait <= 0:
        watts_wait = e2["ooc_joules"] / e2["ooc_seconds"]
    j_io = t_io_raw * watts_wait
    hours = (t_comp + t_io_raw) / 3600
    energy = (j_comp + j_io) / 1e6
    res = {"n": a.n, "chaining_cells": nc, "ghost_cells": a.ghost, "slab_layers": slab, "slabs": nslabs,
           "bytes_per_window_particle_256": bpp, "peak_gpu_gib": max(peak, mesh_peak), "window_peak_gib": peak,
           "mesh_peak_gib": mesh_peak, "store_bytes": n3 * 25, "host_traffic_tb": exchanges * (rd + wr) / 1e12,
           "slab_over_incore_time_256": ratio_t, "slab_over_incore_joules_256": ratio_j,
           "compute_seconds": t_comp, "io_seconds_raw": t_io_raw, "io_seconds_mmap": t_io_mm,
           "watts_while_waiting": watts_wait, "hours": hours, "hours_mmap": (t_comp + t_io_mm) / 3600,
           "energy_mj": energy, "energy_parts_mj": {"pair and mesh work": j_comp / 1e6, "store traffic": j_io / 1e6},
           "energy_mj_mmap": (j_comp + t_io_mm * watts_wait) / 1e6,
           "rules": ["compute = 8 x 512^3 in-core x slab/in-core ratio at 256^3 (inferred)",
                     "traffic at the raw bandwidth (best case); the memory-mapped store as built is slower",
                     "joules are NVML whole-card, shared with other jobs"]}
    res["run"] = bool(res["peak_gpu_gib"] < a.max_gib and energy < a.max_mj)
    Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
