# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Lattice generators, densities, packing radii and point sets.

A lattice is a d x d generator matrix G whose columns are basis vectors. Points are G n for
integer n. Every generator here is scaled so that one point occupies unit volume (|det G| = 1)
unless a density is given, so equal density means equal sample count per unit area or volume.
"""
import itertools
import math

import numpy as np

from .basis import BASES, SQ3  # noqa: F401  (SQ3 kept as a public name)


def _unit(G):
    G = np.asarray(G, float)
    return G / abs(np.linalg.det(G)) ** (1.0 / G.shape[0])


def rotation2(deg):
    t = math.radians(deg)
    return np.array([[math.cos(t), -math.sin(t)], [math.sin(t), math.cos(t)]])


GENERATORS = {name: BASES[name] for name in ("square", "hex", "cubic", "bcc", "fcc")}


def generator(name, density=1.0, rotate_deg=0.0):
    """Generator with `density` points per unit volume; 2-D lattices can be rotated."""
    G = _unit(GENERATORS[name])
    d = G.shape[0]
    G = G * density ** (-1.0 / d)
    if rotate_deg:
        if d != 2:
            raise ValueError("rotation is defined for 2-D lattices only")
        G = rotation2(rotate_deg) @ G
    return G


def reciprocal(G):
    """Reciprocal generator in cycles per unit: k . x is an integer for every pair of points."""
    return np.linalg.inv(np.asarray(G, float)).T


def short_vectors(G, reach=3):
    d = G.shape[0]
    out = []
    for n in itertools.product(range(-reach, reach + 1), repeat=d):
        if any(n):
            out.append(G @ np.array(n, float))
    return np.array(out)


def packing_radius(G, reach=3):
    """Half the shortest nonzero lattice vector."""
    return 0.5 * float(np.min(np.linalg.norm(short_vectors(G, reach), axis=1)))


def packing_density(G):
    d = G.shape[0]
    r = packing_radius(G)
    ball = math.pi ** (d / 2) / math.gamma(d / 2 + 1) * r ** d
    return ball / abs(np.linalg.det(G))


def nyquist_density(name, K):
    """Least density at which a ball spectrum of radius K (cycles per unit) does not alias.

    No aliasing iff the ball fits inside the Voronoi cell of the reciprocal lattice, that is
    K <= packing radius of the reciprocal lattice. The packing radius scales as density^(1/d).
    """
    G1 = generator(name, 1.0)
    r1 = packing_radius(reciprocal(G1))   # at density 1
    d = G1.shape[0]
    return (K / r1) ** d


def points_in_box(G, width, height, jitter=0.0, rng=None, origin=(0.0, 0.0)):
    """2-D lattice points inside [0, width) x [0, height), optionally jittered (fraction of spacing)."""
    Ginv = np.linalg.inv(G)
    corners = np.array([[0, 0], [width, 0], [0, height], [width, height]], float) - origin
    nc = corners @ Ginv.T
    lo, hi = np.floor(nc.min(0)) - 1, np.ceil(nc.max(0)) + 1
    i, j = np.meshgrid(np.arange(lo[0], hi[0] + 1), np.arange(lo[1], hi[1] + 1), indexing="ij")
    P = np.stack([i.ravel(), j.ravel()], 1) @ G.T + origin
    if jitter:
        rng = rng or np.random.default_rng(0)
        P = P + rng.normal(0, jitter * spacing(G), P.shape)
    keep = (P[:, 0] >= 0) & (P[:, 0] < width) & (P[:, 1] >= 0) & (P[:, 1] < height)
    return P[keep]


def spacing(G):
    """Nearest-neighbour distance."""
    return 2.0 * packing_radius(G)


def points_with_count(name, width, height, count, rotate_deg=0.0, jitter=0.0, rng=None):
    """Exactly `count` lattice points in the box [0, width) x [0, height).

    Finds the least density (by bisection) that puts at least `count` points in the box, then
    drops the surplus points nearest the border, so the interior stays a perfect lattice.
    The origin is offset from the centre by a fixed fraction of a cell so no point sits on an
    edge. Returns (points, density).
    """
    def pts(dens):
        G = generator(name, dens, rotate_deg)
        sp = spacing(G)
        return points_in_box(G, width, height, origin=(width / 2 + 0.137 * sp, height / 2 + 0.291 * sp))
    lo, hi = 0.25 * count / (width * height), 4.0 * count / (width * height)
    for _ in range(100):
        mid = 0.5 * (lo + hi)
        if len(pts(mid)) >= count:
            hi = mid
        else:
            lo = mid
    P = pts(hi)
    if len(P) > count:
        edge = np.minimum.reduce([P[:, 0], width - P[:, 0], P[:, 1], height - P[:, 1]])
        P = P[np.argsort(-edge, kind="stable")[:count]]
    if jitter:
        rng = rng or np.random.default_rng(0)
        P = P + rng.normal(0, jitter * spacing(generator(name, hi, rotate_deg)), P.shape)
        P = np.clip(P, 0, [width - 1e-9, height - 1e-9])
    return P, hi
