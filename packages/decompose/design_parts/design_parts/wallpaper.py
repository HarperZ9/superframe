# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""The 17 wallpaper groups: a generator from each group's operations, and a classifier.

Generator. A random lattice-periodic field f (a short Fourier series on the reciprocal lattice) is
symmetrised over a set of coset representatives (R, t) of the group modulo its lattice:
F(x) = sum_k f(R_k x + t_k). The result has the group's symmetry and, for a generic f, no more.
Conventions (x right, y down, lattice vector a = (1, 0)):
  oblique a=(1,0), b=(0.3,0.9); rectangular b=(0,0.7); square b=(0,1); hexagonal b=(1/2, sqrt3/2).
  Centred groups (cm, cmm) use the rectangular cell plus the centring translation (a+b)/2.
  p3m1 adds the mirror perpendicular to a, so every 3-fold centre lies on a mirror; p31m adds the
  mirror along a.

Classifier (after Liu, Collins and Tsin 2004, rebuilt here): the lattice comes from autocorrelation
peaks; each candidate rotation or reflection about the image centre is matched to the image by
normalised cross-correlation over shifts. A reflection whose best matches shift along its own axis by
0 (mod the lattice period on that axis) is a mirror; by half the period it is a glide. A decision
tree on rotation order, mirror and glide axes names the group.
"""
import numpy as np
from scipy import ndimage as ndi
from scipy.signal import fftconvolve

S3 = np.sqrt(3) / 2
LAT = {"obl": ((1, 0), (0.3, 0.9)), "rect": ((1, 0), (0, 0.7)), "sq": ((1, 0), (0, 1)), "hex": ((1, 0), (0.5, S3))}
GROUPS = ["p1", "p2", "pm", "pg", "cm", "pmm", "pmg", "pgg", "cmm", "p4", "p4m", "p4g", "p3", "p3m1", "p31m", "p6", "p6m"]


def _cross(a, b):
    return float(a[0] * b[1] - a[1] * b[0])


def _rot(deg):
    r = np.deg2rad(deg)
    return np.array([[np.cos(r), -np.sin(r)], [np.sin(r), np.cos(r)]])


I2, MX, MY = np.eye(2), np.diag([-1.0, 1.0]), np.diag([1.0, -1.0])


def group_ops(name):
    """(lattice key, list of (R, t)) with t in Cartesian cell units."""
    a, b = (np.array(v, float) for v in LAT["rect"])
    half_a, half_ab, cen = a / 2, (a + b) / 2, (a + b) / 2
    z = np.zeros(2)
    rots = lambda n: [(_rot(360 * k / n), z) for k in range(n)]  # noqa: E731
    times = lambda A, B: [(R2 @ R1, R2 @ t1 + t2) for R1, t1 in A for R2, t2 in B]  # noqa: E731
    centring = [(I2, z), (I2, cen)]
    table = {
        "p1": ("obl", [(I2, z)]), "p2": ("obl", rots(2)),
        "pm": ("rect", [(I2, z), (MX, z)]), "pg": ("rect", [(I2, z), (MX, b / 2)]),
        "cm": ("rect", times([(I2, z), (MX, z)], centring)),
        "pmm": ("rect", rots(2) + [(MX, z), (MY, z)]),
        "pmg": ("rect", rots(2) + [(MX, half_a), (MY, half_a)]),
        "pgg": ("rect", rots(2) + [(MX, half_ab), (MY, half_ab)]),
        "cmm": ("rect", times(rots(2) + [(MX, z), (MY, z)], centring)),
        "p4": ("sq", rots(4)), "p4m": ("sq", times(rots(4), [(I2, z), (MX, z)])),
        "p4g": ("sq", times(rots(4), [(I2, z), (MX, np.array([0.5, 0.5]))])),
        "p3": ("hex", rots(3)), "p3m1": ("hex", times(rots(3), [(I2, z), (MX, z)])),
        "p31m": ("hex", times(rots(3), [(I2, z), (MY, z)])),
        "p6": ("hex", rots(6)), "p6m": ("hex", times(rots(6), [(I2, z), (MX, z)])),
    }
    return table[name]


def periodic_field(name, width, height, cell=40, seed=0, nmax=7, gmax=6.0, angle=0.0, origin=(0.0, 0.0)):
    """Raw symmetrised field (not normalised) of group `name`; lattice origin at pixel `origin`."""
    lat, ops = group_ops(name)
    A = np.array(LAT[lat], float).T  # columns a, b
    Bstar = np.linalg.inv(A).T        # reciprocal basis (columns), a . a* = 1
    rng = np.random.default_rng(seed)
    y, x = np.mgrid[:height, :width].astype(float)
    P = (np.stack([x.ravel(), y.ravel()]) - np.array(origin, float)[:, None]) / cell
    P = _rot(angle) @ P
    terms = [(m, n) for m in range(-nmax, nmax + 1) for n in range(-nmax, nmax + 1) if (m, n) != (0, 0)]
    G = np.array([Bstar @ np.array(k, float) for k in terms])
    keep = (G * G).sum(1) <= gmax ** 2
    c = (rng.normal(size=len(terms)) + 1j * rng.normal(size=len(terms)))[keep]
    G = G[keep]
    F = np.zeros(P.shape[1])
    for R, t in ops:
        Q = R @ P + np.asarray(t, float)[:, None]
        F += (c @ np.exp(2j * np.pi * (G @ Q))).real
    return F.reshape(height, width)


def render_group(name, size=256, cell=40, seed=0, nmax=7, gmax=6.0, angle=0.0):
    """Greyscale (size x size) pattern with wallpaper group `name`; cell = |a| in pixels."""
    F = periodic_field(name, size, size, cell, seed, nmax, gmax, angle, origin=(size / 2, size / 2))
    F = np.tanh(1.5 * (F - F.mean()) / (F.std() + 1e-12))  # crisp motif; odd map keeps the symmetry
    return (F - F.min()) / (np.ptp(F) + 1e-12)


def ncc_map(img, tmpl):
    t = tmpl - tmpl.mean()
    num = fftconvolve(img, t[::-1, ::-1], mode="valid")
    ones = np.ones_like(t)
    s1 = fftconvolve(img, ones, mode="valid")
    s2 = fftconvolve(img * img, ones, mode="valid")
    var = np.maximum(s2 - s1 * s1 / t.size, 1e-12)
    return num / np.sqrt(var * (t * t).sum())


def lattice(L, min_r=4, rel=0.85):
    """Lattice from peaks of the normalised cross-correlation of the central half with the image.
    Candidates are local maxima within rel of the best non-zero shift; the shortest and the shortest
    non-collinear one are Gauss-reduced. Strength is the smaller NCC of the two basis shifts."""
    h, w = L.shape
    m = ncc_map(L, L[h // 4:h // 4 + h // 2, w // 4:w // 4 + w // 2])
    cy, cx = h // 4, w // 4
    Y, X = np.indices(m.shape)
    r = np.hypot(Y - cy, X - cx)
    pk = (m == ndi.maximum_filter(m, 5)) & (r >= min_r)
    if not pk.any():
        return None
    top = m[pk].max()
    ys, xs = np.nonzero(pk & (m >= rel * top))
    if len(ys) < 2:
        return None
    vec = np.stack([xs - cx, ys - cy], 1).astype(float)
    o = np.argsort(np.hypot(*vec.T))
    va = vec[o[0]]
    for j in o[1:]:
        vb = vec[j]
        if abs(_cross(va, vb)) / (np.linalg.norm(va) * np.linalg.norm(vb)) > 0.3:
            break
    else:
        return None
    for _ in range(10):  # Gauss reduction
        if np.linalg.norm(vb) < np.linalg.norm(va):
            va, vb = vb, va
        k = np.round(va @ vb / (va @ va))
        if k == 0:
            break
        vb = vb - k * va

    def at(v):
        y, x = int(round(cy + v[1])), int(round(cx + v[0]))
        return float(m[y, x]) if 0 <= y < m.shape[0] and 0 <= x < m.shape[1] else float(top)
    strength = min(at(va), at(vb))
    # sub-pixel refinement: least squares over every strong peak, indexed in the integer basis
    allp = np.stack([xs - cx, ys - cy], 1).astype(float)
    sub = np.array([_subpix(m, y, x) for y, x in zip(ys, xs)]) - [cx, cy]
    B = np.stack([va, vb], 1)
    ij = np.round(np.linalg.solve(B, allp.T)).T
    good = np.abs(ij @ B.T - allp).max(1) < 2.5
    if good.sum() >= 3 and np.linalg.matrix_rank(ij[good]) == 2:
        sol = np.linalg.lstsq(ij[good], sub[good], rcond=None)[0]
        va, vb = sol[0], sol[1]
    return va, vb, strength


def _subpix(m, y, x):
    def off(a, b, c):
        d = a - 2 * b + c
        return 0.0 if d >= 0 else 0.5 * (a - c) / d
    dy = off(m[y - 1, x], m[y, x], m[y + 1, x]) if 0 < y < m.shape[0] - 1 else 0.0
    dx = off(m[y, x - 1], m[y, x], m[y, x + 1]) if 0 < x < m.shape[1] - 1 else 0.0
    return x + dx, y + dy


def _transform(L, M):
    """T(x) = L(M^-1 (x - c) + c) about the centre; M acts on (x, y)."""
    P = np.array([[0, 1], [1, 0]])
    Mi = P @ np.linalg.inv(M) @ P  # (row, col) form
    c = (np.array(L.shape) - 1) / 2
    return ndi.affine_transform(L, Mi, offset=c - Mi @ c, order=1, mode="reflect")


def _matches(L, M, rel=0.8):
    h, w = L.shape
    T = _transform(L, M)
    t = T[h // 4:h // 4 + h // 2, w // 4:w // 4 + w // 2]
    m = ncc_map(L, t)
    pk = (m == ndi.maximum_filter(m, 5)) & (m > rel * m.max())
    ys, xs = np.nonzero(pk)
    d = np.stack([xs - w // 4, ys - h // 4], 1).astype(float)
    return float(m.max()), d, m[ys, xs]


def _period_along(u, va, vb):
    best = None
    for i in range(-4, 5):
        for j in range(-4, 5):
            v = i * va + j * vb
            n = np.linalg.norm(v)
            if n > 1e-6 and abs(_cross(u, v / n)) < 0.02:
                best = n if best is None else min(best, n)
    return best


def classify(L, thr=0.94):
    """Returns {'group', 'periodic', 'strength', 'rot', 'mirror_dirs', 'glide_dirs', 'scores'}."""
    L = np.asarray(L, float)
    lat = lattice(L)
    if lat is None:
        return {"group": None, "periodic": False, "strength": 0.0}
    va, vb, strength = lat
    ref_val = strength
    scores = {n: _matches(L, _rot(360 / n))[0] for n in (2, 3, 4, 6)}
    ok = {n: s >= thr * ref_val for n, s in scores.items()}
    rot = 6 if ok[6] and ok[2] and ok[3] else 4 if ok[4] and ok[2] else 3 if ok[3] else 2 if ok[2] else 1
    dirs = []
    for v in (va, vb, va + vb, va - vb, 2 * va + vb, va + 2 * vb, 2 * va - vb, va - 2 * vb):
        for u in (v, np.array([-v[1], v[0]])):
            th = np.arctan2(u[1], u[0]) % np.pi
            if all(abs(np.angle(np.exp(2j * (th - d)))) > np.deg2rad(4) for d in dirs):
                dirs.append(th)
    mirror_dirs, glide_dirs = [], []
    for th in dirs:
        u = np.array([np.cos(th), np.sin(th)])
        M = np.array([[np.cos(2 * th), np.sin(2 * th)], [np.sin(2 * th), -np.cos(2 * th)]])
        s, d, vals = _matches(L, M)
        if s < thr * ref_val:
            continue
        P = _period_along(u, va, vb)
        if P is None:
            continue
        keep = vals >= thr * ref_val
        g = np.mod(d[keep] @ u, P) / P
        if np.any((g < 0.15) | (g > 0.85)):
            mirror_dirs.append(float(th))
        if np.any(np.abs(g - 0.5) < 0.15):
            glide_dirs.append(float(th))
    group = _decide(rot, mirror_dirs, glide_dirs, va, vb)
    return {"group": group, "periodic": strength > 0.4, "strength": strength, "rot": rot,
            "mirror_dirs": mirror_dirs, "glide_dirs": glide_dirs, "lattice": [va.tolist(), vb.tolist()],
            "scores": {**{f"rot{n}": s for n, s in scores.items()}, "ref": ref_val}}


def _same(th, dirs, tol=4):
    return any(abs(np.angle(np.exp(2j * (th - d)))) < np.deg2rad(tol) for d in dirs)


def _decide(rot, mir, gl, va, vb):
    has_m, has_g = bool(mir), bool(gl)
    both = any(_same(t, gl) for t in mir)
    short = [np.arctan2(v[1], v[0]) % np.pi for v in (va, vb, vb - va, va + vb)]
    if rot == 1:
        return ("cm" if both else "pm") if has_m else ("pg" if has_g else "p1")
    if rot == 2:
        if has_m:
            return ("cmm" if both else "pmm") if len(mir) >= 2 else "pmg"
        return "pgg" if has_g else "p2"
    if rot == 4:
        axis = [np.arctan2(v[1], v[0]) % np.pi for v in (va, vb)]
        if any(_same(t, axis) for t in mir):
            return "p4m"
        return "p4g" if (has_m or has_g) else "p4"
    if rot == 3:
        if not has_m:
            return "p3"
        lens = [np.linalg.norm(v) for v in (va, vb, vb - va, va + vb)]
        m = min(lens)
        par = [s for s, n in zip(short, lens) if n < 1.05 * m]
        return "p31m" if any(_same(t, par) for t in mir) else "p3m1"
    return "p6m" if has_m else "p6"
