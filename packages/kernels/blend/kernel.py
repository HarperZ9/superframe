# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Weighted N-source blend with gain and detune. Mode: bit-identical. See SPEC.md."""
import math

import numpy as np

NAME = "blend"
VERSION = "0.1.0"
MODE = "bit-identical"
TOLERANCE = None
SPLIT = {"t": 0}
OUT_AXIS = {"y": 1}
F32, F64 = np.float32, np.float64


def detune_ratios(cents):
    """Host-side, in Python float64: ratio_n = 2 ** (cents_n / 1200). Computed once, so
    no device ever evaluates a transcendental; the ratios are hashed as an input."""
    return np.array([2.0 ** (c / 1200.0) for c in cents], dtype=F64)


def spread(n, detune_cents):
    """Symmetric detune spread: source i sits at detune * (i - (n - 1) / 2) cents."""
    return [detune_cents * (i - (n - 1) / 2) for i in range(n)]


def make_inputs(rng, size):
    n, c, length, t = size["N"], size["C"], size["L"], size["T"]
    return {
        "x": rng.standard_normal((n, c, length)).astype(F32),
        "w": rng.uniform(0, 1, (n, c)).astype(F32),
        "ratio": detune_ratios(spread(n, size.get("detune", 7.0))),
        "gain": np.array(size.get("gain", 0.5), dtype=F32),
        "t": np.arange(t, dtype=F64),
    }


def prepare(inp, ops):
    return {k: ops.put(v) for k, v in inp.items()}


def run(d, ops):
    x, w, ratio, gain, t = d["x"], d["w"], d["ratio"], d["gain"], d["t"]
    n, c, length = x.shape
    L = ops.scalar(float(length), F64)
    one = ops.scalar(1.0, F32)
    acc = ops.zeros((c, t.shape[0]), F32)
    for i in range(n):  # fixed source order 0..N-1: the only reduction in the kernel
        p = t * ratio[i]
        fp = p - L * ops.floor(p / L)
        fp = ops.where(fp >= L, ops.scalar(0.0, F64), fp)
        i0 = ops.to_index(fp)
        fr = ops.to_float(fp - ops.to_float(i0, F64), F32)
        i1 = (i0 + 1) % length
        s = x[i][:, i0] * (one - fr) + x[i][:, i1] * fr
        acc = acc + w[i][:, None] * s
    return {"y": gain * acc}


def reference(inp):
    """Scalar loops in the order the spec states. Slow on purpose."""
    x, w, ratio, gain, t = inp["x"], inp["w"], inp["ratio"], inp["gain"], inp["t"]
    n, c, length = x.shape
    y = np.zeros((c, t.shape[0]), dtype=F32)
    for ch in range(c):
        for j in range(t.shape[0]):
            acc = F32(0.0)
            for i in range(n):
                p = F64(t[j]) * F64(ratio[i])
                fp = p - F64(length) * F64(math.floor(p / F64(length)))
                if fp >= length:
                    fp = F64(0.0)
                i0 = int(fp)
                fr = F32(fp - F64(i0))
                i1 = (i0 + 1) % length
                s = F32(F32(x[i, ch, i0] * F32(F32(1.0) - fr)) + F32(x[i, ch, i1] * fr))
                acc = F32(acc + F32(w[i, ch] * s))
            y[ch, j] = F32(gain) * acc
    return {"y": y}


def work(inp):
    """(bytes moved, flops) per call, by the analytic model in SPEC.md."""
    n, c, _ = inp["x"].shape
    t = inp["t"].shape[0]
    bytes_ = n * c * t * 2 * 4 + t * 8 + n * c * 4 + c * t * 4
    flops = n * t * 8 + n * c * t * 5 + c * t
    return bytes_, flops


def results(inp):
    return inp["x"].shape[1] * inp["t"].shape[0]


def open_reference(d, ops):
    """Best open built-in for the reduction alone (no detune read): einsum over sources.
    Different summation order, so compared by tolerance only."""
    x, w = d["x"], d["w"]
    if ops.name == "cuda":
        import torch
        return {"y": d["gain"] * torch.einsum("nc,ncl->cl", w, x)}
    return {"y": d["gain"] * np.einsum("nc,ncl->cl", w, x, optimize=True)}


def open_results(inp):
    return inp["x"].shape[1] * inp["x"].shape[2]


TEST_SIZE ={"N": 4, "C": 2, "L": 64, "T": 160}
CHECK_SIZE = {"N": 8, "C": 2, "L": 4096, "T": 48000}
SMOKE_SIZES = [{"N": 8, "C": 2, "L": 4096, "T": 4096}, {"N": 8, "C": 2, "L": 4096, "T": 262144}]
