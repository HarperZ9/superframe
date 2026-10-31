# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Jewel packing, reading (b): close packing in crystals.

The 32 crystal classes are the finite point groups that map a 3-D lattice to itself. Every one is a
subgroup of the cubic holohedry m-3m (order 48) or the hexagonal holohedry 6/mmm (order 24). This
module enumerates the subgroups of both, sorts them into classes by the multiset of (det, trace)
over their elements, and counts the classes; the known answer is 32 (Hessel 1830, Frankenheim 1826).
The element-type multiset separates the 32 geometric classes (checked here: it yields exactly 32).
"""
import itertools
import math
import sys
from collections import Counter

import numpy as np

sys.dont_write_bytecode = True


def _key(M):
    return tuple(np.round(M, 6).ravel() + 0.0)


def cubic_group():
    out = []
    for perm in itertools.permutations(range(3)):
        for signs in itertools.product([1, -1], repeat=3):
            M = np.zeros((3, 3))
            for i, p in enumerate(perm):
                M[i, p] = signs[i]
            out.append(M)
    return out


def hexagonal_group():
    out = []
    for k in range(6):
        t = k * math.pi / 3
        R = np.array([[math.cos(t), -math.sin(t), 0], [math.sin(t), math.cos(t), 0], [0, 0, 1]])
        F = np.array([[1, 0, 0], [0, -1, 0], [0, 0, -1]])   # two-fold about x
        for M in (R, R @ F):
            out += [M, -M]
    return out


def closure(gens):
    elems = {_key(np.eye(3)): np.eye(3)}
    frontier = list(elems.values())
    while frontier:
        new = []
        for A in frontier:
            for G in gens:
                P = A @ G
                k = _key(P)
                if k not in elems:
                    elems[k] = P
                    new.append(P)
        frontier = new
    return elems


def subgroups(G):
    """Every subgroup of the finite matrix group G, by adding one element at a time."""
    seen = {}
    start = frozenset([_key(np.eye(3))])
    seen[start] = closure([np.eye(3)])
    frontier = [start]
    while frontier:
        new = []
        for s in frontier:
            have = seen[s]
            for g in G:
                if _key(g) in have:
                    continue
                H = closure(list(have.values()) + [g])
                fk = frozenset(H)
                if fk not in seen:
                    seen[fk] = H
                    new.append(fk)
        frontier = new
    return list(seen.values())


def signature(H):
    return tuple(sorted(Counter((round(float(np.linalg.det(M))), round(float(np.trace(M)), 6))
                                for M in H.values()).items()))


def crystal_classes():
    sigs = {}
    for G in (cubic_group(), hexagonal_group()):
        for H in subgroups(G):
            sigs.setdefault(signature(H), len(H))
    return sigs


def close_packed_layers(stack="ABC", n=3, layers=None):
    """Sphere centres (unit diameter) for a stacking sequence of hexagonal layers A, B, C."""
    shift = {"A": np.zeros(2), "B": np.array([0.5, math.sqrt(3) / 6]), "C": np.array([1.0, math.sqrt(3) / 3])}
    h = math.sqrt(2 / 3)
    a1, a2 = np.array([1.0, 0]), np.array([0.5, math.sqrt(3) / 2])
    pts = []
    for z, s in enumerate(stack * (layers or 1)):
        for i in range(-n, n + 1):
            for j in range(-n, n + 1):
                xy = i * a1 + j * a2 + shift[s]
                pts.append([xy[0], xy[1], z * h])
    return np.array(pts)


def shell_counts(P, center, radii):
    d = np.linalg.norm(P - center, axis=1)
    return [int(np.sum(np.abs(d - r) < 1e-6)) for r in radii]
