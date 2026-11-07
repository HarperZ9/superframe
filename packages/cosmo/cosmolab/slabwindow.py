# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One slab and its ghost zones on the GPU for ooc.SlabRunner: the pair kicks, drifts and re-sorts of one
global step, with the kernels and arithmetic of lean.CudaEngine, so a slab particle gets the same bits.

The cell tables are full nc^3 arrays (16 MB at nc = 158) indexed by global cell id, with zero counts outside
the window, so the pair kernel runs unchanged. A re-sort keys on (cell id, previous order), where the
previous order is the global index at load and the window rank after that: the global stable sort gives
the same relative order to the same particles.
"""
import numpy as np

from . import lean
from .ooc import COLS


class Window:
    def __init__(self, runner, ranges, start, slab):
        r = self.r = runner
        t, dev, nc2 = r.t, r.ops.device, r.nc ** 2
        self.t, self.slab = t, slab
        pieces = {c: [] for c in COLS}
        gidx, lstart, lcount = [], t.zeros(r.nc ** 3, dtype=t.int32, device=dev), t.zeros(r.nc ** 3, dtype=t.int32, device=dev)
        n = 0
        self.slab_range = None
        for xa, xb in ranges:
            g0, g1 = int(start[xa * nc2]), int(start[xb * nc2])
            for c in COLS:
                pieces[c].append(r.store[c][g0:g1])
            gidx.append(np.arange(g0, g1, dtype=np.int64))
            cnt = r.count[xa * nc2:xb * nc2]
            lcount[xa * nc2:xb * nc2] = t.from_numpy(cnt.astype(np.int32)).to(dev)
            lstart[xa * nc2:xb * nc2] = t.from_numpy((start[xa * nc2:xb * nc2] - g0 + n).astype(np.int32)).to(dev)
            if xa >= slab[0] and xb <= slab[1]:
                lo = n if self.slab_range is None else self.slab_range[0]
                self.slab_range = (lo, n + g1 - g0)
            n += g1 - g0
        self.n = n
        self.cols = {c: t.from_numpy(np.ascontiguousarray(np.concatenate(pieces[c]))).to(dev) for c in COLS}
        self.gidx = t.from_numpy(np.concatenate(gidx)).to(dev)
        self.start, self.count = lstart, lcount
        self.sorted = False
        self.pair_evals, self.skin_violations = 0, 0
        self.moved = r.moved_true        # true drift bound since the last sort, this window's max |p|
        self.moved_step = 0.0            # the same summed over this global step
        self.nclamp = t.zeros(1, device=dev, dtype=t.int32)

    def _short_kick(self, thr, kclose, kopen, crit, lmax):
        r, t, c = self.r, self.t, self.cols
        act = t.nonzero(c["level"] >= thr).squeeze(1).to(t.int32) if thr else self.nclamp
        nact = len(act) if thr else self.n
        if nact:
            dev = r.ops.device
            kc = t.as_tensor(np.asarray(kclose, dtype=np.float32), device=dev)
            ko = t.as_tensor(np.asarray(kopen, dtype=np.float32), device=dev)
            self.nclamp.zero_()
            lean._kernel("p3m_kick")(((nact + 127) // 128,), (128,), c["x"], c["y"], c["z"], c["px"], c["py"], c["pz"],
                                     c["level"], act, int(bool(thr)), nact, self.start, self.count, r.nc, r.reach,
                                     float(r.cs), r.box, float(r.rcut ** 2), float(1 / (2 * r.rs)), float(r.eps ** 2),
                                     float(r.gm), kc, ko, int(thr), int(lmax), float(crit), self.nclamp)
        self.pair_evals += nact

    def _drift(self, d):
        t, c, box = self.t, self.cols, self.r.box
        vmax2 = 0.0
        for xk, pk in (("x", "px"), ("y", "py"), ("z", "pz")):
            lo, hi = t.aminmax(c[pk])
            vmax2 += max(abs(float(lo)), abs(float(hi))) ** 2
            c[xk].add_(c[pk], alpha=float(d))
            t.remainder(c[xk], box, out=c[xk])
            c[xk].masked_fill_(c[xk] >= box, 0.0)
        self.moved += float(d) * vmax2 ** 0.5
        self.moved_step += float(d) * vmax2 ** 0.5

    def _cid(self):
        t, nc, cs = self.t, self.r.nc, self.r.cs
        cid = None
        for k in ("x", "y", "z"):
            ci = (self.cols[k] / cs).floor_().to(t.int32).clamp_(0, nc - 1)
            cid = ci if cid is None else cid.mul_(nc).add_(ci)
        return cid

    def _sort(self):
        t = self.t
        cid = self._cid()
        key = cid.to(t.int64) * (2 ** 31) + self.gidx
        order = t.argsort(key)
        del key
        for c in COLS:
            self.cols[c] = self.cols[c].index_select(0, order)
        cid = cid.index_select(0, order)
        self.gidx = t.arange(self.n, device=cid.device, dtype=t.int64)
        count = t.bincount(cid, minlength=self.r.nc ** 3)
        self.start = (t.cumsum(count, 0) - count).to(t.int32).contiguous()
        self.count = count.to(t.int32).contiguous()
        self.sorted = True
        self.moved = 0.0

    def run(self, subs, flags, final_close=None):
        lmax = self.r.L
        for (thr, kclose, kopen, crit, d), sort_now in zip(subs, flags):
            if self.moved > self.r.skin:
                self.skin_violations += 1
            self._short_kick(thr, kclose, kopen, crit, lmax)
            self._drift(d)
            if sort_now:
                self._sort()
        if final_close is not None:
            self._short_kick(0, final_close, np.zeros(lmax + 1), 0.0, lmax)

    def interior(self):
        """Local index range of the particles whose cell is in the slab, and their counts per cell."""
        nc2 = self.r.nc ** 2
        c0, c1 = self.slab
        if not self.sorted:
            i0, i1 = self.slab_range
            return i0, i1, self.r.count[c0 * nc2:c1 * nc2]
        cnt = self.count[c0 * nc2:c1 * nc2]
        i0 = int(self.start[c0 * nc2])
        return i0, i0 + int(cnt.sum()), cnt.cpu().numpy().astype(np.int64)
