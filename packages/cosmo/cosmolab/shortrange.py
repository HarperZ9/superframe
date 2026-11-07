# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The short-range half of a P3M force: a direct pair sum inside a cut-off radius.

The Newtonian potential -G m / r is split with a Gaussian of scale r_s (Springel 2005, MNRAS 364, 1105):
    long  -G m erf(r / 2 r_s) / r      the mesh carries it, Phi_k multiplied by exp(-k^2 r_s^2)
    short -G m erfc(r / 2 r_s) / r     summed here over pairs closer than r_cut
so the pair acceleration is  a_i = -G m d / r^3 [erfc(u) + 2 u / sqrt(pi) exp(-u^2)],  u = r / 2 r_s,
d = x_i - x_j by the nearest periodic image. Plummer softening replaces r by rho = sqrt(r^2 + eps^2) in both
the potential and the force, so the force stays the exact gradient of the potential (the energy check
relies on that). The short-range term falls to 1.7e-2 of Newton at r_cut = 4.5 r_s and 5e-4 at 6 r_s.

Two engines give the same sums: scipy's periodic k-d tree on the CPU, and a CUDA kernel compiled at run
time (cudajit) in which each thread owns one particle and adds its neighbours in a fixed order, so the
GPU result repeats bit for bit with no atomics.
"""
import numpy as np
from scipy.spatial import cKDTree
from scipy.special import erfc

_TWO_OVER_SQRT_PI = 2.0 / np.sqrt(np.pi)


def kernel(d, gm, rs, eps=0.0, potential=False):
    """Pair acceleration on i from j (shape like d) or, with potential=True, the pair potential."""
    r2 = np.sum(d * d, axis=-1)
    rho = np.sqrt(r2 + eps * eps)
    u = rho / (2 * rs)
    if potential:
        return -gm * erfc(u) / rho
    s = erfc(u) + _TWO_OVER_SQRT_PI * u * np.exp(-u * u)
    return -gm * (s / rho ** 3)[..., None] * d


def _min_image(d, box):
    return d - box * np.round(d / box)


def pairs_cpu(pos, box, rcut):
    """Index pairs (i < j) closer than rcut across the periodic boundary."""
    p = np.mod(pos, box)
    p[p >= box] = 0.0
    return cKDTree(p, boxsize=box).query_pairs(rcut, output_type="ndarray")


def short_range_cpu(pos, box, gm, rs, rcut, eps=0.0, with_potential=False):
    """Short-range accelerations (N, 3), and the potential at each particle when asked."""
    pos = np.asarray(pos, dtype=np.float64)
    n = len(pos)
    ij = pairs_cpu(pos, box, rcut)
    acc = np.zeros((n, 3))
    pot = np.zeros(n)
    if len(ij):
        d = _min_image(pos[ij[:, 0]] - pos[ij[:, 1]], box)
        f = kernel(d, gm, rs, eps)
        for ax in range(3):
            acc[:, ax] = (np.bincount(ij[:, 0], weights=f[:, ax], minlength=n)
                          - np.bincount(ij[:, 1], weights=f[:, ax], minlength=n))
        if with_potential:
            ph = kernel(d, gm, rs, eps, potential=True)
            pot = np.bincount(ij[:, 0], weights=ph, minlength=n) + np.bincount(ij[:, 1], weights=ph, minlength=n)
    return (acc, pot) if with_potential else acc


def short_range_subset(pos, act, box, gm, rs, rcut, eps=0.0):
    """Short-range accelerations (len(act), 3) on the particles act from all particles: every pair with an
    active end, from the same k-d tree pair list as short_range_cpu, summed in a fixed order."""
    pos = np.asarray(pos, dtype=np.float64)
    n = len(pos)
    acc = np.zeros((n, 3))
    if not len(act):
        return acc[:0]
    isact = np.zeros(n, dtype=bool)
    isact[act] = True
    ij = pairs_cpu(pos, box, rcut)
    ij = ij[isact[ij[:, 0]] | isact[ij[:, 1]]]
    ij = ij[np.lexsort((ij[:, 1], ij[:, 0]))]
    if len(ij):
        f = kernel(_min_image(pos[ij[:, 0]] - pos[ij[:, 1]], box), gm, rs, eps)
        for ax in range(3):
            acc[:, ax] = (np.bincount(ij[:, 0], weights=f[:, ax], minlength=n)
                          - np.bincount(ij[:, 1], weights=f[:, ax], minlength=n))
    return acc[act]


_CUDA_SRC = r"""
extern "C" __global__ void p3m_short(const float* __restrict__ pos, const int* __restrict__ cell,
    const int* __restrict__ start, const int* __restrict__ count, int n, int nc, float box,
    float rcut2, float inv2rs, float eps2, float gm, float* __restrict__ acc)
{
    int i = blockIdx.x * blockDim.x + threadIdx.x;
    if (i >= n) return;
    float xi = pos[3 * i], yi = pos[3 * i + 1], zi = pos[3 * i + 2];
    int c = cell[i];
    int cz = c % nc, cy = (c / nc) % nc, cx = c / (nc * nc);
    float ax = 0.f, ay = 0.f, az = 0.f, hb = 0.5f * box;
    for (int dx = -1; dx <= 1; ++dx) {
        int ex = (cx + dx + nc) % nc;
        for (int dy = -1; dy <= 1; ++dy) {
            int ey = (cy + dy + nc) % nc;
            for (int dz = -1; dz <= 1; ++dz) {
                int ez = (cz + dz + nc) % nc;
                int q = (ex * nc + ey) * nc + ez;
                int j0 = start[q], j1 = j0 + count[q];
                for (int j = j0; j < j1; ++j) {
                    if (j == i) continue;
                    float ddx = xi - pos[3 * j], ddy = yi - pos[3 * j + 1], ddz = zi - pos[3 * j + 2];
                    ddx = ddx > hb ? ddx - box : (ddx < -hb ? ddx + box : ddx);
                    ddy = ddy > hb ? ddy - box : (ddy < -hb ? ddy + box : ddy);
                    ddz = ddz > hb ? ddz - box : (ddz < -hb ? ddz + box : ddz);
                    float r2 = ddx * ddx + ddy * ddy + ddz * ddz;
                    if (r2 >= rcut2) continue;
                    float rho2 = r2 + eps2;
                    if (rho2 <= 0.f) continue;
                    float irho = rsqrtf(rho2);
                    float u = rho2 * irho * inv2rs;
                    float s = erfcf(u) + 1.1283791670955126f * u * expf(-u * u);
                    float f = gm * s * irho * irho * irho;
                    ax -= f * ddx; ay -= f * ddy; az -= f * ddz;
                }
            }
        }
    }
    acc[3 * i] = ax; acc[3 * i + 1] = ay; acc[3 * i + 2] = az;
}
"""

_KERNEL = None


class ShortRangeCuda:
    """Chaining-mesh pair sum on CUDA. Cells are at least r_cut wide, so the 27 cells around a particle's
    own hold every neighbour; particles are sorted by cell (stable sort, so the order is fixed)."""

    def __init__(self, box, rcut):
        global _KERNEL
        import torch
        self.torch = torch
        self.box, self.rcut = float(box), float(rcut)
        self.nc = int(np.floor(self.box / self.rcut))
        if self.nc < 3:
            raise ValueError("the box must hold at least three cut-off cells per side")
        self.cell_size = self.box / self.nc
        if _KERNEL is None:
            from .cudajit import Kernel
            _KERNEL = Kernel(_CUDA_SRC, "p3m_short")
        self.kernel = _KERNEL

    def __call__(self, pos, gm, rs, eps=0.0):
        t = self.torch
        nc = self.nc
        p = t.remainder(pos.to(t.float32), self.box)
        ci = t.clamp((p / self.cell_size).floor().to(t.int64), 0, nc - 1)
        cid = (ci[:, 0] * nc + ci[:, 1]) * nc + ci[:, 2]
        cid_sorted, order = t.sort(cid, stable=True)
        ps = p[order].contiguous()
        count = t.bincount(cid_sorted, minlength=nc ** 3)
        start = (t.cumsum(count, 0) - count).to(t.int32).contiguous()
        out = t.empty_like(ps)
        n = len(ps)
        block = 128
        self.kernel(((n + block - 1) // block,), (block,), ps, cid_sorted.to(t.int32).contiguous(), start,
                    count.to(t.int32).contiguous(), n, nc, self.box, self.rcut ** 2, 1.0 / (2 * rs),
                    float(eps) ** 2, float(gm), out)
        acc = t.empty_like(out)
        acc[order] = out
        return acc.to(pos.dtype)
