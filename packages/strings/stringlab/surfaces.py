# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One graph on the plane, the cylinder, the Moebius strip, the torus and the Klein bottle.

Each surface is a square of side 1 with its edges identified, written as a group of deck transformations of the
covering plane: (x, y) -> (x + m, s^m y + n), with m allowed only if the x-direction is identified, n only if the
y-direction is, and s = -1 on the direction that flips (Moebius strip, Klein bottle). The Moebius strip and cylinder
keep y in a band of half-width 1/2 around 0. A drawing places vertices in the fundamental square and draws each edge as
a straight segment to one chosen image of its other end; two edges cross on the surface when one segment meets any
deck image of the other. A simulated-annealing search lowers the crossing count over positions and image choices.

Known answers (Kuratowski; Euler): K5 and K3,3 need at least one crossing in the plane, and so on the cylinder (genus
0); they embed with no crossing on the Moebius strip (inside the projective plane), on the torus and on the Klein
bottle. Euler's bounds E <= 3V - 6 (planar) and E <= 2V - 4 (planar, bipartite) fail for K5 and K3,3.
"""
import itertools
import math

import numpy as np

SURFACES = {
    "plane": (False, False, 1),
    "cylinder": (True, False, 1),
    "moebius": (True, False, -1),
    "torus": (True, True, 1),
    "klein": (True, True, -1),
}


def deck(surface, reach=2):
    """List of deck transformations as (m, n): (x, y) -> (x + m, s^m y + n)."""
    px, py, _ = SURFACES[surface]
    ms = range(-reach, reach + 1) if px else [0]
    ns = range(-reach, reach + 1) if py else [0]
    return [(m, n) for m in ms for n in ns]


def apply(surface, p, mn):
    _, _, s = SURFACES[surface]
    m, n = mn
    return np.array([p[0] + m, (s ** abs(m)) * p[1] + n])


def complete(n):
    return n, list(itertools.combinations(range(n), 2))


def k33():
    return 6, [(i, j) for i in range(3) for j in range(3, 6)]


def _cross(a, b, c, d):
    """Proper intersection of segments ab and cd (shared endpoints do not count)."""
    def orient(p, q, r):
        return (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])
    o1, o2, o3, o4 = orient(a, b, c), orient(a, b, d), orient(c, d, a), orient(c, d, b)
    return (o1 * o2 < -1e-12) and (o3 * o4 < -1e-12)


def segments(surface, pos, edges, lifts):
    return [(pos[u], apply(surface, pos[v], lifts[k])) for k, (u, v) in enumerate(edges)]


def crossings(surface, pos, edges, lifts, reach=2):
    """Number of edge pairs that cross on the surface."""
    segs = segments(surface, pos, edges, lifts)
    D = deck(surface, reach)
    count = 0
    for i in range(len(segs)):
        for j in range(i + 1, len(segs)):
            a, b = segs[i]
            hit = False
            for mn in D:
                c, d = apply(surface, segs[j][0], mn), apply(surface, segs[j][1], mn)
                if _cross(a, b, c, d):
                    hit = True
                    break
            count += hit
    return count


def _seg_point_dist(a, b, p):
    ab = b - a
    t = np.clip(np.dot(p - a, ab) / max(np.dot(ab, ab), 1e-300), 0, 1)
    return float(np.linalg.norm(a + t * ab - p))


def nondegenerate(surface, pos, edges, lifts, sep=0.04, clear=0.02, reach=2):
    """Reject drawings that cheat: vertices too close to one another (any images), zero-length edges, or an edge
    passing through a vertex that is not its endpoint."""
    D = deck(surface, reach)
    n = len(pos)
    imgs = [(i, apply(surface, pos[i], mn), mn) for i in range(n) for mn in D]
    for i in range(n):
        for j, q, mn in imgs:
            if (j != i or mn != (0, 0)) and np.linalg.norm(pos[i] - q) < sep:
                return False
    for k, (a, b) in enumerate(segments(surface, pos, edges, lifts)):
        if np.linalg.norm(b - a) < sep:
            return False
        u, v = edges[k]
        for j, q, mn in imgs:
            if (j == u and mn == (0, 0)) or np.linalg.norm(q - b) < 1e-12:
                continue
            if _seg_point_dist(a, b, q) < clear:
                return False
    return True


def band_ok(surface, pos, edges, lifts):
    """Cylinder and Moebius strip: every point of every edge stays inside the band |y| < 1/2."""
    if SURFACES[surface][1]:
        return True
    return all(abs(p[1]) < 0.5 for s in segments(surface, pos, edges, lifts) for p in s)


def anneal(surface, graph, rng, steps=4000, T0=1.0):
    """Lowest crossing count found; returns (count, positions, lifts)."""
    n, edges = graph
    px, py, _ = SURFACES[surface]
    lift_choices = [(m, k) for m in ((-1, 0, 1) if px else (0,)) for k in ((-1, 0, 1) if py else (0,))]
    pos = rng.uniform(-0.4, 0.4, (n, 2)) if not py else rng.uniform(0, 1, (n, 2))
    lifts = [lift_choices[rng.integers(len(lift_choices))] for _ in edges]
    for _ in range(200):
        if band_ok(surface, pos, edges, lifts) and nondegenerate(surface, pos, edges, lifts):
            break
        pos = rng.uniform(-0.4, 0.4, (n, 2)) if not py else rng.uniform(0, 1, (n, 2))
        lifts = [(0, 0)] * len(edges)
    cur = crossings(surface, pos, edges, lifts)
    best = (cur, pos.copy(), list(lifts))
    for t in range(steps):
        T = T0 * (1 - t / steps) + 1e-3
        p2, l2 = pos.copy(), list(lifts)
        if rng.random() < 0.5:
            i = rng.integers(n)
            p2[i] += rng.normal(0, 0.1, 2)
            if not py:
                p2[i, 1] = np.clip(p2[i, 1], -0.45, 0.45)
            if not px:
                p2[i, 0] = np.clip(p2[i, 0], -0.45, 0.45)
        else:
            l2[rng.integers(len(edges))] = lift_choices[rng.integers(len(lift_choices))]
        if not band_ok(surface, p2, edges, l2) or not nondegenerate(surface, p2, edges, l2):
            continue
        c = crossings(surface, p2, edges, l2)
        if c <= cur or rng.random() < math.exp(-(c - cur) / T):
            pos, lifts, cur = p2, l2, c
            if c < best[0]:
                best = (c, pos.copy(), list(lifts))
                if c == 0:
                    break
    return best


def euler_planar_bounds(graph, bipartite=False):
    """True if the graph satisfies the planar edge bound (necessary for planarity)."""
    n, edges = graph
    return len(edges) <= (2 * n - 4 if bipartite else 3 * n - 6)
