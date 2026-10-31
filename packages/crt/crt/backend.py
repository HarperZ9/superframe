# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One array interface over numpy (CPU) and torch (CUDA, float64) for the beam scatter.

The scatter writes each line's spot into rows that never repeat within one add, so the CUDA
index_add has no colliding atomics and its result does not depend on thread order. The CPU and
GPU paths agree to a tolerance (exp and log differ by an ulp or so between libms), not bitwise.
"""
import numpy as np


class Numpy:
    name = "cpu-numpy"

    def put(self, a):
        return np.ascontiguousarray(a, dtype=np.float64)

    def get(self, a):
        return np.asarray(a)

    def zeros(self, shape):
        return np.zeros(shape, dtype=np.float64)

    def ints(self, a):
        return np.asarray(a, dtype=np.int64)

    exp = staticmethod(np.exp)
    log1p = staticmethod(np.log1p)
    abs = staticmethod(np.abs)
    sign = staticmethod(np.sign)
    where = staticmethod(np.where)

    def maximum(self, a, s):
        return np.maximum(a, s)

    def add_rows(self, acc, rows, c0, contrib):
        acc[rows, c0:c0 + contrib.shape[1]] += contrib

    def sum(self, a):
        return float(np.sum(a))


class Torch:
    name = "cuda-torch"

    def __init__(self):
        import torch
        self.t = torch
        self.dev = torch.device("cuda")

    def put(self, a):
        return self.t.as_tensor(np.ascontiguousarray(a, dtype=np.float64), device=self.dev)

    def get(self, a):
        return a.detach().cpu().numpy()

    def zeros(self, shape):
        return self.t.zeros(shape, dtype=self.t.float64, device=self.dev)

    def ints(self, a):
        return self.t.as_tensor(np.asarray(a, dtype=np.int64), device=self.dev)

    def exp(self, a):
        return self.t.exp(a)

    def log1p(self, a):
        return self.t.log1p(a)

    def abs(self, a):
        return self.t.abs(a)

    def sign(self, a):
        return self.t.sign(a)

    def where(self, c, a, b):
        return self.t.where(c, a, b)

    def maximum(self, a, s):
        return self.t.clamp(a, min=s)

    def add_rows(self, acc, rows, c0, contrib):
        acc[:, c0:c0 + contrib.shape[1]].index_add_(0, rows, contrib)

    def sum(self, a):
        return float(a.sum().item())

    def sync(self):
        self.t.cuda.synchronize()


def make(name):
    return Torch() if name in ("cuda", "gpu", "torch") else Numpy()
