# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Impossible-figure check: does a line drawing have any 3D source?

A drawing is a graph. Nodes are 2D junction points; each edge carries its 2D vector and a local
interpretation, the 3D direction the edge is read as (for example an isometric axis). Under a
projection P (3D to 2D, here orthographic along a view direction), an edge read as 3D direction u
with 2D image e has length lam = e . (P u) / |P u|^2, and its 3D vector is lam u. Each edge is a
valid local projection when e is parallel to P u and lam > 0.

The global question is whether node 3D positions exist with X_j - X_i = lam u for every edge. The
in-plane parts always close (the drawing is a drawing). What can fail is the component along the view
direction, the depth: its sum around a cycle is the obstruction, a 1-cocycle on the drawing's graph
(Penrose's cohomology reading of impossible figures). check() solves the edge equations by least
squares; a residual above tol means no consistent 3D depth assignment exists.
"""
import numpy as np

ISO_VIEW = np.array([1.0, 1.0, 1.0]) / np.sqrt(3)


def projector(view=ISO_VIEW):
    """Orthonormal 2x3 projection onto the plane perpendicular to `view`, and the view direction."""
    v = np.asarray(view, float)
    v = v / np.linalg.norm(v)
    up = np.array([0.0, 0.0, 1.0]) if abs(v[2]) < 0.9 else np.array([0.0, 1.0, 0.0])
    e1 = np.cross(up, v)
    e1 /= np.linalg.norm(e1)
    e2 = np.cross(v, e1)
    return np.stack([e1, e2]), v


def check(nodes2d, edges, view=ISO_VIEW, tol=1e-6, angle_tol_deg=1.0):
    """nodes2d: (n, 2) array. edges: list of (i, j, u) with u the 3D direction the edge is read as.

    Returns {'local_ok', 'global_ok', 'residual', 'cycle_depth_gaps', 'lengths'}.
    """
    P, v = projector(view)
    X2 = np.asarray(nodes2d, float)
    n = len(X2)
    rows, rhs, lam, local = [], [], [], []
    for i, j, u in edges:
        u = np.asarray(u, float)
        pu = P @ u
        e = X2[j] - X2[i]
        l = float(e @ pu / (pu @ pu))
        cosang = abs(e @ pu) / (np.linalg.norm(e) * np.linalg.norm(pu) + 1e-12)
        local.append(bool(l > 0 and cosang > np.cos(np.deg2rad(angle_tol_deg))))
        lam.append(l)
        r = np.zeros(n)
        r[j], r[i] = 1, -1
        rows.append(r)
        rhs.append(l * u)
    A, B = np.array(rows), np.array(rhs)
    A = np.vstack([A, np.eye(n)[0]])  # pin node 0 at the origin
    B = np.vstack([B, np.zeros(3)])
    X3, *_ = np.linalg.lstsq(A, B, rcond=None)
    res = A @ X3 - B
    depth_res = float(np.abs(res @ v).max())
    gaps = _cycle_gaps(n, edges, [np.asarray(l * np.asarray(u, float)) @ v for (_, _, u), l in zip(edges, lam)])
    return {"local_ok": all(local), "global_ok": bool(np.abs(res).max() < tol), "residual": float(np.abs(res).max()),
            "depth_residual": depth_res, "cycle_depth_gaps": gaps, "lengths": lam}


def _cycle_gaps(n, edges, depth):
    """Depth sum around each fundamental cycle of a spanning tree (the cocycle's values)."""
    adj = {k: [] for k in range(n)}
    for k, (i, j, _) in enumerate(edges):
        adj[i].append((j, k, +1))
        adj[j].append((i, k, -1))
    pot, seen, tree = {0: 0.0}, {0}, set()
    stack = [0]
    while stack:
        a = stack.pop()
        for b, k, s in adj[a]:
            if b not in seen:
                seen.add(b)
                pot[b] = pot[a] + s * depth[k]
                tree.add(k)
                stack.append(b)
    return [float(pot[i] + depth[k] - pot[j]) for k, (i, j, _) in enumerate(edges) if k not in tree]


def penrose_tribar(L=3.0):
    """Outer loop of a Penrose triangle in isometric view: walk +x, +y, +z by L each."""
    P, _ = projector()
    ax = np.eye(3)
    pts = [np.zeros(2)]
    for k in range(3):
        pts.append(pts[-1] + L * (P @ ax[k]))
    nodes = np.array(pts[:3])
    edges = [(0, 1, ax[0]), (1, 2, ax[1]), (2, 0, ax[2])]
    return nodes, edges


def real_square(L=3.0):
    """A closed planar square: +x, +y, -x, -y. Locally and globally consistent."""
    P, _ = projector()
    ax = np.eye(3)
    seq = [ax[0], ax[1], -ax[0], -ax[1]]
    pts = [np.zeros(2)]
    for u in seq[:-1]:
        pts.append(pts[-1] + L * (P @ u))
    nodes = np.array(pts)
    edges = [(k, (k + 1) % 4, seq[k]) for k in range(4)]
    return nodes, edges


def cube_corner(L=2.0):
    """Three edges from one corner plus the far faces' loop: a consistent 3D wire corner."""
    P, _ = projector()
    ax = np.eye(3)
    pts3 = [np.zeros(3), L * ax[0], L * ax[1], L * ax[2], L * (ax[0] + ax[1]), L * (ax[1] + ax[2]), L * (ax[0] + ax[2])]
    nodes = np.array([P @ p for p in pts3])
    edges = [(0, 1, ax[0]), (0, 2, ax[1]), (0, 3, ax[2]), (1, 4, ax[1]), (2, 4, ax[0]), (2, 5, ax[2]),
             (3, 5, ax[1]), (1, 6, ax[2]), (3, 6, ax[0])]
    return nodes, edges
