# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""spectral_shade as one fused CUDA kernel, bit-identical to the eager kernel.

Method from FlashAttention (corpus dao2022-flashattention): count the bytes each version moves and keep
intermediates on chip. Eager torch writes every [P, 81] temporary to DRAM; here one thread owns one
pixel, computes R for each wavelength in registers and feeds three running sums. The fixed power-of-two
tree of kcore.fixed (pad 81 to 128, halve) is kept exactly: leaves are visited in bit-reversed order and
combined by a binary-counter stack, which performs the same additions on the same operands as halving.
Reads 8 bytes and writes 12 bytes per pixel (plus 81 x 7 floats of spectra held in cache). Compiled with
kcore.nvrtc.STRICT: no fused multiply-add, IEEE division and square root, denormals kept.
"""
import ctypes

import numpy as np

from kcore.fixed import fixed_sum
from kcore.ops import NumpyOps

SRC = r"""
extern "C" __global__ void spectral_fused(const float* __restrict__ wmix, const float* __restrict__ cosi,
    const float* __restrict__ nA, const float* __restrict__ kA, const float* __restrict__ nB,
    const float* __restrict__ kB, const float* __restrict__ light, const float* __restrict__ cmf,
    float* __restrict__ xyz, int P, float norm, float n_out)
{
    int p = blockIdx.x * blockDim.x + threadIdx.x;
    if (p >= P) return;
    const float zero = 0.0f, one = 1.0f, half = 0.5f, two = 2.0f;
    float w = fminf(fmaxf(wmix[p], zero), one);
    float c = fminf(fmaxf(cosi[p], zero), one);
    float omw = one - w;
    float s2 = one - c * c;
    float st0[8], st1[8], st2[8];
    int sp = 0;
    #pragma unroll
    for (int q = 0; q < 128; ++q) {
        int j = __brev(q) >> 25;
        float x0 = 0.0f, x1 = 0.0f, x2 = 0.0f;
        if (j < 81) {
            float n = nA[j] * omw + nB[j] * w;
            float k = kA[j] * omw + kB[j] * w;
            float er = n / n_out, ei = k / n_out;
            float e2r = er * er - ei * ei, e2i = (er * ei) * two;
            float ar = e2r - s2, ai = e2i;
            float r = sqrtf(ar * ar + ai * ai);
            float wr = sqrtf((r + ar) * half);
            float wi = sqrtf(fmaxf((r - ar) * half, zero));
            wi = (ai < zero) ? -wi : wi;
            float rs = ((c - wr) * (c - wr) + wi * wi) / ((c + wr) * (c + wr) + wi * wi);
            float pr = e2r * c, pi = e2i * c;
            float rp = ((pr - wr) * (pr - wr) + (pi - wi) * (pi - wi))
                     / ((pr + wr) * (pr + wr) + (pi + wi) * (pi + wi));
            float R = half * (rs + rp);
            float RS = R * light[j];
            x0 = RS * cmf[3 * j]; x1 = RS * cmf[3 * j + 1]; x2 = RS * cmf[3 * j + 2];
        }
        st0[sp] = x0; st1[sp] = x1; st2[sp] = x2; ++sp;
        for (int k = q; k & 1; k >>= 1) {
            --sp;
            st0[sp - 1] = st0[sp - 1] + st0[sp];
            st1[sp - 1] = st1[sp - 1] + st1[sp];
            st2[sp - 1] = st2[sp - 1] + st2[sp];
        }
    }
    xyz[3 * p] = st0[0] / norm; xyz[3 * p + 1] = st1[0] / norm; xyz[3 * p + 2] = st2[0] / norm;
}
"""
_K = None


def kernel():
    global _K
    if _K is None:
        from kcore.nvrtc import Kernel
        _K = Kernel(SRC, "spectral_fused")
    return _K


def host_norm(inp):
    """fixed_sum(light * cmf[:, 1]) on the host: the same fp32 tree the eager kernel runs on device."""
    return np.float32(fixed_sum(inp["light"] * inp["cmf"][:, 1], NumpyOps(), np.float32))


def run(d, ops, norm):
    """d: TorchOps-prepared inputs (contiguous float32 CUDA tensors). Returns {"xyz": [P, 3]}."""
    import torch
    P = d["wmix"].shape[0]
    out = torch.empty((P, 3), dtype=torch.float32, device=d["wmix"].device)
    ptr = lambda t: ctypes.c_void_p(t.contiguous().data_ptr())  # noqa: E731
    args = [ptr(d[k]) for k in ("wmix", "cosi", "nA", "kA", "nB", "kB", "light", "cmf")]
    args += [ptr(out), ctypes.c_int(P), ctypes.c_float(float(norm)), ctypes.c_float(float(d["n_out"].item()))]
    kernel().launch((P + 127) // 128, 128, args, torch.cuda.current_stream().cuda_stream)
    return {"xyz": out}


def as_module():
    """A module-shaped view of the fused kernel, so kcore.stress and kcore.check can judge it."""
    import types
    import spectral_shade.kernel as S
    m = types.SimpleNamespace(**{k: getattr(S, k) for k in dir(S) if not k.startswith("__")})
    m.__name__ = "spectral_shade.fused"

    def prepare(inp, ops):
        d = S.prepare(inp, ops)
        d["_norm"] = host_norm(inp)
        return d

    def run_any(d, ops):
        if ops.name != "cuda":
            return S.run(d, ops)
        return run(d, ops, d["_norm"])
    m.prepare, m.run = prepare, run_any
    return m
