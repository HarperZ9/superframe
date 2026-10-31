# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Polygons as motifs: area, tilings that reach density 1, and the densest translative (lattice)
packing of a convex polygon by Minkowski's critical determinant.

For convex K, a lattice packs translates of K exactly when it is admissible for D = K - K (no
nonzero lattice point inside D). The densest lattice packing has density |K| / Delta(D), and for a
centrally symmetric convex D in the plane a critical lattice has a basis p, q with p, q and q - p
on the boundary of D (Minkowski; Reinhardt 1934, Mahler 1947). For a centrally symmetric K the
densest translative packing is a lattice packing (Fejes Toth 1950, Rogers 1951), and for any convex
K in the plane translative and lattice optima agree (Fejes Toth; Rogers), so this gives both.
"""
import math
import sys

import numpy as np
from scipy.optimize import minimize_scalar

sys.dont_write_bytecode = True


def area(P):
    P = np.asarray(P, float)
    x, y = P[:, 0], P[:, 1]
    return 0.5 * abs(float(np.dot(x, np.roll(y, -1)) - np.dot(y, np.roll(x, -1))))


def regular(n, R=1.0, phase=None):
    phase = math.pi / 2 if phase is None else phase
    t = phase + 2 * math.pi * np.arange(n) / n
    return np.column_stack([R * np.cos(t), R * np.sin(t)])


def convex_hull(P):
    P = sorted(map(tuple, np.round(np.asarray(P, float), 12)))
    if len(P) < 3:
        return np.array(P)

    def cross(o, a, b):
        return (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
    lo, hi = [], []
    for p in P:
        while len(lo) >= 2 and cross(lo[-2], lo[-1], p) <= 1e-12:
            lo.pop()
        lo.append(p)
    for p in reversed(P):
        while len(hi) >= 2 and cross(hi[-2], hi[-1], p) <= 1e-12:
            hi.pop()
        hi.append(p)
    return np.array(lo[:-1] + hi[:-1])


def difference_body(K):
    K = np.asarray(K, float)
    return convex_hull((K[:, None, :] - K[None, :, :]).reshape(-1, 2))


def _boundary_point(D, t):
    """Point at arc-length fraction t (mod 1) of the closed polygon D."""
    seg = np.roll(D, -1, axis=0) - D
    L = np.linalg.norm(seg, axis=1)
    s = (t % 1.0) * L.sum()
    i = int(np.searchsorted(np.cumsum(L), s, side="right"))
    i = min(i, len(D) - 1)
    s0 = s - (np.cumsum(L)[i] - L[i])
    return D[i] + seg[i] * (s0 / L[i])


def _seg_intersections(A, B):
    """All intersection points of the closed polylines A and B."""
    out = []
    a0, a1 = A, np.roll(A, -1, axis=0)
    b0, b1 = B, np.roll(B, -1, axis=0)
    for p, p2 in zip(a0, a1):
        r = p2 - p
        s = b1 - b0
        den = r[0] * s[:, 1] - r[1] * s[:, 0]
        ok = np.abs(den) > 1e-14
        qp = b0 - p
        t = np.where(ok, (qp[:, 0] * s[:, 1] - qp[:, 1] * s[:, 0]) / np.where(ok, den, 1), -1)
        u = np.where(ok, (qp[:, 0] * r[1] - qp[:, 1] * r[0]) / np.where(ok, den, 1), -1)
        m = ok & (t >= -1e-12) & (t <= 1 + 1e-12) & (u >= -1e-12) & (u <= 1 + 1e-12)
        out += [p + ti * r for ti in t[m]]
    return out


def _det_at(D, t):
    p = _boundary_point(D, t)
    best = math.inf
    for q in _seg_intersections(D, D + p):
        d = p[0] * q[1] - p[1] * q[0]
        if d > 1e-9:
            best = min(best, d)
    return best, p


def critical_determinant(D, n=720):
    """Delta(D) for a centrally symmetric convex polygon D: min det(p, q), p, q, q - p on the boundary."""
    D = np.asarray(D, float)
    ts = np.linspace(0, 0.5, n, endpoint=False)
    vals = np.array([_det_at(D, t)[0] for t in ts])
    i = int(np.argmin(vals))
    h = 0.5 / n
    res = minimize_scalar(lambda t: _det_at(D, t)[0], bounds=(ts[i] - h, ts[i] + h),
                          method="bounded", options={"xatol": 1e-12})
    val = min(float(res.fun), float(vals[i]))
    t_best = float(res.x) if res.fun <= vals[i] else float(ts[i])
    p = _boundary_point(D, t_best)
    qs = [q for q in _seg_intersections(D, D + p) if p[0] * q[1] - p[1] * q[0] > 1e-9]
    q = min(qs, key=lambda q: p[0] * q[1] - p[1] * q[0])
    return val, np.column_stack([p, q])


def densest_lattice_packing(K):
    """(density, basis) of the densest lattice packing of translates of the convex polygon K."""
    K = np.asarray(K, float)
    delta, B = critical_determinant(difference_body(K))
    return area(K) / delta, B


def inside(P, pts):
    """Even-odd point-in-polygon for many points (boundary counts as outside)."""
    P = np.asarray(P, float)
    x, y = pts[:, 0], pts[:, 1]
    res = np.zeros(len(pts), bool)
    for (x1, y1), (x2, y2) in zip(P, np.roll(P, -1, axis=0)):
        c = ((y1 > y) != (y2 > y)) & (x < (x2 - x1) * (y - y1) / np.where(y2 != y1, y2 - y1, 1) + x1)
        res ^= c
    return res


def coverage_counts(B, tiles, pts, reach=3):
    """How many translates of the motif tiles cover each point (1 everywhere means a tiling)."""
    B = np.asarray(B, float)
    cnt = np.zeros(len(pts), int)
    for i in range(-reach, reach + 1):
        for j in range(-reach, reach + 1):
            v = B @ np.array([i, j])
            for T in tiles:
                cnt += inside(np.asarray(T) + v, pts)
    return cnt


def tilings():
    """Basis plus motif tiles for the four tilings of the brief (unit edge)."""
    s3 = math.sqrt(3)
    sq = (np.eye(2), [np.array([[0, 0], [1, 0], [1, 1], [0, 1]], float)])
    tri_B = np.array([[1.0, 0.5], [0, s3 / 2]])
    up = np.array([[0, 0], [1, 0], [0.5, s3 / 2]])
    dn = np.array([[1, 0], [1.5, s3 / 2], [0.5, s3 / 2]])
    tri = (tri_B, [up, dn])
    hexa = (np.array([[1.5, 1.5], [s3 / 2, -s3 / 2]]), [regular(6, 1.0, 0.0)])
    a = math.radians(72)
    rh_B = np.array([[1.0, math.cos(a)], [0, math.sin(a)]])
    rh = (rh_B, [np.array([[0, 0], [1, 0], [1 + math.cos(a), math.sin(a)], [math.cos(a), math.sin(a)]])])
    return {"square": sq, "triangle": tri, "hexagon": hexa, "rhombus72": rh}
