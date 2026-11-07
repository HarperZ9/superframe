# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A memory-lean CUDA engine for the block-step integrator (stepping.py), sized so 512^3 particles with a
512^3 mesh run in about 5 GB of GPU memory.

Where the memory goes, and what keeps it down:
  particles    six float32 arrays and a one-byte level: 25 bytes per particle (3.4 GB at 512^3); no (N, 3)
               force array exists, because each force is added to the momenta inside the kernel that sums it
  deposit      64-bit integer accumulation (bitwise repeatable) one slab of x planes at a time, so the
               integer mesh is a fraction of the float one
  mesh force   one component at a time; with offload=True the momenta wait in pinned host memory while the
               FFTs run, and each component comes back only for its own kick
  cell list    a chunked counting sort by chaining cell (stable, so deterministic), then each array is
               permuted in turn; the list stays valid while particles move less than the skin
The long-range half is the same Green's function as pm.P3MSolver (Gaussian split, both CIC windows divided
out, spectral gradient); the pair kernel is shortrange's with an active list, the kick and the level rule.
"""
import numpy as np

from . import lean_kernels, pm
from .backend import FIXED_BITS

_K = {}


def _kernel(name):
    if name not in _K:
        from .cudajit import Kernel
        src = {"cic_deposit_slab": lean_kernels.DEPOSIT, "cic_kick": lean_kernels.READBACK,
               "p3m_kick": lean_kernels.PAIR}[name]
        _K[name] = Kernel(src, name)
    return _K[name]


def deposit(ops, xyz, box, ng, n_particles, slabs=4, shift=0.0):
    """Density contrast on an ng^3 float32 mesh from float32 x, y, z, summed as integers slab by slab.
    shift: every particle moved by this many cells along each axis first (0.5 for an interlaced P(k))."""
    t = ops.torch
    n = len(xyz[0])
    q = float(2 ** FIXED_BITS)
    delta = t.empty((ng, ng, ng), device=ops.device, dtype=t.float32)
    edges = np.linspace(0, ng, slabs + 1).astype(int)
    k = _kernel("cic_deposit_slab")
    for x0, x1 in zip(edges[:-1], edges[1:]):
        acc = t.zeros((x1 - x0) * ng * ng, device=ops.device, dtype=t.int64)
        k(((n + 255) // 256,), (256,), *xyz, n, ng, float(box / ng), q, int(x0), int(x1 - x0), float(shift), acc)
        delta[x0:x1] = (acc.to(t.float64) * (ng ** 3 / (q * n_particles)) - 1.0).to(t.float32).view(x1 - x0, ng, ng)
        del acc
    return delta


class CudaEngine:
    def __init__(self, cosmo, box, ng, n_particles, pos, mom, ops, rs_cells=1.25, rcut_rs=4.5, eps=0.0,
                 skin=0.15, offload=None, slabs=4, track_ids=True, reach=2, sort_policy="skin", margin=1.5):
        t = ops.torch
        self.t, self.ops = t, ops
        self.box, self.ng, self.np_ = float(box), int(ng), int(n_particles)
        self.mesh = pm.PMSolver(cosmo, box, ng, n_particles, ops, gradient="ik", deconvolve=2,
                                split=rs_cells * box / ng)
        self.rs = self.mesh.split
        self.rcut, self.eps, self.gm = rcut_rs * self.rs, float(eps), self.mesh.gm
        self.reach = int(reach)                  # neighbour cells searched on each side
        self.nc = int(np.floor(self.box * self.reach / (self.rcut * (1 + skin))))
        if self.nc < 2 * self.reach + 1:
            raise ValueError("the box must hold at least 2 reach + 1 chaining cells per side")
        self.cs = self.box / self.nc
        self.skin = self.reach * self.cs - self.rcut
        self.slabs = slabs
        # "skin": re-sort when the summed drift bound passes the skin (any time). "plan": decide the re-sorts of
        # a global step at its start from max |p| times a margin (sort_plan), so an engine that steps slab by
        # slab (ooc.SlabRunner) can take the same re-sorts; the true bound is still summed, and every pair
        # evaluation made past the skin is counted in skin_violations.
        self.sort_policy, self.margin = sort_policy, float(margin)
        self.skin_violations, self._plan, self._sub, self.moved_plan = 0, [], 0, 0.0
        self.offload = (self.np_ >= 2 ** 26) if offload is None else offload
        # pos, mom: sequences of three float32 arrays (numpy or torch) or (N, 3) arrays
        self.x = [self._dev(_col(pos, c)) for c in range(3)]
        self.p = [self._dev(_col(mom, c)) for c in range(3)]
        for c in self.x:
            t.remainder(c, self.box, out=c)
            c.masked_fill_(c >= self.box, 0.0)
        self._g = self._green()
        self.mesh._k2 = None                     # only the Green's function needs |k|^2
        self._host = ([t.empty(self.np_, dtype=t.float32, pin_memory=True) for _ in range(3)]
                      if self.offload else None)
        self.level = t.zeros(self.np_, device=ops.device, dtype=t.uint8)
        self.ids = t.arange(self.np_, device=ops.device, dtype=t.int32) if track_ids else None
        self.nclamp = t.zeros(1, device=ops.device, dtype=t.int32)
        self.pair_evals = 0
        self.resorts = 0
        self._sort()

    def _dev(self, a):
        t = self.t
        if isinstance(a, t.Tensor):
            return a.to(device=self.ops.device, dtype=t.float32).contiguous()
        return t.as_tensor(np.ascontiguousarray(a, dtype=np.float32), device=self.ops.device)

    # ---- cell list -------------------------------------------------------------------------------
    def _sort(self, chunks=8):
        t, nc = self.t, self.nc
        cid = None
        for c in self.x:
            ci = (c / self.cs).floor_().to(t.int32).clamp_(0, nc - 1)
            cid = ci if cid is None else cid.mul_(nc).add_(ci)
            del ci
        count = t.bincount(cid, minlength=nc ** 3)
        start = t.cumsum(count, 0) - count
        order = t.empty(self.np_, device=self.ops.device, dtype=t.int32)
        edges = np.linspace(0, nc ** 3, chunks + 1).astype(np.int64)
        for c0, c1 in zip(edges[:-1], edges[1:]):
            idx = t.nonzero((cid >= int(c0)) & (cid < int(c1))).squeeze(1)
            if not len(idx):
                continue
            _, perm = t.sort(cid[idx], stable=True)
            off = int(start[int(c0)]) if c0 < nc ** 3 else self.np_
            order[off:off + len(idx)] = idx[perm].to(t.int32)
            del idx, perm
        del cid
        for arrs in (self.x, self.p):             # one array at a time: one array's worth of transient memory
            for c in range(3):
                arrs[c] = arrs[c].index_select(0, order)
        self.level = self.level.index_select(0, order)
        if self.ids is not None:
            self.ids = self.ids.index_select(0, order)
        self.start, self.count = start.to(t.int32).contiguous(), count.to(t.int32).contiguous()
        self.moved = 0.0
        self.resorts += 1

    # ---- forces ----------------------------------------------------------------------------------
    def _green(self):
        """The mesh Green's function as one real rfft-layout array: -1.5 Omega_m / k^2, both CIC windows
        divided out, times the Gaussian split exp(-k^2 r_s^2); built once, kept on the GPU."""
        m, t = self.mesh, self.t
        k2 = m._k2
        g = -1.5 * m.cosmo.omega_m / (k2 + (k2 == 0)) * (k2 != 0)
        w = 1.0
        for kk in m._k:
            w = w * t.sinc(0.5 * kk * m.cell / np.pi) ** 2
        return (g / w ** 2 * t.exp(-k2 * m.split ** 2)).to(t.float32).contiguous()

    def long_kick(self, k):
        if not k:
            return
        t, dev = self.t, self.ops.device
        self.park_momenta()                     # offload engines: momenta wait in pinned host memory
        phi = self.ops.rfftn(deposit(self.ops, self.x, self.box, self.ng, self.np_, self.slabs))
        phi.mul_(self._g)
        n, ng = self.np_, self.ng
        kick = _kernel("cic_kick")
        for c in range(3):
            g = self.ops.irfftn(phi * (-1j * self.mesh._grad_k(c)), (ng,) * 3).contiguous()
            pc = self.p[c] if not self.offload else self._host[c].to(dev)
            kick(((n + 255) // 256,), (256,), *self.x, n, ng, float(self.box / ng), g, float(k), pc)
            del g
            if self.offload:
                self._host[c].copy_(pc)
                del pc
        del phi
        self.unpark_momenta()

    def short_kick(self, thr, kclose, kopen, crit, lmax):
        t = self.t
        act = t.nonzero(self.level >= thr).squeeze(1).to(t.int32) if thr else self.nclamp
        nact = len(act) if thr else self.np_
        if nact:
            dev = self.ops.device
            kc = t.as_tensor(np.asarray(kclose, dtype=np.float32), device=dev)
            ko = t.as_tensor(np.asarray(kopen, dtype=np.float32), device=dev)
            self.nclamp.zero_()
            _kernel("p3m_kick")(((nact + 127) // 128,), (128,), *self.x, *self.p, self.level, act, int(bool(thr)), nact,
                                self.start,
                                self.count, self.nc, self.reach, float(self.cs), self.box, float(self.rcut ** 2),
                                float(1 / (2 * self.rs)), float(self.eps ** 2), float(self.gm), kc, ko, int(thr),
                                int(lmax), float(crit), self.nclamp)
        self.pair_evals += nact
        return nact, int(self.nclamp.item()) if nact else 0

    def vmax(self):
        """sqrt of the sum over axes of max |p_c|^2: a bound on every particle's speed in drift time."""
        v2 = 0.0
        for pc in self.p:
            lo, hi = self.t.aminmax(pc)
            v2 += max(abs(float(lo)), abs(float(hi))) ** 2
        return v2 ** 0.5

    def begin_global(self, drifts):
        if self.sort_policy == "plan":
            self._plan, self.moved_plan = sort_plan(self.moved_plan, self.vmax(), drifts, self.margin, self.skin)
            self._sub = 0

    def drift(self, d):
        t = self.t
        vmax2 = 0.0
        for xc, pc in zip(self.x, self.p):
            lo, hi = t.aminmax(pc)
            vmax2 += max(abs(float(lo)), abs(float(hi))) ** 2
            xc.add_(pc, alpha=float(d))
            t.remainder(xc, self.box, out=xc)
            xc.masked_fill_(xc >= self.box, 0.0)
        self.moved += float(d) * vmax2 ** 0.5
        if self.sort_policy == "plan":
            sort_now = self._plan[self._sub]
            self._sub += 1
            if sort_now:
                self._sort()
            elif self.moved > self.skin:
                self.skin_violations += 1       # the next pair evaluation may miss a neighbour
        elif self.moved > self.skin:
            self._sort()

    def park_momenta(self):
        """Move the momenta to pinned host memory (offload engines only) so a measurement can use the room."""
        if self.offload and self.p[0] is not None:
            for h, a in zip(self._host, self.p):
                h.copy_(a)
            self.p = [None, None, None]

    def unpark_momenta(self):
        if self.offload and self.p[0] is None:
            self.p = [h.to(self.ops.device) for h in self._host]

    # ---- read-out --------------------------------------------------------------------------------
    def positions(self, original_order=True):
        """(N, 3) float32 numpy array, in the initial particle order unless asked otherwise."""
        cols = [self.ops.to_numpy(c) for c in self.x]
        out = np.stack(cols, axis=1)
        if original_order and self.ids is not None:
            back = np.empty_like(out)
            back[self.ops.to_numpy(self.ids)] = out
            return back
        return out


def sort_plan(moved, vmax, drifts, margin, skin):
    """Which sub-steps of a global step end in a re-sort: after the drift that takes the predicted bound
    (margin vmax per unit drift time, vmax from the start of the step) past the skin. Returns the flags and
    the predicted bound carried into the next global step."""
    flags = []
    for d in drifts:
        moved += float(d) * margin * vmax
        flags.append(moved > skin)
        if flags[-1]:
            moved = 0.0
    return flags, moved


def _col(a, c):
    if isinstance(a, (list, tuple)):
        return a[c]
    return a[:, c]
