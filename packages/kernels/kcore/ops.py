# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One array interface over numpy (CPU) and torch (CUDA).

A kernel body is written once against these methods, so both devices execute
the same sequence of IEEE operations in the same order. Only operations that
IEEE 754 rounds correctly are exposed for bit-identical kernels: + - * /,
sqrt, floor, min, max, compare, select, gather and integer arithmetic. No
transcendental function is offered, because CUDA libm and the host libm round
those differently. Eager torch launches one kernel per operation, so no
multiply-add is fused (torch.compile and fast-math builds would break this).
"""
import numpy as np

try:
    import torch
except ImportError:  # CPU-only environments still run the reference and CPU paths
    torch = None


class NumpyOps:
    name = "cpu"

    def __init__(self, threads=1):
        self.threads = threads

    def put(self, a):
        return np.ascontiguousarray(a)

    def get(self, a):
        return np.asarray(a)

    def scalar(self, v, dtype):
        return np.dtype(dtype).type(v)

    def arange(self, n, dtype):
        return np.arange(n, dtype=dtype)

    def floor(self, a):
        return np.floor(a)

    def sqrt(self, a):
        return np.sqrt(a)

    def where(self, c, a, b):
        return np.where(c, a, b)

    def minimum(self, a, b):
        return np.minimum(a, b)

    def maximum(self, a, b):
        return np.maximum(a, b)

    def to_index(self, a):
        return a.astype(np.int64)

    def to_float(self, a, dtype):
        return a.astype(dtype)

    def roll(self, a, shift, axis):
        return np.roll(a, shift, axis)

    def zeros(self, shape, dtype):
        return np.zeros(shape, dtype=dtype)

    def cat(self, xs, axis):
        return np.concatenate(xs, axis)

    def stack(self, xs, axis):
        return np.stack(xs, axis)

    def bits(self, a):
        """Float bit pattern as int64 (float32 through int32, so the sign extends)."""
        return a.view(np.int32 if a.dtype == np.float32 else np.int64).astype(np.int64)

    def bincount(self, idx, w, n):
        return np.bincount(idx.ravel(), w.ravel(), minlength=n)

    def sync(self):
        pass


_TORCH_DT = {}


def _tdt(dtype):
    if not _TORCH_DT:
        _TORCH_DT.update({np.dtype(np.float32): torch.float32, np.dtype(np.float64): torch.float64,
                          np.dtype(np.int64): torch.int64})
    return _TORCH_DT[np.dtype(dtype)]


class TorchOps:
    name = "cuda"

    def __init__(self, device="cuda"):
        if torch is None or not torch.cuda.is_available():
            raise RuntimeError("TorchOps needs torch with CUDA")
        self.dev = torch.device(device)
        self.threads = 1

    def put(self, a):
        return torch.from_numpy(np.ascontiguousarray(a)).to(self.dev)

    def get(self, a):
        return a.detach().cpu().numpy()

    def scalar(self, v, dtype):
        return torch.tensor(v, dtype=_tdt(dtype), device=self.dev)

    def arange(self, n, dtype):
        return torch.arange(n, dtype=_tdt(dtype), device=self.dev)

    def floor(self, a):
        return torch.floor(a)

    def sqrt(self, a):
        return torch.sqrt(a)

    def where(self, c, a, b):
        return torch.where(c, a, b)

    def minimum(self, a, b):
        return torch.minimum(a, b)

    def maximum(self, a, b):
        return torch.maximum(a, b)

    def to_index(self, a):
        return a.to(torch.int64)

    def to_float(self, a, dtype):
        return a.to(_tdt(dtype))

    def roll(self, a, shift, axis):
        return torch.roll(a, shift, axis)

    def zeros(self, shape, dtype):
        return torch.zeros(shape, dtype=_tdt(dtype), device=self.dev)

    def cat(self, xs, axis):
        return torch.cat(xs, axis)

    def stack(self, xs, axis):
        return torch.stack(xs, axis)

    def bits(self, a):
        return a.view(torch.int32 if a.dtype == torch.float32 else torch.int64).to(torch.int64)

    def bincount(self, idx, w, n):
        return torch.bincount(idx.flatten(), w.flatten(), minlength=n)

    def sync(self):
        torch.cuda.synchronize(self.dev)


def cuda_available():
    return torch is not None and torch.cuda.is_available()


def device_ops(name, threads=1):
    if name == "cpu":
        return NumpyOps(threads)
    if name == "cuda":
        return TorchOps()
    raise KeyError(name)


def device_label(ops):
    if ops.name == "cuda":
        return f"cuda:{torch.cuda.get_device_name(0)}"
    return f"cpu:numpy-{np.__version__}:threads={ops.threads}"
