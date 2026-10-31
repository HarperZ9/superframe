# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Run a kernel module on a device, optionally split across CPU threads.

A kernel module provides prepare(inputs, ops) -> device inputs and
run(dinp, ops) -> {name: device array}. A module that is separable along an
axis declares SPLIT = {input_name: axis} and OUT_AXIS = {output_name: axis};
the CPU path then cuts those inputs into contiguous chunks, runs each chunk on
a thread (numpy releases the GIL inside its loops) and joins the outputs.
Each output element depends only on its own slice, so the split cannot change
any bit.
"""
from concurrent.futures import ThreadPoolExecutor

import numpy as np


def _chunks(n, k):
    edges = [round(i * n / k) for i in range(k + 1)]
    return [(edges[i], edges[i + 1]) for i in range(k) if edges[i + 1] > edges[i]]


def _slice(a, axis, lo, hi):
    idx = [slice(None)] * a.ndim
    idx[axis] = slice(lo, hi)
    return a[tuple(idx)]


def run_device(mod, inputs, ops):
    """Prepare, run and copy back. Returns {name: numpy array}."""
    split = getattr(mod, "SPLIT", None)
    if ops.name == "cpu" and ops.threads > 1 and split:
        return _run_threaded(mod, inputs, ops, split)
    out = mod.run(mod.prepare(inputs, ops), ops)
    ops.sync()
    return {k: ops.get(v) for k, v in out.items()}


def _run_threaded(mod, inputs, ops, split):
    name0, ax0 = next(iter(split.items()))
    parts = _chunks(inputs[name0].shape[ax0], ops.threads)

    def one(bounds):
        sub = dict(inputs)
        for name, ax in split.items():
            sub[name] = _slice(inputs[name], ax, *bounds)
        return mod.run(mod.prepare(sub, ops), ops)

    with ThreadPoolExecutor(len(parts)) as pool:
        outs = list(pool.map(one, parts))
    return {k: np.concatenate([o[k] for o in outs], mod.OUT_AXIS[k]) for k in outs[0]}


def bitwise_equal(a, b):
    a, b = np.asarray(a), np.asarray(b)
    return a.dtype == b.dtype and a.shape == b.shape and a.tobytes() == b.tobytes()


def max_ulp(a, b):
    """Largest distance in units in the last place between two float arrays."""
    a, b = np.asarray(a), np.asarray(b)
    it = {4: np.int32, 8: np.int64}[a.dtype.itemsize]
    lo = np.iinfo(it).min
    # sign-magnitude bits onto a monotone integer line: -0.0 and +0.0 both map to 0
    ia, ib = a.view(it), b.view(it)
    ia = np.where(ia < 0, lo - ia, ia).astype(np.float64)
    ib = np.where(ib < 0, lo - ib, ib).astype(np.float64)
    return int(np.max(np.abs(ia - ib))) if a.size else 0


def run_shared(mod, inputs, shares):
    """Split one call across devices: shares = [(ops, fraction), ...] along mod.SPLIT.
    This is the load-sharing primitive: any fraction gives the same bytes, so a scheduler
    can move work between CPU and GPU on each call without changing the result."""
    split = mod.SPLIT
    name0, ax0 = next(iter(split.items()))
    n = inputs[name0].shape[ax0]
    edges, acc = [0], 0.0
    for _, f in shares:
        acc += f
        edges.append(min(n, round(acc * n)))
    edges[-1] = n
    outs = []
    for (ops, _), lo, hi in zip(shares, edges[:-1], edges[1:]):
        if hi <= lo:
            continue
        sub = dict(inputs)
        for name, ax in split.items():
            sub[name] = _slice(inputs[name], ax, lo, hi)
        outs.append(run_device(mod, sub, ops))
    return {k: np.concatenate([o[k] for o in outs], mod.OUT_AXIS[k]) for k in outs[0]}
