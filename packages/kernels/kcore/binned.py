# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Order-independent float32 sums: binned integer accumulation.

Source: ReproBLAS (corpus entries ahrens2015-reproblas-tr, demmel2016-reproblas-tr; Ahrens, Nguyen
and Demmel). Each addend is split against fixed bin boundaries and each bin is summed exactly, so the
result does not depend on order or on how the input is partitioned; partial accumulators merge exactly.
ReproBLAS sets its bins from the data maximum and accumulates in floating point (K = 3 folds).

This version, built for a CPU and a GPU sharing one call:
  * Bins are absolute: bit position 16k above 2^-149, k = 0..17. An addend's digits depend on the
    addend alone, never on the maximum, so any partition of the input sees the same digits.
  * The bit pattern is decoded with integer operations: |x| = M * 2^s * 2^-149 with M < 2^24 and
    s < 254. M << (s mod 16) is cut into three 16-bit limbs, each added (with x's sign) to bins
    s div 16, +1, +2. A bin holds an exact integer below n * 2^16, so float64 adds of those
    integers are exact for n < 2^37 and their order cannot change a bit (bincount on CUDA uses
    atomics in arbitrary order; exactness makes that harmless).
  * Merge: add two accumulators element by element. Associative and commutative, exactly.
  * Finalise: carry-normalise in base 2^16 (integer ops), fold the sign, then add the 18 scaled
    digits from the top in float64 and round once to float32. Faithful by construction; measured
    against the exact rational sum in the S2 study.
Non-finite inputs give NaN. float32 only.
"""
import numpy as np

NB = 18
F64 = np.float64


def accumulate(x, ops):
    """x[..., n] float32 -> float64 accumulator [..., NB] of exact integer digit sums; a row with
    any non-finite entry carries NaN."""
    lead = tuple(x.shape[:-1])
    rows = 1
    for d in lead:
        rows *= d
    b = ops.bits(x.reshape(rows, x.shape[-1]))
    neg = b < 0
    mag = b & 0x7FFFFFFF
    e = mag >> 23
    m = mag & 0x7FFFFF
    norm = e > 0
    m = ops.where(norm, m | 0x800000, m)
    s = ops.where(norm, e - 1, e)
    k, o = s >> 4, s & 15
    v = m << o
    row = (ops.arange(rows, np.int64) * NB)[:, None]
    acc = ops.zeros((rows * NB,), F64)
    for j in range(3):
        limb = ops.to_float((v >> (16 * j)) & 0xFFFF, F64)
        w = ops.where(neg, -limb, limb)
        acc = acc + ops.bincount(row + k + j, w, rows * NB)
    bad = ops.to_float(e == 255, F64)
    nonfinite = _rowsum(bad, ops)
    acc = acc.reshape(rows, NB) + ops.where(nonfinite > 0, ops.scalar(float("nan"), F64),
                                             ops.scalar(0.0, F64))[:, None]
    return acc.reshape(lead + (NB,))


def _rowsum(a, ops):
    # count of non-finite entries per row via bincount on the row index (no library reduction)
    rows, n = a.shape
    idx = (ops.arange(rows, np.int64)[:, None] + ops.zeros((rows, n), np.int64))
    return ops.bincount(idx, a, rows)


def merge(a, b):
    return a + b


def finalize(acc, ops):
    """Accumulator [..., NB] -> float32 [...]."""
    lead = tuple(acc.shape[:-1])
    nan = acc != acc
    isnan = nan[..., 0]
    for j in range(1, NB):
        isnan = isnan | nan[..., j]
    d = ops.to_index(ops.where(nan, ops.scalar(0.0, F64), acc))
    d = [d[..., j] for j in range(NB)]
    d = _carry(d)
    neg = d[-1] < 0
    d = _carry([ops.where(neg, -x, x) for x in d])
    total = ops.zeros(lead, F64)
    for j in range(NB - 1, -1, -1):
        total = total + ops.to_float(d[j], F64) * ops.scalar(2.0 ** (16 * j - 149), F64)
    total = ops.where(neg, -total, total)
    total = ops.where(isnan, ops.scalar(float("nan"), F64), total)
    return ops.to_float(total, np.float32)


def _carry(d):
    out = list(d)
    for j in range(len(out) - 1):
        c = out[j] >> 16
        out[j] = out[j] - (c << 16)
        out[j + 1] = out[j + 1] + c
    return out


def binned_sum(x, ops):
    """Order-independent float32 sum over the last axis."""
    return finalize(accumulate(x, ops), ops)
