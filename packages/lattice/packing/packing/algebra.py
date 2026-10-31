# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A periodic packing is a basis matrix B (columns are the lattice vectors) plus a motif.

Density = motif volume / |det B|. Linear maps act by matrix products on B: M @ B shears, rotates
or scales; the inverse undoes it. Reduction (Gauss in 2-D, LLL in n-D) finds a short basis of the
same lattice; the dual basis B^{-T} gives the reciprocal (Fourier) grid.
"""
import math
import sys
from pathlib import Path

import numpy as np

sys.dont_write_bytecode = True
# sibling package: packages/lattice holds the `lattice` package with the shared bases
_LATTICE_ROOT = str(Path(__file__).resolve().parents[2])
if _LATTICE_ROOT not in sys.path:
    sys.path.insert(0, _LATTICE_ROOT)
from lattice import basis as _basis  # noqa: E402


class Lattice:
    def __init__(self, B, motif_volume=0.0, motif=None, name=""):
        self.B = np.array(B, float)
        if self.B.ndim != 2 or self.B.shape[0] != self.B.shape[1]:
            raise ValueError("basis must be a square matrix with lattice vectors as columns")
        if abs(np.linalg.det(self.B)) < 1e-14:
            raise ValueError("basis is singular")
        self.motif_volume = float(motif_volume)
        self.motif = motif or []          # list of (offset vector, radius) balls, optional
        self.name = name

    @property
    def dim(self):
        return self.B.shape[0]

    @property
    def covolume(self):
        return abs(float(np.linalg.det(self.B)))

    @property
    def density(self):
        return self.motif_volume / self.covolume

    def transform(self, M):
        """Multiplication composes maps: the new basis is M @ B. Volumes scale by |det M|."""
        M = np.asarray(M, float)
        s = abs(float(np.linalg.det(M)))
        motif = [(M @ np.asarray(o, float), r) for o, r in self.motif]
        return Lattice(M @ self.B, self.motif_volume * s, motif, self.name)

    def untransform(self, M):
        """Division is the inverse map."""
        return self.transform(np.linalg.inv(np.asarray(M, float)))

    def dual(self):
        """Reciprocal lattice with basis B^{-T} (scaled by 2 pi it is the Fourier sampling grid)."""
        return Lattice(np.linalg.inv(self.B).T, 0.0, name=self.name + "*")

    def reduced(self):
        R = gauss_reduce(self.B) if self.dim == 2 else lll_reduce(self.B)
        return Lattice(R, self.motif_volume, self.motif, self.name)

    def shortest_vector(self):
        R = self.reduced().B
        if self.dim == 2:
            return R[:, 0]
        # n-D: search small combinations of the LLL basis (exact for the dimensions used here)
        best, bv = math.inf, None
        rng = range(-2, 3)
        for c in np.array(np.meshgrid(*[rng] * self.dim)).reshape(self.dim, -1).T:
            if not c.any():
                continue
            v = R @ c
            n = float(v @ v)
            if n < best:
                best, bv = n, v
        return bv

    def packing_radius(self):
        return 0.5 * float(np.linalg.norm(self.shortest_vector()))

    def points(self, radius, center=None):
        """All lattice points within radius of center (reduced basis keeps the search small)."""
        R = self.reduced().B
        c0 = np.zeros(self.dim) if center is None else np.asarray(center, float)
        inv = np.linalg.inv(R)
        # bound on coefficients: |c_i| <= radius * ||row_i(R^-1)|| + 1
        bounds = [int(math.ceil(radius * np.linalg.norm(inv[i]))) + 1 for i in range(self.dim)]
        base = np.round(inv @ c0).astype(int)
        axes = [np.arange(b0 - b, b0 + b + 1) for b0, b in zip(base, bounds)]
        C = np.array(np.meshgrid(*axes, indexing="ij")).reshape(self.dim, -1)
        P = (R @ C).T
        keep = np.linalg.norm(P - c0, axis=1) <= radius
        return P[keep]


def gauss_reduce(B):
    """Lagrange-Gauss reduction of a 2-D basis: returns (b1, b2) with |b1| <= |b2| <= |b2 - k b1|."""
    b1, b2 = np.array(B[:, 0], float), np.array(B[:, 1], float)
    if b1 @ b1 > b2 @ b2:
        b1, b2 = b2, b1
    for _ in range(10000):
        mu = round(float(b1 @ b2) / float(b1 @ b1))
        b2 = b2 - mu * b1
        if b2 @ b2 >= b1 @ b1 - 1e-15:
            break
        b1, b2 = b2, b1
    return np.column_stack([b1, b2])


def lll_reduce(B, delta=0.75):
    """Textbook LLL on the columns of B."""
    Bv = [np.array(B[:, i], float) for i in range(B.shape[1])]
    n = len(Bv)

    def gs(vs):
        bs, mu = [], np.zeros((n, n))
        for i, v in enumerate(vs):
            w = v.copy()
            for j in range(i):
                mu[i, j] = (v @ bs[j]) / (bs[j] @ bs[j])
                w = w - mu[i, j] * bs[j]
            bs.append(w)
        return bs, mu

    bs, mu = gs(Bv)
    k = 1
    while k < n:
        for j in range(k - 1, -1, -1):
            q = round(mu[k, j])
            if q:
                Bv[k] = Bv[k] - q * Bv[j]
                bs, mu = gs(Bv)
        if bs[k] @ bs[k] >= (delta - mu[k, k - 1] ** 2) * (bs[k - 1] @ bs[k - 1]):
            k += 1
        else:
            Bv[k], Bv[k - 1] = Bv[k - 1], Bv[k]
            bs, mu = gs(Bv)
            k = max(k - 1, 1)
    return np.column_stack(Bv)


def ball_volume(d, r):
    return math.pi ** (d / 2) / math.gamma(d / 2 + 1) * r ** d


def with_balls(B, name="", offsets=None):
    """Lattice packing of equal balls of the largest radius that fits (offsets give a motif)."""
    lat = Lattice(B, name=name)
    offs = [np.zeros(lat.dim)] if offsets is None else [np.asarray(o, float) for o in offsets]
    r = min_motif_distance(lat, offs) / 2
    return Lattice(B, len(offs) * ball_volume(lat.dim, r), [(o, r) for o in offs], name)


def min_motif_distance(lat, offs):
    """Shortest distance between distinct ball centres over all translates of the motif."""
    R = lat.reduced().B
    best = math.inf
    rng = range(-2, 3)
    C = np.array(np.meshgrid(*[rng] * lat.dim)).reshape(lat.dim, -1).T
    inv = np.linalg.inv(R)
    for i, a in enumerate(offs):
        for j, b in enumerate(offs):
            # fold b - a into the reduced cell first; a far offset otherwise escapes the -2..2 search
            # (fixed 2026-10-29 after the packing study's H4 found two overlapping motifs)
            diff = b - a
            diff = diff - R @ np.round(inv @ diff)
            for c in C:
                if i == j and not c.any():
                    continue
                best = min(best, float(np.linalg.norm(diff + R @ c)))
    return best


# canonical bases live in lattice.basis (one definition for both packages)
SQUARE, HEX, SC, FCC, BCC = _basis.SQUARE, _basis.HEX, _basis.SC, _basis.FCC, _basis.BCC


def hcp():
    """HCP: hexagonal lattice with c/a = sqrt(8/3) and a two-sphere motif (not a Bravais lattice)."""
    c = math.sqrt(8 / 3)
    B = np.array([[1.0, 0.5, 0], [0, math.sqrt(3) / 2, 0], [0, 0, c]])
    offs = [np.zeros(3), np.array([0.5, math.sqrt(3) / 6, c / 2])]
    return with_balls(B, "hcp", offs)


def shear(s, axis=0):
    M = np.eye(2)
    M[axis, 1 - axis] = s
    return M


def rotation(theta):
    c, s = math.cos(theta), math.sin(theta)
    return np.array([[c, -s], [s, c]])
