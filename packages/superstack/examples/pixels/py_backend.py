# SPDX-License-Identifier: MIT
"""Python backend: a float32 numpy port of raw-native 0.4.0's CPU path.

Same rasterizer (screen-space barycentrics at pixel centres, perspective-
correct position and normal), same stateless pixel hash, same cosine
hemisphere and Moller-Trumbore occlusion test, same Lambert-plus-ambient
shade and u8 encode. Written from src/raster.cpp, src/ray_ao.cpp,
src/composite.cpp and src/image.cpp at tag v0.4.0 (aaebfc7).

Usage: python py_backend.py scene.json OUTDIR
Writes frame.rgb (RGB8 rows top-down), ao.f32, mask.u8 and receipt.json.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))  # repo root: superstack.py
import superstack as ss  # noqa: E402
from scene_ir import F, cross, dot, load, normalize, triangles  # noqa: E402

VERSION = "0.1.0"


def look_at(eye, center, up):
    f = normalize(center - eye)
    s = normalize(cross(f, up))
    u = cross(s, f)
    m = np.eye(4, dtype=F)
    m[0, :3], m[0, 3] = s, -dot(s, eye)
    m[1, :3], m[1, 3] = u, -dot(u, eye)
    m[2, :3], m[2, 3] = -f, dot(f, eye)
    return m


def perspective(fovy, aspect, n=F(0.1), f=F(100.0)):
    t = F(1.0) / np.tan(F(fovy) * F(0.5), dtype=F)
    m = np.zeros((4, 4), dtype=F)
    m[0, 0], m[1, 1] = t / aspect, t
    m[2, 2], m[2, 3] = (f + n) / (n - f), (F(2) * f * n) / (n - f)
    m[3, 2] = F(-1)
    return m


def matmul(a, b):
    r = np.zeros((4, 4), dtype=F)
    for i in range(4):
        for j in range(4):
            s = F(0)
            for k in range(4):
                s = F(s + a[i, k] * b[k, j])
            r[i, j] = s
    return r


def mulv(m, v):
    return np.array([F(F(F(m[i, 0] * v[0] + m[i, 1] * v[1]) + m[i, 2] * v[2]) + m[i, 3] * v[3])
                     for i in range(4)], dtype=F)


def rasterize(scene, verts, norms, albedo):
    w, h = scene["frame"]["width"], scene["frame"]["height"]
    cam = scene["camera"]
    eye, tgt, up = (np.array(cam[k], dtype=F) for k in ("eye", "target", "up"))
    vp = matmul(perspective(F(cam["fovy"]), F(w) / F(h)), look_at(eye, tgt, up))
    depth = np.full((h, w), np.inf, dtype=F)
    pos = np.zeros((h, w, 3), dtype=F)
    nrm = np.zeros((h, w, 3), dtype=F)
    alb = np.zeros((h, w, 3), dtype=F)
    mask = np.zeros((h, w), dtype=np.uint8)
    for ti in range(len(verts)):
        cs = [mulv(vp, np.array([*verts[ti, k], 1], dtype=F)) for k in range(3)]
        if any(c[3] <= F(1e-6) for c in cs):
            continue
        invw = [F(F(1.0) / c[3]) for c in cs]
        sp = []
        for c, iw in zip(cs, invw):
            nx, ny = F(c[0] * iw), F(c[1] * iw)
            sp.append((F(F(nx * F(0.5) + F(0.5)) * F(w)),
                       F(F(F(1.0) - F(ny * F(0.5) + F(0.5))) * F(h)), c[3]))
        xs, ys = [p[0] for p in sp], [p[1] for p in sp]
        minx, maxx = max(0, int(np.floor(min(xs)))), min(w - 1, int(np.ceil(max(xs))))
        miny, maxy = max(0, int(np.floor(min(ys)))), min(h - 1, int(np.ceil(max(ys))))
        area = F(F((sp[1][0] - sp[0][0]) * (sp[2][1] - sp[0][1]))
                 - F((sp[1][1] - sp[0][1]) * (sp[2][0] - sp[0][0])))
        if abs(area) < F(1e-9) or minx > maxx or miny > maxy:
            continue
        gy, gx = np.mgrid[miny:maxy + 1, minx:maxx + 1]
        px, py = gx.astype(F) + F(0.5), gy.astype(F) + F(0.5)
        w0 = ((sp[1][0] - px) * (sp[2][1] - py) - (sp[1][1] - py) * (sp[2][0] - px)) / area
        w1 = ((sp[2][0] - px) * (sp[0][1] - py) - (sp[2][1] - py) * (sp[0][0] - px)) / area
        w0, w1 = w0.astype(F), w1.astype(F)
        w2 = (F(1.0) - w0 - w1).astype(F)
        inside = (w0 >= 0) & (w1 >= 0) & (w2 >= 0)
        iw = (w0 * invw[0] + w1 * invw[1] + w2 * invw[2]).astype(F)
        d = (w0 * sp[0][2] + w1 * sp[1][2] + w2 * sp[2][2]).astype(F)
        cur = depth[miny:maxy + 1, minx:maxx + 1]
        take = inside & (d < cur)

        def pc(a):
            return np.stack([((w0 * a[0][c] * invw[0] + w1 * a[1][c] * invw[1]
                               + w2 * a[2][c] * invw[2]) / iw).astype(F) for c in range(3)], -1)

        p = pc(verts[ti])
        n = normalize(pc(np.stack([norms[ti]] * 3)))
        sl = (slice(miny, maxy + 1), slice(minx, maxx + 1))
        depth[sl] = np.where(take, d, cur)
        pos[sl] = np.where(take[..., None], p, pos[sl])
        nrm[sl] = np.where(take[..., None], n, nrm[sl])
        alb[sl] = np.where(take[..., None], albedo[ti], alb[sl])
        mask[sl] = np.where(take, 1, mask[sl])
    return pos, nrm, alb, mask


def hash01(x, y, s):
    with np.errstate(over="ignore"):  # uint32 wraparound is the hash
        h = (x * np.uint32(374761393) + y * np.uint32(668265263) + s * np.uint32(2246822519)).astype(np.uint32)
        h = ((h ^ (h >> np.uint32(13))) * np.uint32(1274126177)).astype(np.uint32)
    h ^= h >> np.uint32(16)
    return ((h & np.uint32(0xFFFFFF)).astype(F) / F(16777216.0)).astype(F)


def occluded(o, d, verts, radius):
    hit = np.zeros(o.shape[0], dtype=bool)
    for tri in verts:
        a = tri[0]
        e1, e2 = (tri[1] - a).astype(F), (tri[2] - a).astype(F)
        p = cross(d, e2)
        det = dot(e1[None], p)
        ok = ~((det > F(-1e-7)) & (det < F(1e-7)))
        inv = (F(1.0) / np.where(ok, det, F(1))).astype(F)
        tv = (o - a).astype(F)
        u = (dot(tv, p) * inv).astype(F)
        ok &= (u >= 0) & (u <= 1)
        q = cross(tv, e1[None])
        v = (dot(d, q) * inv).astype(F)
        ok &= (v >= 0) & ((u + v).astype(F) <= 1)
        t = (dot(e2[None], q) * inv).astype(F)
        hit |= ok & (t > F(1e-4)) & (t < F(radius))
    return hit


def rtao(pos, nrm, mask, verts, samples, radius, offset):
    ys, xs = np.nonzero(mask)
    p, n = pos[ys, xs], nrm[ys, xs]
    a = np.where((np.abs(n[:, 0]) > F(0.9))[:, None], np.array([0, 1, 0], F), np.array([1, 0, 0], F)).astype(F)
    t = normalize(cross(a, n))
    b = cross(n, t)
    origin = (p + n * F(offset)).astype(F)
    xu, yu = xs.astype(np.uint32), ys.astype(np.uint32)
    open_count = np.zeros(len(xs), dtype=np.int32)
    for s in range(samples):
        u1 = hash01(xu, yu, np.uint32(2 * s))
        u2 = hash01(xu, yu, np.uint32(2 * s + 1))
        r = np.sqrt(u1).astype(F)
        phi = (F(6.2831853) * u2).astype(F)
        lx, ly = (r * np.cos(phi)).astype(F), (r * np.sin(phi)).astype(F)
        lz = np.sqrt(np.maximum(F(0), F(1) - u1)).astype(F)
        d = normalize(((t * lx[:, None] + b * ly[:, None]) + n * lz[:, None]).astype(F))
        open_count += ~occluded(origin, d, verts, radius)
    ao = np.ones(mask.shape, dtype=F)
    ao[ys, xs] = (open_count.astype(F) / F(samples)).astype(F)
    return ao


def shade(scene, nrm, alb, ao, mask):
    light = scene["lights"][0]
    ldir = normalize(np.array(light["dir"], dtype=F))
    ndl = (np.maximum(F(0), dot(nrm, (ldir * F(-1.0)).astype(F)[None, None])) * F(light["intensity"])).astype(F)
    lit = ((F(scene["shade"]["ambient"]) + ndl) * ao).astype(F)
    rgb = np.clip((alb * lit[..., None]).astype(F), 0, 1).astype(F)
    rgb[mask == 0] = 0
    return (rgb * F(255.0) + F(0.5)).astype(np.uint8)


def render(scene):
    verts, norms, albedo = triangles(scene)
    pos, nrm, alb, mask = rasterize(scene, verts, norms, albedo)
    aoc = scene["ao"]
    ao = rtao(pos, nrm, mask, verts, aoc["samples"], aoc["radius"], aoc["origin_offset"])
    return shade(scene, nrm, alb, ao, mask), ao, mask


def main(scene_path, outdir):
    scene = load(scene_path)
    out = Path(outdir)
    out.mkdir(parents=True, exist_ok=True)
    frame, ao, mask = render(scene)
    files = {"frame.rgb": frame.tobytes(), "ao.f32": ao.astype("<f4").tobytes(), "mask.u8": mask.tobytes()}
    for name, data in files.items():
        (out / name).write_bytes(data)
    rec = ss.make_receipt(
        producer="superstack-example-py", version=VERSION, backend="python-numpy-f32",
        scene=scene, media={"kind": "image", "width": frame.shape[1], "height": frame.shape[0], "format": "rgb8",
                            "transfer": "srgb-u8"},
        content=files["frame.rgb"], outputs={k: ss.sha256_hex(v) for k, v in files.items()},
        does_not_prove=["A port of the reference shares its algorithm, so agreement is not independent evidence.",
                        "numpy float32 cos and sin may differ from the C runtime by one ulp."])
    (out / "receipt.json").write_text(ss.canonical(rec), encoding="utf-8")
    print(rec["content_sha256"])


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
