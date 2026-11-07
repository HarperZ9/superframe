# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Laplacian eigenmodes of the six compact orientable flat 3-manifolds E1 to E6, two independent ways.

A flat 3-manifold is R^3 divided by a group of rigid motions. Its covering 3-torus (the "associated E1")
is R^3 divided by the group's translations; the manifold's modes are the torus modes that the remaining
rotations leave invariant. Generators, untilted form with the observer at the special origin, follow
COMPACT (Eskilt et al. 2024, JCAP 03, 036, sections 3 and 4):

  E1  three translations L1 x, L2 y, L3 z (unequal sides allowed)
  E2  (x, y, z) -> (-x, -y, z + L3), with L1 x and L2 y          covering torus L1 x L2 x 2 L3
  E3  (x, y, z) -> (-y, x, z + L3), square L x L                  covering torus L x L x 4 L3
  E4  third turn about z plus L3, hexagonal L                     covering torus hex L x 3 L3
  E5  sixth turn about z plus L3, hexagonal L                     covering torus hex L x 6 L3
  E6  Hantzsche-Wendt: a = diag(1,-1,-1) + (Lx, Ly, 0), b = diag(-1,1,-1) + (0, Ly, Lz),
      c = diag(-1,-1,1) + (Lx, 0, Lz)                             covering torus 2Lx x 2Ly x 2Lz

`analytic_modes` lists the allowed wavevectors from COMPACT's selection rules (eqs. 4.31, 4.36-4.39, 4.62).
`numeric_spectrum` knows only the generators: it builds a finite-difference Laplacian on a grid of the
covering torus, keeps the functions constant on every orbit of grid points under the group, and
diagonalises. The two meet exactly when each analytic wavevector is passed through the stencil's own
symbol, so any disagreement in a value or a multiplicity is an error in a selection rule or a gluing.
This is a capability test of the machinery; it says nothing about the topology of our universe.
"""
import itertools

import numpy as np
from scipy import sparse
from scipy.sparse import linalg as _splinalg  # noqa: F401  (makes sparse.linalg available)

MANIFOLDS = ("E1", "E2", "E3", "E4", "E5", "E6")
TURNS = {"E2": 2, "E3": 4, "E4": 3, "E5": 6}
HEX = ("E4", "E5")


# ---- the covering torus and its stencil ------------------------------------------------------------
def cover(name, L):
    """Side lengths of the covering torus. L = (L1, L2, L3); E3 to E5 need L1 == L2 (hexagonal side for E4, E5)."""
    L1, L2, L3 = map(float, L)
    if name in ("E3", "E4", "E5") and L1 != L2:
        raise ValueError(f"{name} needs equal sides across the turn axis")
    if name == "E6":
        return 2 * L1, 2 * L2, 2 * L3
    return L1, L2, TURNS.get(name, 1) * L3


def symbol(name, n, L, N):
    """Eigenvalue of the finite-difference -Laplacian for the torus mode with integer index n (rows).
    Square lattices: the 7-point stencil. Hexagonal: the 6-neighbour triangular stencil in plane plus the
    3-point stencil along z. Both tend to |k|^2 as the grid refines."""
    n = np.atleast_2d(n).astype(float)
    C = cover(name, L)
    h = [C[i] / N[i] for i in range(3)]
    tz = 4.0 / h[2] ** 2 * np.sin(np.pi * n[:, 2] / N[2]) ** 2
    if name in HEX:
        th = 2 * np.pi / N[0]
        s = 3 - np.cos(th * n[:, 0]) - np.cos(th * n[:, 1]) - np.cos(th * (n[:, 1] - n[:, 0]))
        return 4.0 / (3 * h[0] ** 2) * s + tz
    return sum(4.0 / h[i] ** 2 * np.sin(np.pi * n[:, i] / N[i]) ** 2 for i in range(2)) + tz


def k2_continuum(name, n, L):
    n = np.atleast_2d(n).astype(float)
    C = cover(name, L)
    kz2 = (2 * np.pi * n[:, 2] / C[2]) ** 2
    if name in HEX:
        return (2 * np.pi / C[0]) ** 2 * 4 / 3 * (n[:, 0] ** 2 - n[:, 0] * n[:, 1] + n[:, 1] ** 2) + kz2
    return (2 * np.pi * n[:, 0] / C[0]) ** 2 + (2 * np.pi * n[:, 1] / C[1]) ** 2 + kz2


# ---- analytic: COMPACT's allowed modes ---------------------------------------------------------------
def _hex_turn(n1, n2):
    """Sixth turn acting on a hexagonal dual-lattice index (skew basis a1 = (1, 0), a2 = (1/2, sqrt 3/2))."""
    return n2, n2 - n1


def _orbit_rep(name, n1, n2):
    """True if (n1, n2) is the representative (lexicographic maximum) of its orbit under the turn."""
    m = TURNS[name]
    orbit, p = [], (n1, n2)
    for _ in range(m):
        orbit.append(p)
        p = (-p[1], p[0]) if name == "E3" else (
            (-p[0], -p[1]) if name == "E2" else _hex_turn(*_hex_turn(*p)) if name == "E4" else _hex_turn(*p))
    return (n1, n2) == max(orbit)


def analytic_modes(name, nmax, e6_axis_modes="paired"):
    """Integer indices n of the covering-torus modes that survive on the manifold, |n_i| <= nmax, the
    constant mode included. One row per independent eigenmode.

    E2 to E5 (COMPACT eqs. 4.29-4.31 and their E3-E5 analogues): k_perp = 0 needs n3 a multiple of the
    turn order; otherwise one mode per orbit of the turn. E6 (eq. 4.62): one mode per orbit of the three
    half turns, and a wavevector along one axis needs that index even. e6_axis_modes="as printed" counts
    n and -n separately for those axis modes, as the printed set N_1A (n1 in 2Z, n1 != 0) reads; see the
    tests for which count the numerical spectrum supports."""
    rng = range(-nmax, nmax + 1)
    out = []
    for n in itertools.product(rng, rng, rng):
        n1, n2, n3 = n
        if name == "E1":
            ok = True
        elif name in TURNS:
            m = TURNS[name]
            ok = (n3 % m == 0) if (n1, n2) == (0, 0) else _orbit_rep(name, n1, n2)
        elif name == "E6":
            nz = sum(v != 0 for v in n)
            if nz == 0:
                ok = True
            elif nz == 1:
                v = n1 or n2 or n3
                ok = v % 2 == 0 and (v > 0 or e6_axis_modes == "as printed")
            else:  # COMPACT N_2: n1 > 0, n2 > 0, any n3; or one of n1, n2 zero and the other two positive
                ok = (n1 > 0 and n2 > 0) or (n1 == 0 and n2 > 0 and n3 > 0) or (n2 == 0 and n1 > 0 and n3 > 0)
        else:
            raise ValueError(name)
        if ok:
            out.append(n)
    return np.array(out)


# ---- numeric: the group acting on a grid of the covering torus --------------------------------------
def _generators(name, N):
    """Point maps of the generators (beyond the torus translations) on grid indices (i, j, k)."""
    n0, n1, n2 = N

    def mod(i, j, k):
        return i % n0, j % n1, k % n2
    if name == "E1":
        return []
    if name == "E6":
        return [lambda i, j, k: mod(i + n0 // 2, -j + n1 // 2, -k),
                lambda i, j, k: mod(-i, j + n1 // 2, -k + n2 // 2),
                lambda i, j, k: mod(-i + n0 // 2, -j, k + n2 // 2)]
    dz = n2 // TURNS[name]
    turn = {"E2": lambda i, j: (-i, -j), "E3": lambda i, j: (-j, i),
            "E4": lambda i, j: (-i - j, i), "E5": lambda i, j: (-j, i + j)}[name]
    return [lambda i, j, k: mod(*turn(i, j), k + dz)]


def _laplacian(name, L, N):
    C = cover(name, L)
    h = [C[i] / N[i] for i in range(3)]
    idx = np.arange(np.prod(N)).reshape(N)
    rows, cols, vals = [], [], []

    def add(off, w):
        rows.append(idx.ravel())
        cols.append(np.roll(idx, shift=[-o for o in off], axis=(0, 1, 2)).ravel())
        vals.append(np.full(idx.size, w))
    if name in HEX:
        w = 2.0 / (3 * h[0] ** 2)
        for off in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (-1, 1, 0), (1, -1, 0)):
            add(off, -w)
        diag = 6 * w
    else:
        diag = 0.0
        for ax in range(2):
            off = [0, 0, 0]
            for s in (1, -1):
                off[ax] = s
                add(tuple(off), -1.0 / h[ax] ** 2)
            diag += 2.0 / h[ax] ** 2
    for s in (1, -1):
        add((0, 0, s), -1.0 / h[2] ** 2)
    diag += 2.0 / h[2] ** 2
    rows.append(idx.ravel())
    cols.append(idx.ravel())
    vals.append(np.full(idx.size, diag))
    return sparse.csr_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))),
                             shape=(idx.size, idx.size))


def orbits(name, N):
    """Label of each grid point's orbit under the generators (labels are the smallest index in the orbit)."""
    i, j, k = np.meshgrid(*[np.arange(n) for n in N], indexing="ij")
    flat = lambda a, b, c: (a * N[1] + b) * N[2] + c
    maps = [flat(*g(i, j, k)).ravel() for g in _generators(name, N)]
    lab = np.arange(np.prod(N))
    while True:
        new = lab.copy()
        for m in maps:
            new = np.minimum(new, new[m])
            inv = np.empty_like(m)
            inv[m] = np.arange(len(m))
            new = np.minimum(new, new[inv])
        if np.array_equal(new, lab):
            return lab
        lab = new


def numeric_spectrum(name, L, N):
    """All eigenvalues of the -Laplacian restricted to functions constant on orbits, ascending."""
    N = tuple(int(n) for n in N)
    lab = orbits(name, N)
    uniq, col, size = np.unique(lab, return_inverse=True, return_counts=True)
    B = sparse.csr_matrix((1.0 / np.sqrt(size[col]), (np.arange(len(lab)), col)), shape=(len(lab), len(uniq)))
    LB = _laplacian(name, L, N) @ B
    A = B.T @ LB
    leak = sparse.linalg.norm(LB - B @ A) / sparse.linalg.norm(LB)
    if leak > 1e-10:
        raise RuntimeError(f"the stencil does not commute with the gluing (leak {leak:.1e})")
    A = A.toarray()
    return np.linalg.eigvalsh(A)


def _interior(name, n, N, closed=False):
    """Modes whose indices stay inside the grid's Brillouin zone, where the discrete orbits are the
    continuum ones (closed=True admits the zone's edge as well)."""
    lt = np.less_equal if closed else np.less
    if name in HEX:
        return (lt(np.abs(n[:, 0]), N[0] / 2) & lt(np.abs(n[:, 1]), N[0] / 2)
                & lt(np.abs(n[:, 0] - n[:, 1]), N[0] / 2) & lt(np.abs(n[:, 2]), N[2] / 2))
    return np.all(lt(np.abs(n), np.asarray(N) / 2), axis=1)


def compare(numeric, analytic, N, **kw):
    """Numeric spectrum of one manifold, numeric = (name, L), against the analytic list of another or the
    same, analytic = (name, L), on one grid N of a shared covering torus. Compared below the lowest
    eigenvalue a grid-edge mode could reach. Returns (numeric, analytic) eigenvalue arrays."""
    (nn, ln), (na, la) = numeric, analytic
    if not np.allclose(cover(nn, ln), cover(na, la)) or ((nn in HEX) != (na in HEX)):
        raise ValueError("the two manifolds must share a covering torus")
    num = numeric_spectrum(nn, ln, N)
    nmax = max(N) // 2 + 1
    allm = np.array(list(itertools.product(range(-nmax, nmax + 1), repeat=3)))
    edge = allm[~_interior(na, allm, N) & _interior(na, allm, N, closed=True)]
    cut = symbol(na, edge, la, N).min() * (1 - 1e-9)
    modes = analytic_modes(na, nmax, **kw)
    modes = modes[_interior(na, modes, N)]
    ana = np.sort(symbol(na, modes, la, N))
    return num[num < cut], ana[ana < cut]


def matches(num, ana, rtol=1e-8):
    """Same count and the same values: a multiplicity off by one anywhere fails."""
    return len(num) == len(ana) and np.allclose(num, ana, rtol=rtol, atol=rtol * max(1.0, ana.max(initial=1)))
