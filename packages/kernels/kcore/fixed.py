# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Fixed-order summation, the reduction every bit-identical kernel uses.

Kernel: fixed_sum(x) over the last axis. The axis is padded with +0.0 to the
next power of two P, then halved log2(P) times: x <- x[..., :h] + x[..., h:].
Every addition is one correctly rounded IEEE add in an order fixed by the
shape alone, so numpy and CUDA produce the same bits. Adding +0.0 is exact for
every finite value except -0.0, which becomes +0.0 (a sign of zero, not a
value). The order is a balanced tree, so its error bound is
O(log2 P) ulp times the sum of magnitudes, better than a left fold.
"""
import numpy as np


def _pow2(n):
    p = 1
    while p < n:
        p *= 2
    return p


def fixed_sum(x, ops, dtype):
    n = x.shape[-1]
    p = _pow2(n)
    if p != n:
        x = ops.cat([x, ops.zeros(tuple(x.shape[:-1]) + (p - n,), dtype)], -1)
    while p > 1:
        h = p // 2
        x = x[..., :h] + x[..., h:]
        p = h
    return x[..., 0]


def fixed_sum_reference(values, dtype):
    """The same tree written as scalar loops over a Python list."""
    t = np.dtype(dtype).type
    v = [t(a) for a in values]
    p = _pow2(len(v))
    v += [t(0.0)] * (p - len(v))
    while p > 1:
        h = p // 2
        v = [t(v[i] + v[i + h]) for i in range(h)]
        p = h
    return v[0]
