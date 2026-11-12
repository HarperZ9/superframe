"""CPU sphere tracer that writes a G-buffer the three style passes share.

One scene, three looks: every direction in design/art is a different treatment of the same
G-buffer (position, normal, material, character id, character-local position, light visibility,
ambient occlusion, and a reflection layer for wet ground). Runs at Idle priority on the CPU.
"""
import ctypes
import os
import sys
import time
import numpy as np
from multiprocessing import Pool

IDLE = 0x40


def set_idle():
    if os.name == 'nt':
        h = ctypes.windll.kernel32.GetCurrentProcess()
        ctypes.windll.kernel32.SetPriorityClass(h, IDLE)


def camera_rays(pos, target, fov_deg, w, h, y0=0, y1=None, ss=1, shift=(0.0, 0.0)):
    y1 = h if y1 is None else y1
    pos = np.asarray(pos, float)
    f = np.asarray(target, float) - pos
    f /= np.linalg.norm(f)
    r = np.cross(f, [0, 1, 0]); r /= np.linalg.norm(r)
    u = np.cross(r, f)
    th = np.tan(np.radians(fov_deg) / 2)
    aspect = w / h
    ys = (np.arange(y0 * ss, y1 * ss) + 0.5) / (h * ss)
    xs = (np.arange(w * ss) + 0.5) / (w * ss)
    X, Y = np.meshgrid(xs, ys)
    sx = (2 * X - 1) * th * aspect + shift[0]
    sy = (1 - 2 * Y) * th + shift[1]
    D = f[None, :] + sx.reshape(-1, 1) * r[None, :] + sy.reshape(-1, 1) * u[None, :]
    D /= np.linalg.norm(D, axis=1, keepdims=True)
    O = np.broadcast_to(pos, D.shape).copy()
    return O, D


def march(scene, O, D, tmax=80.0, eps_k=0.0006, steps=220, fac=0.9, t0=0.0):
    n = len(O)
    t = np.full(n, t0)
    hit = np.zeros(n, bool)
    mat = np.full(n, -1, np.int32)
    gid = np.full(n, -1, np.int32)
    act = np.arange(n)
    for i in range(steps):
        if len(act) == 0:
            break
        P = O[act] + D[act] * t[act, None]
        d, m, g = scene.eval(P)
        eps = np.clip(eps_k * t[act], 0.0002, 0.012)
        h = (d < eps) & (m >= 0)
        hi = act[h]
        hit[hi] = True
        mat[hi] = m[h]
        gid[hi] = g[h]
        t[act] += np.where(h, 0.0, np.maximum(d * fac, eps * 0.5))
        keep = (~h) & (t[act] < tmax)
        act = act[keep]
    # settle each hit onto the surface so shading terms do not band with the march tolerance
    hi = np.nonzero(hit)[0]
    for k in range(4):
        if len(hi) == 0:
            break
        d, m, g = scene.eval(O[hi] + D[hi] * t[hi, None])
        t[hi] += d * 0.9
    if len(hi):
        d, m, g = scene.eval(O[hi] + D[hi] * t[hi, None])
        ok = m >= 0
        mat[hi[ok]] = m[ok]
        gid[hi[ok]] = g[ok]
    return t, hit, mat, gid


def normals(scene, P, e=0.0008):
    k = np.array([[1, -1, -1], [-1, -1, 1], [-1, 1, -1], [1, 1, 1]], float)
    N = np.zeros_like(P)
    for kk in k:
        N += kk[None, :] * scene.dist(P + kk * e)[:, None]
    return N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)


def soft_shadow(scene, P, L, kk=10.0, tmax=None, steps=96):
    """L: light position (3,) or direction (3,) if tmax is None meaning directional."""
    n = len(P)
    if tmax is None:
        Ld = np.broadcast_to(np.asarray(L, float), P.shape)
        tm = np.full(n, 25.0)
    else:
        Ld = np.asarray(L, float)[None, :] - P
        tm = np.linalg.norm(Ld, axis=1)
        Ld = Ld / tm[:, None]
        tm = tm - 0.15
    res = np.ones(n)
    t = np.full(n, 0.05)
    ph = np.full(n, 1e10)
    act = np.arange(n)
    for i in range(steps):
        if len(act) == 0:
            break
        Q = P[act] + Ld[act] * t[act, None]
        d = scene.dist(Q)
        # closest approach between consecutive samples (improved soft shadows), and penumbra
        # only from true near-misses: bound proxies are >= 0.15 m and would draw rings
        # hard visibility: occluded once the ray touches geometry; softness comes from the
        # masked screen-space filter in the style passes, which cannot band
        hitocc = d < 0.0025 + 0.001 * t[act]
        res[act] = np.where(hitocc, 0.0, res[act])
        ph[act] = d
        t[act] += np.clip(d, 0.008, 0.25)
        keep = (res[act] > 0.01) & (t[act] < tm[act])
        act = act[keep]
    return res * res * (3 - 2 * res)


def ambient_occ(scene, P, N, n=5, step=0.025):
    occ = np.zeros(len(P))
    w = 1.0
    for i in range(1, n + 1):
        h = step * i
        d = scene.dist(P + N * h)
        occ += w * np.clip(h - d, 0, None)
        w *= 0.6
    return np.clip(1 - 7.0 * occ, 0, 1)


def shade_layer(scene, O, D, t, hit, mat, gid, lights, want_ao=True, ne=0.0008):
    n = len(O)
    out = dict(t=t.astype(np.float32), hit=hit, mat=mat.astype(np.int16), gid=gid.astype(np.int8))
    P = O + D * t[:, None]
    N = np.zeros_like(P)
    loc = np.zeros_like(P)
    hi = np.nonzero(hit)[0]
    nl = len(lights)
    S = np.ones((n, nl), np.float32)
    A = np.ones(n, np.float32)
    if len(hi):
        Ph = P[hi]
        Nh = normals(scene, Ph, ne)
        N[hi] = Nh
        Pn = Ph + Nh * 0.008
        for j, L in enumerate(lights):
            if not L.get('shadow', False):
                continue
            if L['type'] == 'dir':
                S[hi, j] = soft_shadow(scene, Pn, -np.asarray(L['dir'], float), L.get('k', 8.0), None)
            else:
                S[hi, j] = soft_shadow(scene, Pn, L['pos'], L.get('k', 12.0), 1.0)
        if want_ao:
            A[hi] = ambient_occ(scene, Pn, Nh)
        for g in scene.groups:
            sel = hi[gid[hi] == g.gid]
            if len(sel):
                loc[sel] = g.frame.to_local(P[sel])
        # environment-local coordinates: world
        sel = hi[gid[hi] < 0]
        loc[sel] = P[sel]
    out.update(P=P.astype(np.float32), N=N.astype(np.float32), loc=loc.astype(np.float32),
               S=S, A=A)
    return out


REFLECTIVE = None


def render_strip(args):
    (builder, cam, w, h, y0, y1, ss, opts) = args
    set_idle()
    import scene as scn
    S, lights = scn.build(builder)
    O, D = camera_rays(cam['pos'], cam['target'], cam['fov'], w, h, y0, y1, ss, cam.get('shift', (0.0, 0.0)))
    t, hit, mat, gid = march(S, O, D, tmax=opts.get('tmax', 80), eps_k=opts.get('eps_k', 0.0006),
                             steps=opts.get('steps', 220))
    L0 = shade_layer(S, O, D, t, hit, mat, gid, lights, ne=opts.get('ne', 0.0008))
    L0['D'] = D.astype(np.float32)
    # reflection layer for wet ground, puddles and water
    refl_mats = np.array(scn.REFLECT, np.int16)
    R = dict()
    sel = np.nonzero(hit & np.isin(mat, refl_mats))[0]
    if len(sel) and opts.get('reflect', True):
        Nn = L0['N'][sel].astype(float)
        jitter = opts.get('refl_rough', 0.0)
        Dd = D[sel] - 2 * (np.einsum('ij,ij->i', D[sel], Nn))[:, None] * Nn
        Oo = L0['P'][sel].astype(float) + Nn * 0.01
        tt, hh, mm, gg = march(S, Oo, Dd, tmax=40, eps_k=0.002, steps=120)
        Ls = shade_layer(S, Oo, Dd, tt, hh, mm, gg, lights, want_ao=False, ne=0.002)
        Ls['D'] = Dd.astype(np.float32)
        Ls['idx'] = sel
        R = Ls
    return y0, L0, R


def render(builder, cam, w, h, out_path, ss=1, opts=None, workers=16, strip=None):
    set_idle()
    opts = opts or {}
    strip = strip or max(4, h // (workers * 3))
    jobs = [(builder, cam, w, h, y, min(h, y + strip), ss, opts) for y in range(0, h, strip)]
    t0 = time.time()
    with Pool(workers, initializer=set_idle) as pool:
        res = pool.map(render_strip, jobs, chunksize=1)
    res.sort(key=lambda r: r[0])
    W = w * ss
    base = {}
    refl = {}
    offset = 0
    for y0, L0, R in res:
        for k, v in L0.items():
            base.setdefault(k, []).append(v)
        if R:
            for k, v in R.items():
                if k == 'idx':
                    v = v + offset
                refl.setdefault(k, []).append(v)
        offset += len(L0['t'])
    out = {k: np.concatenate(v) for k, v in base.items()}
    for k, v in refl.items():
        out['r_' + k] = np.concatenate(v)
    out['w'] = W
    out['h'] = h * ss
    out['cam_pos'] = np.asarray(cam['pos'], float)
    np.savez_compressed(out_path, **out)
    print(f'{out_path}: {W}x{h * ss} in {time.time() - t0:.1f}s', flush=True)
    return out


if __name__ == '__main__':
    import json
    builder = sys.argv[1]
    cam = json.loads(sys.argv[2])
    w, h = int(sys.argv[3]), int(sys.argv[4])
    out = sys.argv[5]
    ss = int(sys.argv[6]) if len(sys.argv) > 6 else 1
    opts = json.loads(sys.argv[7]) if len(sys.argv) > 7 else {}
    render(builder, cam, w, h, out, ss, opts)
