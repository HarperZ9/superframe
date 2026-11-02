# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Lattice resample: sample a square-pixel image on a hex or square lattice, then
reconstruct the pixel grid from those samples. Mode: bit-identical. See SPEC.md.
Lattice bases match tools/packing/lattice.py (SQUARE = I, HEX = [[1, 1/2], [0, sqrt3/2]])."""
import math

import numpy as np

NAME = "lattice_resample"
VERSION = "0.1.0"
MODE = "bit-identical"
TOLERANCE = None
F32, F64 = np.float32, np.float64
BASES = {"square": np.eye(2), "hex": np.array([[1.0, 0.5], [0.0, math.sqrt(3) / 2]])}


def geometry(h, w, kind, spacing, origin=(0.25, 0.125)):
    """Host-side: scaled basis sB, its inverse, and the coefficient range covering the image."""
    sB = spacing * BASES[kind]
    inv = np.linalg.inv(sB)
    corners = np.array([[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]], float) - origin
    ab = corners @ inv.T
    a0, b0 = np.floor(ab.min(0)).astype(int) - 1
    a1, b1 = np.ceil(ab.max(0)).astype(int) + 2
    g = np.array([origin[0], origin[1], *sB.ravel(), *inv.ravel(), a0, b0], dtype=F64)
    return g, (int(b1 - b0), int(a1 - a0))


def make_inputs(rng, size):
    c, h, w = size["C"], size["H"], size["W"]
    yy, xx = np.mgrid[0:h, 0:w] / max(h, w)
    base = np.sin(9 * xx + 4 * yy) * np.cos(5 * yy)  # host only: a smooth test image
    img = np.stack([base + 0.05 * rng.standard_normal((h, w)) for _ in range(c)]).astype(F32)
    return dict(lattice_inputs(img, size.get("kind", "hex"), size.get("spacing", 1.5)))


def lattice_inputs(img, kind, spacing):
    g, (nb, na) = geometry(img.shape[1], img.shape[2], kind, spacing)
    return {"img": img, "geo": g, "shape": np.array([nb, na, 1 if kind == "hex" else 0], dtype=np.int64)}


def prepare(inp, ops):
    return {k: ops.put(v) for k, v in inp.items()}


def _bilinear(img, x, y, ops):
    """Clamp-to-edge bilinear read of img[C, H, W] at float64 pixel coords (x, y)."""
    _, h, w = img.shape
    z = ops.scalar(0.0, F64)
    x = ops.minimum(ops.maximum(x, z), ops.scalar(float(w - 1), F64))
    y = ops.minimum(ops.maximum(y, z), ops.scalar(float(h - 1), F64))
    i0 = ops.minimum(ops.to_index(x), ops.scalar(w - 2, np.int64))
    j0 = ops.minimum(ops.to_index(y), ops.scalar(h - 2, np.int64))
    tx = ops.to_float(x - ops.to_float(i0, F64), F32)
    ty = ops.to_float(y - ops.to_float(j0, F64), F32)
    one = ops.scalar(1.0, F32)
    return ((img[:, j0, i0] * (one - tx) + img[:, j0, i0 + 1] * tx) * (one - ty)
            + (img[:, j0 + 1, i0] * (one - tx) + img[:, j0 + 1, i0 + 1] * tx) * ty)


def run(d, ops):
    img, g = d["img"], d["geo"]
    nb, na, hexa = [int(v) for v in ops.get(d["shape"])]
    _, h, w = img.shape
    ox, oy, s00, s01, s10, s11, i00, i01, i10, i11, a0, b0 = [g[k] for k in range(12)]
    a = (ops.arange(na, F64) + a0)[None, :] + ops.zeros((nb, na), F64)
    b = (ops.arange(nb, F64) + b0)[:, None] + ops.zeros((nb, na), F64)
    samples = _bilinear(img, ox + (s00 * a + s01 * b), oy + (s10 * a + s11 * b), ops)
    x = ops.arange(w, F64)[None, :] + ops.zeros((h, w), F64)
    y = ops.arange(h, F64)[:, None] + ops.zeros((h, w), F64)
    al = (i00 * (x - ox) + i01 * (y - oy)) - a0
    be = (i10 * (x - ox) + i11 * (y - oy)) - b0
    z, one = ops.scalar(0.0, F64), ops.scalar(1.0, F64)
    ia = ops.minimum(ops.maximum(ops.floor(al), z), ops.scalar(float(na - 2), F64))
    ib = ops.minimum(ops.maximum(ops.floor(be), z), ops.scalar(float(nb - 2), F64))
    fa = ops.minimum(ops.maximum(al - ia, z), one)
    fb = ops.minimum(ops.maximum(be - ib, z), one)
    ka, kb = ops.to_index(ia), ops.to_index(ib)
    s00v, s10v = samples[:, kb, ka], samples[:, kb, ka + 1]
    s01v, s11v = samples[:, kb + 1, ka], samples[:, kb + 1, ka + 1]
    if hexa:  # barycentric on the two triangles of the 60-degree cell
        low = (fa + fb) <= one
        w0 = ops.to_float(ops.where(low, (one - fa) - fb, (fa + fb) - one), F32)
        wa = ops.to_float(ops.where(low, fa, one - fb), F32)
        wb = ops.to_float(ops.where(low, fb, one - fa), F32)
        p0 = ops.where(low, s00v, s11v)
        recon = (p0 * w0 + s10v * wa) + s01v * wb
    else:  # bilinear on the square cell
        fa32, fb32, o32 = ops.to_float(fa, F32), ops.to_float(fb, F32), ops.scalar(1.0, F32)
        recon = ((s00v * (o32 - fa32) + s10v * fa32) * (o32 - fb32)
                 + (s01v * (o32 - fa32) + s11v * fa32) * fb32)
    return {"samples": samples, "recon": recon}


def _bil_ref(img, c, x, y):
    _, h, w = img.shape
    x, y = min(max(x, 0.0), float(w - 1)), min(max(y, 0.0), float(h - 1))
    i0, j0 = min(int(x), w - 2), min(int(y), h - 2)
    tx, ty = F32(x - i0), F32(y - j0)
    o = F32(1.0)
    return F32(F32(F32(img[c, j0, i0] * (o - tx)) + F32(img[c, j0, i0 + 1] * tx)) * (o - ty)
               + F32(F32(img[c, j0 + 1, i0] * (o - tx)) + F32(img[c, j0 + 1, i0 + 1] * tx)) * ty)


def reference(inp):
    img, g = inp["img"], [float(v) for v in inp["geo"]]
    nb, na, hexa = [int(v) for v in inp["shape"]]
    ox, oy, s00, s01, s10, s11, i00, i01, i10, i11, a0, b0 = g
    nc, h, w = img.shape
    S = np.zeros((nc, nb, na), F32)
    for c in range(nc):
        for jb in range(nb):
            for ja in range(na):
                a, b = ja + a0, jb + b0
                S[c, jb, ja] = _bil_ref(img, c, ox + (s00 * a + s01 * b), oy + (s10 * a + s11 * b))
    R = np.zeros((nc, h, w), F32)
    for c in range(nc):
        for y in range(h):
            for x in range(w):
                al = (i00 * (x - ox) + i01 * (y - oy)) - a0
                be = (i10 * (x - ox) + i11 * (y - oy)) - b0
                ia = min(max(float(math.floor(al)), 0.0), float(na - 2))
                ib = min(max(float(math.floor(be)), 0.0), float(nb - 2))
                fa, fb = min(max(al - ia, 0.0), 1.0), min(max(be - ib, 0.0), 1.0)
                ka, kb = int(ia), int(ib)
                q00, q10, q01, q11 = S[c, kb, ka], S[c, kb, ka + 1], S[c, kb + 1, ka], S[c, kb + 1, ka + 1]
                if hexa:
                    if fa + fb <= 1.0:
                        p0, w0, wa, wb = q00, F32((1.0 - fa) - fb), F32(fa), F32(fb)
                    else:
                        p0, w0, wa, wb = q11, F32((fa + fb) - 1.0), F32(1.0 - fb), F32(1.0 - fa)
                    R[c, y, x] = F32(F32(p0 * w0) + F32(q10 * wa)) + F32(q01 * wb)
                else:
                    o, A, B = F32(1.0), F32(fa), F32(fb)
                    R[c, y, x] = (F32(F32(q00 * (o - A)) + F32(q10 * A)) * (o - B)
                                  + F32(F32(q01 * (o - A)) + F32(q11 * A)) * B)
    return {"samples": S, "recon": R}


def work(inp):
    c, h, w = inp["img"].shape
    nb, na, _ = inp["shape"]
    ns = int(nb * na)
    bytes_ = c * ns * (4 * 4 + 4) + c * h * w * (4 * 4 + 4) + c * h * w * 4
    flops = ns * (8 + 12) + c * ns * 11 + h * w * 20 + c * h * w * 6
    return bytes_, flops


def results(inp):
    return int(np.prod(inp["img"].shape))


def open_reference(d, ops):
    """Built-in bilinear warp to the lattice positions (grid_sample / map_coordinates).
    Covers the sampling half only; there is no built-in hex reconstruction."""
    img, g = d["img"], d["geo"]
    nb, na, _ = [int(v) for v in ops.get(d["shape"])]
    gv = [float(v) for v in ops.get(g)]
    ox, oy, s00, s01, s10, s11 = gv[:6]
    a0, b0 = gv[10], gv[11]
    c, h, w = img.shape
    if ops.name == "cuda":
        import torch
        import torch.nn.functional as Fn
        b, a = torch.meshgrid(torch.arange(nb, device=img.device, dtype=torch.float32) + b0,
                              torch.arange(na, device=img.device, dtype=torch.float32) + a0, indexing="ij")
        px, py = ox + s00 * a + s01 * b, oy + s10 * a + s11 * b
        grid = torch.stack([px / (w - 1) * 2 - 1, py / (h - 1) * 2 - 1], -1)[None]
        return {"samples": Fn.grid_sample(img[None], grid, mode="bilinear", padding_mode="border",
                                          align_corners=True)[0]}
    from scipy import ndimage
    b, a = np.mgrid[0:nb, 0:na].astype(F64)
    a, b = a + a0, b + b0
    px, py = ox + s00 * a + s01 * b, oy + s10 * a + s11 * b
    return {"samples": np.stack([ndimage.map_coordinates(img[k], [py, px], order=1, mode="nearest")
                                 for k in range(c)])}


def open_results(inp):
    c = inp["img"].shape[0]
    return int(c * inp["shape"][0] * inp["shape"][1])


TEST_SIZE = {"C": 2, "H": 14, "W": 18, "kind": "hex", "spacing": 1.5}
TEST_SIZES = [TEST_SIZE, {"C": 1, "H": 10, "W": 12, "kind": "square", "spacing": 1.25}]
CHECK_SIZE = {"C": 2, "H": 256, "W": 256, "kind": "hex", "spacing": 1.5}
SMOKE_SIZES = [{"C": 2, "H": 256, "W": 256}, {"C": 2, "H": 2048, "W": 2048}]
