# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The mesh kick of ooc.SlabRunner through the sliced FFT (slicedfft.force_slabs), so no ng^3 array of the
density, the Green's function or a force component sits on the GPU.

    deposit  each x slab of mesh planes is summed from the particles whose chaining cells can reach it (the
             store is sorted by chaining cell, x most significant, so they are a few index ranges)
    kick     force_slabs yields one component's force planes x0..x1; the particles whose lower CIC plane
             lies in x0 - 1 .. x1 - 2 are kicked with the previous slab's last plane prepended
             (lean_kernels.cic_kick_slab), and the planes ng - 1 and 0 close the wrap at the end
The deposit is integer and the kick kernel is cic_kick with a plane offset, so an in-core engine built with
fft="sliced" and the same slab and pencil counts gets the same bits.
"""
import math

from . import lean, slicedfft
from .backend import FIXED_BITS


def particle_ranges(runner, lo, hi):
    """Store index ranges holding every particle with lo <= x < hi (Mpc/h, may run past 0 or the box),
    from the chaining-cell counts of the last sort and the drift bound since it."""
    nc, cs = runner.nc, runner.cs
    mv = runner.moved_true
    ca = int(math.floor((lo - mv) / cs)) - 1
    cb = int(math.floor((hi + mv) / cs)) + 1
    if cb - ca + 1 >= nc:
        cells = [(0, nc)]
    else:
        a, b = ca % nc, cb % nc
        cells = [(a, b + 1)] if a <= b else [(a, nc), (0, b + 1)]
    start = runner.start_index()
    nc2 = nc * nc
    return [(int(start[a * nc2]), int(start[b * nc2])) for a, b in cells]


def _chunks(runner, ranges):
    for g0, g1 in ranges:
        for i0 in range(g0, g1, runner.chunk):
            yield i0, min(g1, i0 + runner.chunk)


def delta_slab(runner, x0, x1, shift=0.0):
    """Density contrast of mesh planes x0..x1 (GPU), the numbers of lean.deposit."""
    t, ng, cm = runner.t, runner.ng, runner.box / runner.ng
    q = float(2 ** FIXED_BITS)
    acc = t.zeros((x1 - x0) * ng * ng, device=runner.ops.device, dtype=t.int64)
    k = lean._kernel("cic_deposit_slab")
    for i0, i1 in _chunks(runner, particle_ranges(runner, (x0 - 1 - shift) * cm, (x1 + 1) * cm)):
        xyz = [runner._up(c, i0, i1) for c in ("x", "y", "z")]
        k((((i1 - i0) + 255) // 256,), (256,), *xyz, i1 - i0, ng, float(cm), q, int(x0), int(x1 - x0),
          float(shift), acc)
    out = (acc.to(t.float64) * (ng ** 3 / (q * runner.np_)) - 1.0).to(t.float32).view(x1 - x0, ng, ng)
    del acc
    return out


def sliced_long_kick(runner, k, slabs=8, pencils=8):
    if not k:
        return
    t, ng, cm = runner.t, runner.ng, runner.box / runner.ng
    gb, db = slicedfft.blocks_for(runner)
    kick = lean._kernel("cic_kick_slab")
    col = ("px", "py", "pz")

    def apply(c, buf, xlo, ixa, ixb):
        if ixb <= ixa:
            return
        buf = buf.contiguous()
        for i0, i1 in _chunks(runner, particle_ranges(runner, ixa * cm, ixb * cm)):
            xyz = [runner._up(cc, i0, i1) for cc in ("x", "y", "z")]
            pc = runner._up(col[c], i0, i1)
            kick((((i1 - i0) + 255) // 256,), (256,), *xyz, i1 - i0, ng, float(cm), buf, int(xlo), int(ixa),
                 int(ixb), float(k), pc)
            runner.store[col[c]][i0:i1] = pc.cpu().numpy()

    first = prev = None
    for c, x0, x1, g in slicedfft.force_slabs(runner.ops, lambda a, b: delta_slab(runner, a, b), ng, gb, db,
                                              slabs, pencils):
        if x0 == 0:
            first = g[:1].clone()
            apply(c, g, 0, 0, x1 - 1)
        else:
            apply(c, t.cat([prev, g]), x0 - 1, x0 - 1, x1 - 1)
        prev = g[-1:].clone()
        if x1 == ng:                                    # lower plane ng - 1: planes ng - 1 and 0
            apply(c, t.cat([prev, first]), ng - 1, ng - 1, ng)
        del g

