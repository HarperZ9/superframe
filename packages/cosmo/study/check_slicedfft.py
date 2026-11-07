# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sliced FFT force meshes (cosmolab.slicedfft) against torch's 3-D FFT, on a clustered density field.

    python packages/cosmo/study/check_slicedfft.py --mesh 256 --box 256 --out sliced256.json

The field is a lognormal transform of a Gaussian field (smoothed white noise), so it has the large
contrasts of a late-time density. Pass line: max |g_sliced - g_full| / max |g_full| at most 1e-5 for every
component. A planted wrong Green's block (rolled by one pencil along y) must miss it by orders of magnitude.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import background, lean, pm, slicedfft  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402


class _Mesh:
    def __init__(self, ops, box, ng, rs_cells=1.25):
        self.t = ops.torch
        self.mesh = pm.PMSolver(background.Cosmology(), box, ng, ng ** 3, ops, gradient="ik", deconvolve=2,
                                split=rs_cells * box / ng)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mesh", type=int, default=256)
    ap.add_argument("--box", type=float, default=256.0)
    ap.add_argument("--slabs", type=int, default=8)
    ap.add_argument("--pencils", type=int, default=8)
    ap.add_argument("--max-gib", type=float, default=4.0)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    ops = get_backend("torch")
    t = ops.torch
    t.cuda.set_per_process_memory_fraction(min(1.0, a.max_gib * 2 ** 30 / t.cuda.get_device_properties(0).total_memory))
    ng = a.mesh
    m = _Mesh(ops, a.box, ng)
    gen = t.Generator(device=ops.device).manual_seed(20261107)
    w = t.randn((ng, ng, ng), device=ops.device, generator=gen)
    wk = t.fft.rfftn(w)
    del w
    k2 = m.mesh._k2
    wk.mul_(t.exp(-k2 * (2.0 * a.box / ng) ** 2))
    gfield = t.fft.irfftn(wk, s=(ng,) * 3)
    del wk
    gfield /= gfield.std()
    delta = (t.exp(1.5 * gfield) / t.exp(1.5 * gfield).mean() - 1).to(t.float32).contiguous()
    del gfield
    res = {"mesh": ng, "box": a.box, "slabs": a.slabs, "pencils": a.pencils, "delta_max": float(delta.max())}
    green = lean.CudaEngine._green(m)
    gb, db = slicedfft.blocks_for(m)
    res["green_block_max_abs_diff"] = max(float((gb(y0, y0 + ng // 4) - green[:, y0:y0 + ng // 4]).abs().max())
                                          for y0 in range(0, ng, ng // 4))
    phi = ops.rfftn(delta)
    phi.mul_(green)
    full = [ops.irfftn(phi * (-1j * m.mesh._grad_k(c)), (ng,) * 3).cpu() for c in range(3)]
    del phi, green
    t.cuda.empty_cache()
    t.cuda.reset_peak_memory_stats()
    for name, gblock in (("sliced", gb), ("planted_rolled_green", lambda y0, y1: t.roll(gb(y0, y1), 1, dims=1))):
        err = [0.0, 0.0, 0.0]
        for c, x0, x1, g in slicedfft.force_slabs(ops, lambda x0, x1: delta[x0:x1], ng, gblock, db, a.slabs, a.pencils):
            err[c] = max(err[c], float((g.cpu() - full[c][x0:x1]).abs().max()))
        res[name] = [e / float(full[c].abs().max()) for c, e in enumerate(err)]
        if name == "sliced":
            res["peak_gpu_gib_sliced"] = t.cuda.max_memory_allocated() / 2 ** 30
    res["pass"] = max(res["sliced"]) <= 1e-5
    Path(a.out).write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
