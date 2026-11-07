# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A small particle-mesh run in the twisted manifold E3 (a quarter turn on each pass along z) and its plate.

    python packages/cosmo/study/run_twisted.py --out out/cosmo/twisted

E3 with sides (128, 128, 32) Mpc/h has a cubic covering torus of 128 Mpc/h. The initial density is a
fixed-amplitude Gaussian field on the cover, averaged over the group so that it is a field on E3; modes the
gluing forbids are absent and the rest keep the linear amplitude. Zel'dovich displacements at z = 49, 64^3
lattice points on the cover (65536 particles of E3), a 128^3 mesh, 55 steps. Checks printed and saved:
the images of E3's particles land on the cover's other particles at the start (equivariant ICs); the run
equals a plain PM run of all 262144 images on the cover; the four z layers are one field turned a quarter. Nothing here is a claim about the topology of our universe.
"""
import argparse
import json
import sys
import time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
sys.path.insert(0, str(HERE.parent))
from scipy.spatial import cKDTree  # noqa: E402

from cosmolab import background, ic, linear, pm, power, twisted  # noqa: E402
from cosmolab.backend import get_backend  # noqa: E402
from run_pk import step_grid  # noqa: E402

NAME, L = "E3", (128.0, 128.0, 32.0)


def invariant_delta_k(plin, box, n, seed, G):
    """Fixed-amplitude delta_k on the cover lattice, averaged over G, forbidden modes zero."""
    dk = ic.linear_delta_k(plin, box, n, seed, fixed=True)
    d = np.fft.irfftn(dk, s=(n, n, n), axes=(0, 1, 2))
    q = ic.lattice(box, n)
    h = box / n
    acc = np.zeros(n ** 3)
    for R, t in G:
        idx = np.mod(np.round((q @ R.T + t) / h).astype(np.int64), n)
        acc += d.reshape(-1)[(idx[:, 0] * n + idx[:, 1]) * n + idx[:, 2]]
    sym = np.fft.rfftn((acc / len(G)).reshape(n, n, n))
    mod = np.abs(sym)
    keep = mod > 1e-9 * mod.max()
    return np.where(keep, sym / np.where(keep, mod, 1.0) * np.abs(dk), 0.0), keep


def layers(pos, box, ng, nlayer):
    """Projected overdensity of each z layer of thickness box / nlayer, on an ng^2 grid."""
    out = []
    for j in range(nlayer):
        sel = (pos[:, 2] >= j * box / nlayer) & (pos[:, 2] < (j + 1) * box / nlayer)
        img, _, _ = np.histogram2d(pos[sel, 0], pos[sel, 1], bins=ng, range=[[0, box], [0, box]])
        out.append(img / img.mean() - 1.0)
    return np.array(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--n", type=int, default=64, help="lattice points per side of the cover")
    ap.add_argument("--seed", type=int, default=20261106)
    ap.add_argument("--out", default="out/cosmo/twisted")
    a = ap.parse_args()
    cosmo = background.Cosmology()
    plin = linear.LinearPower(cosmo)
    box, n, ai = L[0], a.n, 0.02
    G = twisted.group(NAME, L)
    dk, keep = invariant_delta_k(plin, box, n, a.seed, G)
    pos_all, mom_all, _, _ = ic.from_delta_k(cosmo, dk, box, n, ai)
    q = ic.lattice(box, n)
    sel = q[:, 2] < L[2]
    pos, mom = pos_all[sel], mom_all[sel]
    # equivariance of the ICs: images of E3's particles are the cover's other particles
    sim = twisted.TwistedPM(cosmo, NAME, L, (2 * n,) * 3, int(sel.sum()))
    img = sim.wrap(sim.poisson.images(pos))
    dist, _ = cKDTree(np.mod(pos_all, box), boxsize=box).query(np.mod(img, box) % box)
    ops = get_backend("numpy")
    nt = len(img)

    def pk(p):
        return power.power_spectrum(sim.wrap(sim.poisson.images(p)), box, 2 * n, ops, nt, subtract_shot=False)
    k0, p0, nm = pk(pos)
    grid = step_grid(ai)
    t0 = time.perf_counter()
    pos1, mom1 = sim.run(pos, mom, grid)
    wall = time.perf_counter() - t0
    k1, p1, _ = pk(pos1)
    final = sim.wrap(sim.poisson.images(pos1))
    t1 = time.perf_counter()
    cover, _ = pm.PMSolver(cosmo, box, 2 * n, n ** 3, ops, deconvolve=1).run(pos_all, mom_all, grid)
    wall_cover = time.perf_counter() - t1
    off = cKDTree(np.mod(cover, box), boxsize=box).query(np.mod(final, box))[0]
    _, pc, _ = power.power_spectrum(cover, box, 2 * n, ops, n ** 3, subtract_shot=False)
    lay = layers(final, box, 512, len(G))
    # the layers are one field seen four times: layer j + 1 is layer j turned a quarter
    turn = [float(np.corrcoef(np.rot90(lay[j], k=1).ravel(), lay[(j + 1) % 4].ravel())[0, 1]) for j in range(4)]
    res = {"manifold": NAME, "sides_mpc_h": L, "particles_in_M": int(sel.sum()), "images": len(G), "mesh": 2 * n,
           "steps": len(grid) - 1, "run_seconds": wall, "ic_image_offset_max": float(dist.max()),
           "zero_plane_wave_fraction": float(1 - keep.mean()),
           "cover_run_seconds": wall_cover, "offset_from_cover_run_max_mpc_h": float(off.max()),
           "pk_vs_cover_run_max_rel": float(np.abs(p1 / pc - 1).max()),
           "layer_quarter_turn_correlation": turn}
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(out / "twisted_e3.npz", layers=lay, k=k1, pk=p1, nmodes=nm, plin=plin(k1))
    (out / "twisted_e3.json").write_text(json.dumps(res, indent=1))
    print(json.dumps(res, indent=1))


if __name__ == "__main__":
    main()
