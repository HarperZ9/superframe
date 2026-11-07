# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The P3M mesh force without the whole mesh on the GPU: a 3-D real FFT done as 2-D FFTs over (y, z) per x
slab, then 1-D FFTs along x per block of y pencils, with the spectrum held in host memory between passes.

    force_slabs(delta_slab, ng, box, green_block, grad_block, slabs, pencils)

delta_slab(x0, x1) returns the density contrast of mesh planes x0..x1 on the GPU (the integer deposit
already works slab by slab). green_block(y0, y1) and grad_block(c, y0, y1) return the Green's function and
the gradient symbol on the rfft layout for pencils y0..y1 (all x, all kz), computed on the fly, so no
ng^3 array of either is stored. The generator yields (c, x0, x1, g) for each force component c and x slab:
the real force mesh of planes x0..x1, ready for a read-back of the particles above those planes.
Normalisation follows torch.fft (forward unscaled, inverse 1 / ng^3), split as 1 / ng^2 and 1 / ng.
Peak GPU memory is one slab or one pencil block of the complex spectrum; host memory one complex spectrum
(ng^2 (ng / 2 + 1) complex64: 4.3 GB at ng = 1024) plus one more for the inverse pass.
"""
import numpy as np


def force_slabs(ops, delta_slab, ng, green_block, grad_block, slabs=8, pencils=8, components=(0, 1, 2)):
    t = ops.torch
    dev = ops.device
    nz = ng // 2 + 1
    pin = t.cuda.is_available()
    spec = t.empty((ng, ng, nz), dtype=t.complex64, pin_memory=pin)
    xe = np.linspace(0, ng, slabs + 1).astype(int)
    ye = np.linspace(0, ng, pencils + 1).astype(int)
    for x0, x1 in zip(xe[:-1], xe[1:]):                       # forward, pass 1: (y, z) per x slab
        spec[x0:x1].copy_(t.fft.rfft2(delta_slab(x0, x1), dim=(1, 2)))
    for y0, y1 in zip(ye[:-1], ye[1:]):                       # forward, pass 2: x per pencil block, Green
        b = t.fft.fft(spec[:, y0:y1].to(dev), dim=0)
        b.mul_(green_block(y0, y1))
        spec[:, y0:y1].copy_(b)
        del b
    work = t.empty_like(spec)
    for c in components:
        for y0, y1 in zip(ye[:-1], ye[1:]):                   # inverse, pass 1: gradient symbol, x
            b = spec[:, y0:y1].to(dev) * (-1j * grad_block(c, y0, y1))
            work[:, y0:y1].copy_(t.fft.ifft(b, dim=0))
            del b
        for x0, x1 in zip(xe[:-1], xe[1:]):                   # inverse, pass 2: (y, z) per x slab
            g = t.fft.irfft2(work[x0:x1].to(dev), s=(ng, ng), dim=(1, 2))
            yield c, x0, x1, g.contiguous()
            del g


def blocks_for(engine):
    """green_block and grad_block for a mesh laid out like lean.CudaEngine's (same k grid and formulas)."""
    m, t = engine.mesh, engine.t
    kx, ky, kz = m._k

    def green_block(y0, y1):
        k2 = kx * kx + ky[:, y0:y1] * ky[:, y0:y1] + kz * kz
        g = -1.5 * m.cosmo.omega_m / (k2 + (k2 == 0)) * (k2 != 0)
        w = 1.0
        for kk in (kx, ky[:, y0:y1], kz):
            w = w * t.sinc(0.5 * kk * m.cell / np.pi) ** 2
        return (g / w ** 2 * t.exp(-k2 * m.split ** 2)).to(t.float32)

    def grad_block(c, y0, y1):
        g = m._grad_k(c)
        return g[:, y0:y1] if c == 1 else g

    return green_block, grad_block
