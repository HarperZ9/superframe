# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Semi-Lagrangian advection then explicit diffusion on a periodic 2-D grid.
Mode: bit-identical. Formulas follow slAdvect, sampC and diffuse in the brackish
simulator (2026-10-29-brackish-marbling/sim.html). See SPEC.md for differences."""
import math

import numpy as np

NAME = "advect_diffuse"
VERSION = "0.1.0"
MODE = "bit-identical"
TOLERANCE = None
F64 = np.float64


def substeps(kappa, dt, dx):
    """Host-side, as diffuse(): n = ceil(num / 0.2), a = num / n, capped at 200."""
    num = kappa * dt / (dx * dx)
    if not num > 0:
        return 0, 0.0
    n = math.ceil(num / 0.2)
    a = num / n
    if n > 200:
        n, a = 200, min(num / 200, 0.24)
    return n, a


def make_inputs(rng, size):
    ny, nx = size["ny"], size["nx"]
    dx = 1.0 / nx
    y, x = np.mgrid[0:ny, 0:nx] * dx
    psi = np.sin(2 * np.pi * x) * np.sin(2 * np.pi * y)  # host only: builds a test field
    u = (2 * np.pi * np.sin(2 * np.pi * x) * np.cos(2 * np.pi * y)).astype(F64)
    v = (-2 * np.pi * np.cos(2 * np.pi * x) * np.sin(2 * np.pi * y)).astype(F64)
    q = (psi + 0.1 * rng.standard_normal((ny, nx))).astype(F64)
    dt = 0.5 * dx / (2 * np.pi)
    n, a = substeps(size.get("kappa", 2e-4), dt, dx)
    return {"q": q, "u": u, "v": v,
            "par": np.array([dx, dt, 0.5 * dt, a, float(n)], dtype=F64)}


def prepare(inp, ops):
    return {k: ops.put(v) for k, v in inp.items()}


def _samp(q, x, z, h, ops):
    """Cell-centred bilinear sample with periodic wrap on both axes (sampC)."""
    m, n = q.shape
    N, M = ops.scalar(float(n), F64), ops.scalar(float(m), F64)
    half, one, zero = ops.scalar(0.5, F64), ops.scalar(1.0, F64), ops.scalar(0.0, F64)
    fx = x / h - half
    fz = z / h - half
    fx = fx - N * ops.floor(fx / N)
    fz = fz - M * ops.floor(fz / M)
    fx = ops.where(fx >= N, zero, fx)
    fz = ops.where(fz >= M, zero, fz)
    i0, j0 = ops.to_index(fx), ops.to_index(fz)
    tx, tz = fx - ops.to_float(i0, F64), fz - ops.to_float(j0, F64)
    i1, j1 = (i0 + 1) % n, (j0 + 1) % m
    return ((q[j0, i0] * (one - tx) + q[j0, i1] * tx) * (one - tz)
            + (q[j1, i0] * (one - tx) + q[j1, i1] * tx) * tz)


def run(d, ops):
    q, u, v, par = d["q"], d["u"], d["v"], d["par"]
    ny, nx = q.shape
    h, dt, hdt, a = par[0], par[1], par[2], par[3]
    nsub = int(ops.get(par[4]))
    half = ops.scalar(0.5, F64)
    x = ((ops.arange(nx, F64) + half) * h)[None, :] + ops.zeros((ny, nx), F64)
    z = ((ops.arange(ny, F64) + half) * h)[:, None] + ops.zeros((ny, nx), F64)
    vx, vz = _samp(u, x, z, h, ops), _samp(v, x, z, h, ops)
    xm, zm = x - hdt * vx, z - hdt * vz
    xb, zb = x - dt * _samp(u, xm, zm, h, ops), z - dt * _samp(v, xm, zm, h, ops)
    q = _samp(q, xb, zb, h, ops)
    for _ in range(nsub):
        qc = q
        sm = ops.roll(q, 1, 1) - qc          # left neighbour  (b&1)
        sm = sm + (ops.roll(q, -1, 1) - qc)  # right neighbour (b&2)
        sm = sm + (ops.roll(q, 1, 0) - qc)   # row below       (b&4)
        sm = sm + (ops.roll(q, -1, 0) - qc)  # row above       (b&8)
        q = qc + a * sm
    return {"q": q}


def _samp_ref(q, x, z, h):
    m, n = q.shape
    fx, fz = x / h - 0.5, z / h - 0.5
    fx -= n * math.floor(fx / n)
    fz -= m * math.floor(fz / m)
    if fx >= n:
        fx = 0.0
    if fz >= m:
        fz = 0.0
    i0, j0 = int(fx), int(fz)
    tx, tz = fx - i0, fz - j0
    i1, j1 = (i0 + 1) % n, (j0 + 1) % m
    return ((q[j0, i0] * (1 - tx) + q[j0, i1] * tx) * (1 - tz)
            + (q[j1, i0] * (1 - tx) + q[j1, i1] * tx) * tz)


def reference(inp):
    """Per-cell loops in Python floats (IEEE binary64, the same as F64)."""
    q, u, v = inp["q"].tolist(), inp["u"].tolist(), inp["v"].tolist()
    q, u, v = np.array(q, dtype=object), np.array(u, dtype=object), np.array(v, dtype=object)
    h, dt, hdt, a, nsub = [float(p) for p in inp["par"]]
    ny, nx = q.shape
    out = np.empty((ny, nx), dtype=object)
    for j in range(ny):
        for i in range(nx):
            x, z = (i + 0.5) * h, (j + 0.5) * h
            vx, vz = _samp_ref(u, x, z, h), _samp_ref(v, x, z, h)
            xm, zm = x - hdt * vx, z - hdt * vz
            out[j, i] = _samp_ref(q, x - dt * _samp_ref(u, xm, zm, h), z - dt * _samp_ref(v, xm, zm, h), h)
    q = out
    for _ in range(int(nsub)):
        tmp = np.empty((ny, nx), dtype=object)
        for j in range(ny):
            for i in range(nx):
                qc = q[j, i]
                sm = 0.0
                sm += q[j, (i - 1) % nx] - qc
                sm += q[j, (i + 1) % nx] - qc
                sm += q[(j - 1) % ny, i] - qc
                sm += q[(j + 1) % ny, i] - qc
                tmp[j, i] = qc + a * sm
        q = tmp
    return {"q": q.astype(F64)}


def work(inp):
    ny, nx = inp["q"].shape
    nsub = int(inp["par"][4])
    cells = ny * nx
    bytes_ = cells * 8 * (3 + 1) + nsub * cells * 8 * 2
    flops = cells * (5 * 22 + 8) + nsub * cells * 10
    return bytes_, flops


def results(inp):
    return inp["q"].size


def open_reference(d, ops):
    """Built-in bilinear warp plus a convolution Laplacian: grid_sample and conv2d on
    CUDA, map_coordinates and convolve on CPU. Different order, tolerance only."""
    q, u, v, par = d["q"], d["u"], d["v"], d["par"]
    ny, nx = q.shape
    if ops.name == "cuda":
        import torch
        import torch.nn.functional as Fn
        h, dt = float(par[0]), float(par[1])
        yy, xx = torch.meshgrid(torch.arange(ny, device=q.device, dtype=q.dtype),
                                torch.arange(nx, device=q.device, dtype=q.dtype), indexing="ij")
        gx = (xx - dt * u / h) / (nx - 1) * 2 - 1
        gy = (yy - dt * v / h) / (ny - 1) * 2 - 1
        g = torch.stack([gx, gy], -1)[None]
        qa = Fn.grid_sample(q[None, None], g, mode="bilinear", padding_mode="reflection", align_corners=True)
        k = torch.tensor([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype=q.dtype, device=q.device)[None, None]
        qa = qa + float(par[3]) * Fn.conv2d(Fn.pad(qa, (1, 1, 1, 1), mode="circular"), k)
        return {"q": qa[0, 0]}
    from scipy import ndimage
    h, dt = par[0], par[1]
    yy, xx = np.mgrid[0:ny, 0:nx].astype(F64)
    qa = ndimage.map_coordinates(q, [yy - dt * v / h, xx - dt * u / h], order=1, mode="grid-wrap")
    return {"q": qa + par[3] * ndimage.laplace(qa, mode="wrap")}


def open_results(inp):
    return inp["q"].size


TEST_SIZE = {"ny": 12, "nx": 16, "kappa": 2e-3}
CHECK_SIZE = {"ny": 256, "nx": 256, "kappa": 2e-4}
SMOKE_SIZES = [{"ny": 128, "nx": 128}, {"ny": 1024, "nx": 1024}]
