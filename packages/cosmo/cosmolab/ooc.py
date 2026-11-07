# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Out-of-core block stepping: the particles live in host memory or a file on disk, and each global step runs
slab by slab on the GPU with ghost zones, so the GPU holds one slab and its ghosts instead of every particle.

The store keeps six float32 columns and a level byte in the order of the chaining-cell sort (cell id with x
most significant), so the particles of a run of x cells are one contiguous range. One global step:
  mesh kick    deposit every particle (integer sums, so order does not matter), the FFTs on the GPU, then
               the kick read back chunk by chunk; the same kernels and the same numbers as lean.CudaEngine
  slabs        for each x slab of chaining cells: load it with `ghost` cells on each side, run all 2^L
               sub-steps there (pair kicks, drifts, re-sorts), then write back only the particles whose
               cell lies in the slab
Ghost particles near the outer edge miss neighbours, and that error moves inward by at most r_cut per pair
evaluation plus the drift, so a ghost of ghost_cells() cells keeps every slab particle exact. Re-sorts follow
sort_plan, decided at the start of each global step from max |p|, so a window re-sorts at the same sub-step
as an in-core lean.CudaEngine(sort_policy="plan") and the slab particles come out in the same order, with the
same bits: the window sort breaks ties by the particles' previous global order, as the global sort does.
"""
import hashlib
import math

import numpy as np

from . import lean, pm
from .backend import FIXED_BITS

COLS = ("x", "y", "z", "px", "py", "pz", "level")


class GhostTooNarrow(RuntimeError):
    """Neighbouring windows disagreed on which particles they own, so a slab particle saw a wrong ghost."""


def ghost_cells(rcut, cs, skin, levels, drift_max):
    """Ghost width in chaining cells: 2^L + 1 pair evaluations per global step (the last one closes the
    run), r_cut each, plus the skin and the drift of both the error front and the slab particles."""
    return int(math.ceil(((2 ** levels + 1) * rcut + 2 * skin + 2 * drift_max) / cs))


def window_ranges(c0, c1, ghost, nc):
    """x-cell ranges of a window in load order (low ghosts, slab, high ghosts), each split at the wrap."""
    if c1 - c0 + 2 * ghost > nc:
        raise ValueError(f"slab of {c1 - c0} cells and ghosts of {ghost} do not fit {nc} cells")
    out = []
    for a, b in ((c0 - ghost, c0), (c0, c1), (c1, c1 + ghost)):
        if a < 0:
            out += [(a + nc, nc), (0, b)] if b > 0 else [(a + nc, b + nc)]
        elif b > nc:
            out += [(a, nc), (0, b - nc)] if a < nc else [(a - nc, b - nc)]
        else:
            out.append((a, b))
    return [r for r in out if r[1] > r[0]]


class Store:
    """The particle columns in host memory (path None) or in .npy files under path (memory-mapped)."""

    def __init__(self, n, path=None, tag="a"):
        self.n, self.path = n, path
        self.cols = {}
        for c in COLS:
            dt = np.uint8 if c == "level" else np.float32
            if path is None:
                self.cols[c] = np.zeros(n, dtype=dt)
            else:
                self.cols[c] = np.lib.format.open_memmap(f"{path}/{tag}_{c}.npy", mode="w+", dtype=dt, shape=(n,))

    def __getitem__(self, c):
        return self.cols[c]


class SlabRunner:
    def __init__(self, cosmo, box, ng, n_particles, pos, mom, ops, eps, levels, rs_cells=1.25, rcut_rs=4.5,
                 skin=0.15, reach=2, nslabs=4, ghost=None, drift_max=1.0, margin=1.5, store_path=None,
                 chunk=2 ** 22, mesh_slabs=4):
        t = ops.torch
        self.t, self.ops = t, ops
        self.box, self.ng, self.np_ = float(box), int(ng), int(n_particles)
        self.mesh = pm.PMSolver(cosmo, box, ng, n_particles, ops, gradient="ik", deconvolve=2,
                                split=rs_cells * box / ng)
        self.rs = self.mesh.split
        self.rcut, self.eps, self.gm = rcut_rs * self.rs, float(eps), self.mesh.gm
        self.reach = int(reach)                       # the chaining mesh exactly as lean.CudaEngine builds it
        self.nc = int(np.floor(self.box * self.reach / (self.rcut * (1 + skin))))
        self.cs = self.box / self.nc
        self.skin = self.reach * self.cs - self.rcut
        self.L, self.margin, self.drift_max, self.chunk, self.mesh_slabs = int(levels), float(margin), drift_max, chunk, mesh_slabs
        self.ghost = ghost_cells(self.rcut, self.cs, self.skin, self.L, drift_max) if ghost is None else int(ghost)
        edges = np.linspace(0, self.nc, nslabs + 1).astype(int)
        self.slabs = list(zip(edges[:-1], edges[1:]))
        for c0, c1 in self.slabs:
            window_ranges(c0, c1, self.ghost, self.nc)  # raises if the window would wrap onto itself
        self._g = lean.CudaEngine._green(self)
        self.mesh._k2 = None
        self.store_path = store_path
        self.store, self.spare = Store(self.np_, store_path, "a"), Store(self.np_, store_path, "b")
        self.moved_plan, self.pair_evals, self.resorts = 0.0, 0, 0
        self.skin_violations, self.drift_violations, self.max_step_drift, self.moved_true = 0, 0, 0.0, 0.0
        self._initial_sort(pos, mom)

    # ---- store <-> GPU -----------------------------------------------------------------------------
    def _up(self, c, i0, i1):
        return self.t.from_numpy(np.ascontiguousarray(self.store[c][i0:i1])).to(self.ops.device)

    def _initial_sort(self, pos, mom):
        t, nc, dev = self.t, self.nc, self.ops.device
        cid = np.empty(self.np_, dtype=np.int32)
        cols = {}
        for i0 in range(0, self.np_, self.chunk):
            i1 = min(self.np_, i0 + self.chunk)
            xs = []
            for c in range(3):                         # the wrap of lean.CudaEngine, on the same float32 values
                a = _piece(pos, c, i0, i1, t, dev)
                t.remainder(a, self.box, out=a)
                a.masked_fill_(a >= self.box, 0.0)
                xs.append(a)
            cc = None
            for a in xs:
                ci = (a / self.cs).floor_().to(t.int32).clamp_(0, nc - 1)
                cc = ci if cc is None else cc.mul_(nc).add_(ci)
            cid[i0:i1] = cc.cpu().numpy()
            for c, a in zip(COLS[:3], xs):
                cols.setdefault(c, []).append(a.cpu().numpy())
            for c in range(3):
                cols.setdefault(COLS[3 + c], []).append(_piece(mom, c, i0, i1, t, dev).cpu().numpy())
        order = np.argsort(cid, kind="stable")
        for c in COLS[:6]:
            self.store[c][:] = np.concatenate(cols.pop(c))[order]
        self.count = np.bincount(cid, minlength=nc ** 3).astype(np.int64)
        self.resorts += 1

    def sha256(self):
        h = hashlib.sha256()
        for c in COLS[:3]:
            h.update(np.ascontiguousarray(self.store[c]).tobytes())
        return h.hexdigest()

    # ---- mesh force --------------------------------------------------------------------------------
    def deposit(self, shift=0.0):
        """Density contrast on the ng^3 mesh, the numbers of lean.deposit (integer sums, any particle order)."""
        t, ng = self.t, self.ng
        q = float(2 ** FIXED_BITS)
        delta = t.empty((ng, ng, ng), device=self.ops.device, dtype=t.float32)
        k = lean._kernel("cic_deposit_slab")
        edges = np.linspace(0, ng, self.mesh_slabs + 1).astype(int)
        for x0, x1 in zip(edges[:-1], edges[1:]):
            acc = t.zeros((x1 - x0) * ng * ng, device=self.ops.device, dtype=t.int64)
            for i0 in range(0, self.np_, self.chunk):
                i1 = min(self.np_, i0 + self.chunk)
                xyz = [self._up(c, i0, i1) for c in COLS[:3]]
                k((((i1 - i0) + 255) // 256,), (256,), *xyz, i1 - i0, ng, float(self.box / ng), q, int(x0),
                  int(x1 - x0), float(shift), acc)
            delta[x0:x1] = (acc.to(t.float64) * (ng ** 3 / (q * self.np_)) - 1.0).to(t.float32).view(x1 - x0, ng, ng)
            del acc
        return delta

    def long_kick(self, k):
        if not k:
            return
        ng = self.ng
        phi = self.ops.rfftn(self.deposit())
        phi.mul_(self._g)
        kick = lean._kernel("cic_kick")
        for c in range(3):
            g = self.ops.irfftn(phi * (-1j * self.mesh._grad_k(c)), (ng,) * 3).contiguous()
            for i0 in range(0, self.np_, self.chunk):
                i1 = min(self.np_, i0 + self.chunk)
                xyz = [self._up(cc, i0, i1) for cc in COLS[:3]]
                pc = self._up(COLS[3 + c], i0, i1)
                kick((((i1 - i0) + 255) // 256,), (256,), *xyz, i1 - i0, ng, float(self.box / ng), g, float(k), pc)
                self.store[COLS[3 + c]][i0:i1] = pc.cpu().numpy()
            del g
        del phi

    def vmax(self):
        """lean.CudaEngine.vmax over the store: max |p_c| per axis is exact in any chunk order."""
        v2 = 0.0
        for c in COLS[3:6]:
            v2 += float(np.abs(self.store[c]).max()) ** 2
        return v2 ** 0.5

    # ---- one global step ---------------------------------------------------------------------------
    def global_step(self, subs, flags, final_close=None):
        """Every slab through the sub-steps subs (and the closing pair kick on the last step)."""
        from .slabwindow import Window
        nc2 = self.nc ** 2
        start = np.concatenate([[0], np.cumsum(self.count)])
        count_new = np.zeros_like(self.count)
        off, moved = 0, 0.0
        for c0, c1 in self.slabs:
            w = Window(self, window_ranges(c0, c1, self.ghost, self.nc), start, (c0, c1))
            w.run(subs, flags, final_close)
            i0, i1, cnt = w.interior()
            n = i1 - i0
            if off + n > self.np_:
                raise GhostTooNarrow(f"slabs claimed more than {self.np_} particles: the ghost zone is too narrow")
            for c in COLS:
                self.spare[c][off:off + n] = w.cols[c][i0:i1].cpu().numpy()
            count_new[c0 * nc2:c1 * nc2] = cnt
            off += n
            self.pair_evals += w.pair_evals
            self.skin_violations += w.skin_violations
            self.max_step_drift = max(self.max_step_drift, w.moved_step)
            moved = max(moved, w.moved)
            self.drift_violations += int(w.moved_step > self.drift_max)
            del w
        if off != self.np_:
            raise GhostTooNarrow(f"slabs wrote back {off} particles of {self.np_}: the ghost zone is too narrow")
        self.store, self.spare = self.spare, self.store
        self.count = count_new
        self.moved_true = moved
        self.resorts += int(any(flags))

    def run(self, stepper, a_global, callback=None):
        from .lean import sort_plan
        steps, final_close, klast = stepper.plan(a_global)
        for n, (klong, subs) in enumerate(steps):
            self.long_kick(klong)
            flags, self.moved_plan = sort_plan(self.moved_plan, self.vmax(), [s[4] for s in subs], self.margin, self.skin)
            self.global_step(subs, flags, final_close if n == len(steps) - 1 else None)
            if callback is not None:
                callback(a_global[n + 1], self)
        self.long_kick(klast)
        return self


def _piece(a, c, i0, i1, t, dev):
    col = a[c] if isinstance(a, (list, tuple)) else a[:, c]
    piece = col[i0:i1]
    if isinstance(piece, t.Tensor):
        return piece.to(device=dev, dtype=t.float32).contiguous().clone()
    return t.as_tensor(np.ascontiguousarray(piece, dtype=np.float32), device=dev)
