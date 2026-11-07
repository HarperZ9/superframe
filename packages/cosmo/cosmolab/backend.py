# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Array backends for the particle-mesh solver: numpy with scipy.fft on the CPU, torch on CUDA when present.

Both expose the same few operations, so pm.py has one body. The CPU backend caps FFT threads at 3.
"""
import numpy as np
from scipy import fft as sfft

CPU_WORKERS = 3


class NumpyOps:
    name = "numpy"

    def __init__(self, dtype=np.float64, workers=CPU_WORKERS):
        self.dtype = dtype
        self.workers = workers

    def asarray(self, x):
        return np.asarray(x, dtype=self.dtype)

    def to_numpy(self, x):
        return np.asarray(x)

    def floor_int(self, x):
        return np.floor(x).astype(np.int64)

    def scatter_add(self, size, idx, w):
        return np.bincount(idx, weights=w, minlength=size).astype(self.dtype)

    def rfftn(self, a):
        return sfft.rfftn(a, workers=self.workers)

    def irfftn(self, a, shape):
        return sfft.irfftn(a, s=shape, workers=self.workers)

    def kgrid(self, ng, box):
        """Wavenumbers (h/Mpc) for an rfftn mesh: kx, ky full, kz half."""
        k = 2 * np.pi * np.fft.fftfreq(ng, d=box / ng)
        kz = 2 * np.pi * np.fft.rfftfreq(ng, d=box / ng)
        return (k.reshape(-1, 1, 1).astype(self.dtype), k.reshape(1, -1, 1).astype(self.dtype),
                kz.reshape(1, 1, -1).astype(self.dtype))

    def sum(self, x, axis=None):
        return np.sum(x, axis=axis)

    def stack(self, xs, axis=-1):
        return np.stack(xs, axis=axis)

    def mod(self, x, m):
        return np.mod(x, m)

    def sync(self):
        pass


class TorchOps:
    """CUDA through torch; float32 by default to keep GPU memory modest."""

    def __init__(self, device="cuda", dtype=None):
        import torch
        self.torch = torch
        self.device = torch.device(device)
        self.dtype = dtype or torch.float32
        self.name = f"torch-{self.device.type}"

    def asarray(self, x):
        t = self.torch
        if isinstance(x, t.Tensor):
            return x.to(device=self.device, dtype=self.dtype)
        return t.as_tensor(np.asarray(x), device=self.device, dtype=self.dtype)

    def to_numpy(self, x):
        return x.detach().cpu().numpy()

    def floor_int(self, x):
        return self.torch.floor(x).to(self.torch.int64)

    def scatter_add(self, size, idx, w):
        out = self.torch.zeros(size, device=self.device, dtype=self.dtype)
        return out.index_add_(0, idx, w)

    def rfftn(self, a):
        return self.torch.fft.rfftn(a)

    def irfftn(self, a, shape):
        return self.torch.fft.irfftn(a, s=shape)

    def kgrid(self, ng, box):
        t = self.torch
        k = 2 * np.pi * t.fft.fftfreq(ng, d=box / ng, device=self.device, dtype=self.dtype)
        kz = 2 * np.pi * t.fft.rfftfreq(ng, d=box / ng, device=self.device, dtype=self.dtype)
        return k.reshape(-1, 1, 1), k.reshape(1, -1, 1), kz.reshape(1, 1, -1)

    def sum(self, x, axis=None):
        return x.sum() if axis is None else x.sum(dim=axis)

    def stack(self, xs, axis=-1):
        return self.torch.stack(xs, dim=axis)

    def mod(self, x, m):
        return self.torch.remainder(x, m)

    def sync(self):
        if self.device.type == "cuda":
            self.torch.cuda.synchronize()


def get_backend(name="auto", **kw):
    """'numpy', 'torch' (CUDA) or 'auto' (torch on CUDA if importable and a GPU answers, else numpy)."""
    if name == "numpy":
        return NumpyOps(**kw)
    if name in ("torch", "cuda", "auto"):
        try:
            import torch
            if torch.cuda.is_available():
                return TorchOps(**kw)
        except ImportError:
            pass
        if name != "auto":
            raise RuntimeError("torch with CUDA is not available")
    return NumpyOps(**kw)
