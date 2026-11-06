# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Membranes and plates of any outline, by finite differences on a grid.

The outline is a boolean mask over the n x n interior nodes of a grid whose box has side `size` metres, so the
node spacing is size / (n + 1) and an all-True mask is the full square with its edge on the zero ghost nodes.
The five-point
Dirichlet Laplacian on the cells inside gives eigenvalues mu_k (Rayleigh, ch. 9). A membrane rings at
f_k = c sqrt(mu_k) / 2 pi. A plate with u = 0 and Laplacian(u) = 0 on its edge (Navier conditions) has the
biharmonic operator equal to the Laplacian squared, so f_k = mu_k sqrt(D / (rho h)) / 2 pi. On a polygon with
straight edges Navier conditions are simple support (Leissa 1969, ch. 4); on a curved edge they differ from
true simple support, and this model says so rather than claim otherwise. Free and clamped edges of any
outline need the full biharmonic stencil and are on the roadmap.
"""
import math
from dataclasses import dataclass, field

import numpy as np
import scipy.sparse as sp
import scipy.sparse.linalg as spla

from .modes import Modes
from .shapes_2d import flexural_rigidity


def dirichlet_laplacian(mask, h):
    """Sparse -Laplacian on the True cells; neighbours outside the mask are zero (Dirichlet)."""
    idx = -np.ones(mask.shape, int)
    idx[mask] = np.arange(mask.sum())
    rows, cols, vals = [], [], []
    ii, jj = np.nonzero(mask)
    for di, dj in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ni, nj = ii + di, jj + dj
        ok = (ni >= 0) & (ni < mask.shape[0]) & (nj >= 0) & (nj < mask.shape[1])
        ok[ok] &= mask[ni[ok], nj[ok]]
        rows.append(idx[ii[ok], jj[ok]]); cols.append(idx[ni[ok], nj[ok]]); vals.append(-np.ones(ok.sum()))
    n = int(mask.sum())
    rows.append(np.arange(n)); cols.append(np.arange(n)); vals.append(4.0 * np.ones(n))
    return sp.csr_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(n, n)) / h ** 2


def eigen(mask, size, k):
    """Smallest k eigenpairs of the Dirichlet Laplacian on the mask (shift-invert at zero)."""
    h = size / (mask.shape[0] + 1)
    L = dirichlet_laplacian(mask, h)
    v0 = np.ones(L.shape[0])            # fixed start vector: the solver is then deterministic
    mu, vec = spla.eigsh(L, k=k, sigma=0.0, which="LM", v0=v0)
    o = np.argsort(mu)
    return mu[o], vec[:, o]


def polygon_mask(points, n):
    """Interior nodes (i + 1) / (n + 1) of the unit box that lie inside the polygon (even-odd rule)."""
    xs = (np.arange(n) + 1.0) / (n + 1)
    X, Y = np.meshgrid(xs, xs, indexing="ij")
    inside = np.zeros_like(X, bool)
    p = np.asarray(points, float)
    for (x1, y1), (x2, y2) in zip(p, np.roll(p, -1, 0)):
        cross = ((y1 > Y) != (y2 > Y)) & (X < (x2 - x1) * (Y - y1) / (y2 - y1 + 1e-300) + x1)
        inside ^= cross
    return inside


@dataclass
class Outline:
    """A membrane (tension > 0) or Navier plate (material with nu) over a mask; size is the box side in metres."""
    mask: np.ndarray
    size: float
    material: object = None
    h: float = 0.0
    tension: float = 0.0
    k: int = 24
    size_exponent: float = 2.0
    _cache: dict = field(default_factory=dict, repr=False)

    def scaled(self, s):
        """The same outline s times larger; eigenvalues scale as s^-2, so a solved basis is reused."""
        out = Outline(self.mask, self.size * s, self.material, self.h, self.tension, self.k, self.size_exponent)
        if "mu" in self._cache:
            out._cache.update(mu=self._cache["mu"] / s ** 2, vec=self._cache["vec"])
        return out

    def solve(self):
        if "mu" not in self._cache:
            self._cache["mu"], self._cache["vec"] = eigen(self.mask, self.size, self.k)
        return self._cache["mu"], self._cache["vec"]

    def mode_image(self, i):
        """Mode i as a 2D array over the grid (NaN outside the outline), for drawing."""
        _, vec = self.solve()
        img = np.full(self.mask.shape, np.nan)
        img[self.mask] = vec[:, i]
        return img

    def modes(self, n=None):
        mu, vec = self.solve()
        if self.tension > 0:
            f = math.sqrt(self.tension / (self.material.rho * self.h)) * np.sqrt(mu) / (2 * math.pi)
        else:
            f = mu * math.sqrt(flexural_rigidity(self.material, self.h) / (self.material.rho * self.h)) / (2 * math.pi)
        grid, inside = self.mask.shape[0], np.flatnonzero(self.mask.ravel())

        def shape(p):
            """Mode amplitudes at the node nearest p, each mode scaled to peak 1; zero outside."""
            node = lambda u: min(grid - 1, max(0, int(round(u * (grid + 1))) - 1))
            cell = node(p[0]) * grid + node(p[1])
            pos = np.searchsorted(inside, cell)
            if pos >= len(inside) or inside[pos] != cell:
                return np.zeros(len(mu))
            return vec[pos] / np.abs(vec).max(0)
        return Modes(f, [f"o{i + 1}" for i in range(len(mu))], shape, self.material.eta)
