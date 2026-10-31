# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Point sets for sampling studies, at exactly equal counts.

Disc (unit radius): Vogel spiral, hexagonal, square, Penrose vertices, uniform random, jittered
hexagonal, rotated lattices. A lattice set is the N lattice points nearest the centre, scaled so
the farthest lies at radius sqrt((N - 0.5) / N), the Vogel set's outer radius.
Sphere: Fibonacci lattice, icosahedral geodesic grid (10 f^2 + 2 points), latitude-longitude grid
with poles, uniform random.
"""
import math
import sys

import numpy as np
from scipy.spatial import cKDTree

from . import algebra as L
from . import penrose, spiral

sys.dont_write_bytecode = True

_PENROSE = {}


def _nearest(P, N, center=(0.0, 0.0)):
    P = np.asarray(P, float) - np.asarray(center, float)
    r = np.linalg.norm(P, axis=1)
    o = np.argsort(r, kind="stable")[:N]
    Q = P[o]
    return Q * (math.sqrt((N - 0.5) / N) / np.linalg.norm(Q, axis=1).max())


def lattice_disc(B, N, theta=0.0, center=(0.0, 0.0)):
    B = L.rotation(theta) @ np.asarray(B, float)
    lat = L.Lattice(B)
    r = 1.6 * math.sqrt(N * lat.covolume / math.pi) + 2
    return _nearest(lat.points(r, center), N, center)


def penrose_vertices(depth=9):
    if depth not in _PENROSE:
        _PENROSE[depth] = penrose.vertices(penrose.tiling(depth))
    return _PENROSE[depth]


def disc_set(name, N, rng=None, theta=0.0, jitter=0.25):
    if name == "spiral":
        return spiral.vogel(N)
    if name == "hex":
        return lattice_disc(L.HEX, N, theta, (0.21, 0.13))
    if name == "square":
        return lattice_disc(L.SQUARE, N, theta, (0.21, 0.13))
    if name == "penrose":
        V = penrose_vertices()
        P = _nearest(V, N)
        c, s = math.cos(theta), math.sin(theta)
        return P @ np.array([[c, s], [-s, c]])
    if name == "random":
        r = np.sqrt(rng.uniform(0, 1, N)) * math.sqrt((N - 0.5) / N)
        t = rng.uniform(0, 2 * math.pi, N)
        return np.column_stack([r * np.cos(t), r * np.sin(t)])
    if name == "jitter_hex":
        P = disc_set("hex", N, theta=theta)
        a = math.sqrt(2 * math.pi / (math.sqrt(3) * N))
        P = P + rng.normal(0, jitter * a, P.shape)
        r = np.linalg.norm(P, axis=1)
        lim = math.sqrt((N - 0.5) / N)
        return np.where((r > lim)[:, None], P * (lim / r)[:, None], P)
    raise KeyError(name)


def covering_radius(P, test):
    d, _ = cKDTree(P).query(test)
    return float(d.max())


def disc_discrepancy(P, rng, n=4000):
    """Max over random sub-discs inside the unit disc of |fraction of points - fraction of area|."""
    N = len(P)
    tree = cKDTree(P)
    worst = 0.0
    for _ in range(n):
        rad = rng.uniform(0.05, 0.5)
        rr = math.sqrt(rng.uniform(0, 1)) * (1 - rad)
        t = rng.uniform(0, 2 * math.pi)
        c = (rr * math.cos(t), rr * math.sin(t))
        k = len(tree.query_ball_point(c, rad))
        worst = max(worst, abs(k / N - rad * rad))
    return worst


# ---- sphere ----

def fibonacci_sphere(N):
    i = np.arange(N) + 0.5
    z = 1 - 2 * i / N
    t = 2 * math.pi * i / spiral.PHI
    r = np.sqrt(1 - z * z)
    return np.column_stack([r * np.cos(t), r * np.sin(t), z])


def icosahedron():
    p = spiral.PHI
    V = np.array([[-1, p, 0], [1, p, 0], [-1, -p, 0], [1, -p, 0], [0, -1, p], [0, 1, p], [0, -1, -p],
                  [0, 1, -p], [p, 0, -1], [p, 0, 1], [-p, 0, -1], [-p, 0, 1]], float)
    V /= np.linalg.norm(V, axis=1)[:, None]
    F = []
    for a in range(12):
        for b in range(a + 1, 12):
            for c in range(b + 1, 12):
                d = [np.linalg.norm(V[x] - V[y]) for x, y in ((a, b), (b, c), (a, c))]
                if max(d) < 1.1:
                    F.append((a, b, c))
    return V, F


def geodesic(f):
    """Class I icosahedral geodesic grid of frequency f: 10 f^2 + 2 points, projected to the sphere."""
    V, F = icosahedron()
    pts = {}
    for a, b, c in F:
        for i in range(f + 1):
            for j in range(f + 1 - i):
                k = f - i - j
                p = (i * V[a] + j * V[b] + k * V[c]) / f
                p = p / np.linalg.norm(p)
                pts.setdefault(tuple(np.round(p, 9)), p)
    return np.array(list(pts.values()))


def latlong(n_lat, n_lon):
    """n_lat rings at equally spaced colatitudes strictly between the poles, n_lon points each, plus poles."""
    th = np.pi * (np.arange(n_lat) + 1) / (n_lat + 1)
    ph = 2 * np.pi * np.arange(n_lon) / n_lon
    T, P = np.meshgrid(th, ph, indexing="ij")
    X = np.column_stack([(np.sin(T) * np.cos(P)).ravel(), (np.sin(T) * np.sin(P)).ravel(), np.cos(T).ravel()])
    return np.vstack([X, [[0, 0, 1], [0, 0, -1]]])


def random_sphere(N, rng):
    X = rng.normal(size=(N, 3))
    return X / np.linalg.norm(X, axis=1)[:, None]


def sphere_set(name, N, rng=None):
    if name == "fibonacci":
        return fibonacci_sphere(N)
    if name == "geodesic":
        f = round(math.sqrt((N - 2) / 10))
        assert 10 * f * f + 2 == N, "geodesic count must be 10 f^2 + 2"
        return geodesic(f)
    if name == "latlong":
        n_lat, n_lon = LATLONG[N]
        return latlong(n_lat, n_lon)
    if name == "random":
        return random_sphere(N, rng)
    raise KeyError(name)


LATLONG = {642: (20, 32), 362: (15, 24)}
