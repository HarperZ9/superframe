# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Surfaces of any genus, combinatorially: rotation systems and face tracing.

An embedding of a graph in a closed surface is fixed (up to homeomorphism) by a rotation system (the cyclic order of
the edges around each vertex) and an edge signature (+1 or -1; -1 marks an edge along which the local orientation
flips). Tracing faces gives F, and Euler's formula gives the Euler genus eg = 2 - V + E - F: an orientable surface of
genus g has eg = 2 g (torus 2, double torus 4); a non-orientable one with k crosscaps has eg = k (projective plane 1,
Klein bottle 2). The surface is orientable when the signature can be switched to all +1 by flipping vertices.
A simulated-annealing search over rotations (and signatures) lowers eg.

Known answers: the genus of K_n is ceil((n - 3)(n - 4) / 12) (Ringel and Youngs), so K5, K6, K7 are toroidal and K8
needs genus 2; the genus of K_{m,n} is ceil((m - 2)(n - 2) / 4) (Ringel); the non-orientable genus of K_n is
ceil((n - 3)(n - 4) / 6) except K7, which needs 3 crosscaps and not 2 (Franklin).
"""
import math

import numpy as np


def complete(n):
    return n, [(i, j) for i in range(n) for j in range(i + 1, n)]


def complete_bipartite(m, n):
    return m + n, [(i, m + j) for i in range(m) for j in range(n)]


def genus_complete(n):
    return math.ceil((n - 3) * (n - 4) / 12) if n >= 3 else 0


def genus_bipartite(m, n):
    return math.ceil((m - 2) * (n - 2) / 4)


def nonorientable_genus_complete(n):
    return 3 if n == 7 else max(1, math.ceil((n - 3) * (n - 4) / 6))


def faces(n, edges, rot, sign=None):
    """Number of faces of the embedding. rot[v]: list of neighbours in cyclic order; sign: dict edge -> +-1."""
    pos = [{w: i for i, w in enumerate(r)} for r in rot]
    sg = {}
    for (u, v) in edges:
        s = 1 if sign is None else sign.get((u, v), sign.get((v, u), 1))
        sg[(u, v)] = sg[(v, u)] = s
    seen = set()
    orbits = 0
    for u in range(n):
        for v in rot[u]:
            for e0 in (1, -1):
                st = (u, v, e0)
                if st in seen:
                    continue
                orbits += 1
                cur = st
                while cur not in seen:
                    seen.add(cur)
                    a, b, e = cur
                    e2 = e * sg[(a, b)]
                    j = pos[b][a]
                    w = rot[b][(j + e2) % len(rot[b])]
                    cur = (b, w, e2)
    return orbits // 2


def euler_genus(n, edges, rot, sign=None):
    return 2 - n + len(edges) - faces(n, edges, rot, sign)


def orientable(n, edges, sign):
    """True when vertex switching can make every signature +1 (a 2-colouring with parity constraints)."""
    if sign is None:
        return True
    adj = [[] for _ in range(n)]
    for (u, v) in edges:
        s = sign.get((u, v), sign.get((v, u), 1))
        adj[u].append((v, s))
        adj[v].append((u, s))
    col = [0] * n
    for s0 in range(n):
        if col[s0]:
            continue
        col[s0] = 1
        stack = [s0]
        while stack:
            u = stack.pop()
            for v, s in adj[u]:
                want = col[u] * s
                if col[v] == 0:
                    col[v] = want
                    stack.append(v)
                elif col[v] != want:
                    return False
    return True


def _neighbours(n, edges):
    nb = [[] for _ in range(n)]
    for (u, v) in edges:
        nb[u].append(v)
        nb[v].append(u)
    return nb


def anneal(graph, rng, steps=20000, T0=1.5, nonorientable=False):
    """Smallest Euler genus found. nonorientable=True searches signed systems and keeps only non-orientable ones.
    Returns (eg, rot, sign)."""
    n, edges = graph
    rot = [list(rng.permutation(r)) for r in _neighbours(n, edges)]
    sign = None
    if nonorientable:
        sign = {e: int(rng.choice([1, -1])) for e in edges}
        while orientable(n, edges, sign):
            e = edges[rng.integers(len(edges))]
            sign[e] = -sign[e]

    def cost(r, s):
        return euler_genus(n, edges, r, s)
    cur = cost(rot, sign)
    best = (cur, [list(r) for r in rot], dict(sign) if sign else None)
    for t in range(steps):
        T = T0 * (1 - t / steps) + 1e-3
        r2 = [list(r) for r in rot]
        s2 = dict(sign) if sign else None
        if nonorientable and rng.random() < 0.2:
            e = edges[rng.integers(len(edges))]
            s2[e] = -s2[e]
            if orientable(n, edges, s2):
                continue
        else:
            v = rng.integers(n)
            d = len(r2[v])
            if d < 3:
                continue
            i, j = rng.choice(d, 2, replace=False)
            if rng.random() < 0.5:
                r2[v][i], r2[v][j] = r2[v][j], r2[v][i]
            else:                                           # move one neighbour to another place in the cycle
                w = r2[v].pop(i)
                r2[v].insert(j, w)
        c = cost(r2, s2)
        if c <= cur or rng.random() < math.exp(-(c - cur) / T):
            rot, sign, cur = r2, s2, c
            if c < best[0]:
                best = (c, [list(r) for r in rot], dict(sign) if sign else None)
    return best


def random_euler_genus(graph, rng, k=25):
    """Euler genus of k uniformly random rotation systems (orientable): a reference spread."""
    n, edges = graph
    nb = _neighbours(n, edges)
    return [euler_genus(n, edges, [list(rng.permutation(r)) for r in nb]) for _ in range(k)]
