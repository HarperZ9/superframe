# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Rhombus packing: the Penrose P3 tiling by Robinson-triangle substitution.

Triangles are (kind, A, B, C) with complex vertices. Kind 0 is the 36-72-72 golden triangle, half a
thin rhombus; kind 1 is the 108-36-36 golden gnomon, half a thick rhombus. Two halves share the base
BC. Substitution: thin half -> 1 thin + 1 thick; thick half -> 1 thin + 2 thick. The matrix
[[1, 1], [1, 2]] has Perron eigenvalue phi^2, so thick:thin -> phi.
"""
import cmath
import math
import sys

import numpy as np

sys.dont_write_bytecode = True

PHI = (1 + math.sqrt(5)) / 2


def sun(R=1.0):
    """A wheel of ten thin halves around the origin (the 'sun' start)."""
    tris = []
    for i in range(10):
        B = cmath.rect(R, (2 * i - 1) * math.pi / 10)
        C = cmath.rect(R, (2 * i + 1) * math.pi / 10)
        if i % 2 == 0:
            B, C = C, B
        tris.append((0, 0j, B, C))
    return tris


def subdivide(tris):
    out = []
    for kind, A, B, C in tris:
        if kind == 0:
            P = A + (B - A) / PHI
            out += [(0, C, P, B), (1, P, C, A)]
        else:
            Q = B + (A - B) / PHI
            R = B + (C - B) / PHI
            out += [(1, R, C, A), (1, Q, R, B), (0, R, Q, A)]
    return out


def tiling(depth, R=1.0):
    tris = sun(R)
    for _ in range(depth):
        tris = subdivide(tris)
    return tris


def _key(z, nd=9):
    return (round(z.real, nd), round(z.imag, nd))


def rhombi(tris):
    """Join halves that share a base into rhombi; halves on the patch edge stay unpaired."""
    by = {}
    for kind, A, B, C in tris:
        k = (kind,) + tuple(sorted([_key(B), _key(C)]))
        by.setdefault(k, []).append((A, B, C))
    full = {0: [], 1: []}
    half = {0: 0, 1: 0}
    for k, v in by.items():
        if len(v) == 2:
            (A1, B, C), (A2, _, _) = v
            full[k[0]].append((A1, B, A2, C))
        else:
            half[k[0]] += 1
    return full, half


def vertices(tris):
    seen = {}
    for _, A, B, C in tris:
        for z in (A, B, C):
            seen.setdefault(_key(z), z)
    v = np.array(list(seen.values()))
    return np.column_stack([v.real, v.imag])


def count_ratio(depth):
    """Exact thick:thin half-triangle counts from the substitution matrix, starting from the sun."""
    thin, thick = 10, 0
    out = []
    for d in range(depth + 1):
        out.append((d, thin, thick, thick / thin))
        thin, thick = thin + thick, thin + 2 * thick
    return out
