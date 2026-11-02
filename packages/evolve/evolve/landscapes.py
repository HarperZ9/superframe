# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Fitness landscapes on bit strings, with an exact table and a continuous (multilinear) extension.

Every landscape is a sum of components. A component reads a few sites and looks its value up in a
table, so NK, additive and trap landscapes share one evaluator. For L <= 20 the full table over all
2^L genomes is built once, which gives the global optimum, the landscape mean and local-optimum
checks by exhaustive search.

The continuous extension replaces each component's table by its multilinear interpolation on
[0, 1]^k. A multilinear function takes its maximum over the cube at a vertex, so the analog
landscape has the same global optimum and the same maximum value as the bit landscape.

Drift moves the landscape by an XOR mask: f_t(x) = f(x xor m_t). The mask relabels genomes, so
ruggedness, the maximum and the mean stay fixed while the optimum moves to opt xor m_t.
"""
import numpy as np


def _bits_to_int(bits):
    w = 1 << np.arange(bits.shape[-1])[::-1]
    return (bits.astype(np.int64) * w).sum(axis=-1)


class Landscape:
    """A sum of components (idx, table): fitness = mean over components of table[bits at idx]."""

    def __init__(self, L, comps, name, exact=True):
        self.L, self.comps, self.name = int(L), comps, name
        self.table = self._full_table() if exact and L <= 20 else None
        if self.table is not None:
            self.fmax = float(self.table.max())
            self.fmean = float(self.table.mean())
            self.opt_index = int(self.table.argmax())
            self.opt = ((self.opt_index >> np.arange(L)[::-1]) & 1).astype(np.int8)
            self.n_global = int((self.table >= self.fmax - 1e-12).sum())

    def _full_table(self):
        idx = np.arange(1 << self.L, dtype=np.int64)
        bits = ((idx[:, None] >> np.arange(self.L)[::-1]) & 1).astype(np.int8)
        return self.f(bits)

    def f(self, bits):
        """Fitness of an (n, L) 0/1 array."""
        total = np.zeros(bits.shape[0])
        for idx, tab in self.comps:
            total += tab[_bits_to_int(bits[:, idx])]
        return total / len(self.comps)

    def f_cont(self, x):
        """Multilinear extension at an (n, L) array in [0, 1]."""
        total = np.zeros(x.shape[0])
        for idx, tab in self.comps:
            w = np.ones((x.shape[0], 1))
            for j in idx:                                    # first site is the most significant bit
                xj = x[:, j:j + 1]
                w = np.stack([w * (1 - xj), w * xj], axis=2).reshape(x.shape[0], -1)
            total += w @ tab
        return total / len(self.comps)

    def lookup(self, bits, mask=None):
        """Table lookup, optionally through an XOR drift mask."""
        b = bits if mask is None else np.bitwise_xor(bits, mask)
        return self.table[_bits_to_int(b)] if self.table is not None else self.f(b)

    def phi(self, f):
        """Normalised fitness: 0 at the landscape mean, 1 at the global maximum."""
        return (np.asarray(f, float) - self.fmean) / (self.fmax - self.fmean)

    def quantile_value(self, q):
        return float(np.quantile(self.table, q))

    def is_local_opt(self, g, mask=None):
        """True if no single-site flip of genome g raises fitness."""
        g = np.asarray(g, np.int8)
        nb = np.repeat(g[None, :], self.L, axis=0)
        nb[np.arange(self.L), np.arange(self.L)] ^= 1
        return bool(self.lookup(nb, mask).max() <= self.lookup(g[None, :], mask)[0] + 1e-12)

    def is_global(self, g, mask=None):
        return bool(self.lookup(np.asarray(g, np.int8)[None, :], mask)[0] >= self.fmax - 1e-12)


def nk(L, K, rng):
    """Kauffman NK landscape with random neighbours; K = 0 is additive (smooth, one optimum)."""
    comps = []
    for i in range(L):
        others = rng.choice([j for j in range(L) if j != i], size=K, replace=False) if K else []
        idx = np.array([i] + list(others), dtype=int)
        comps.append((idx, rng.random(1 << (K + 1))))
    return Landscape(L, comps, f"nk{K}")


def trap(L, k, rng, d=None):
    """Concatenated deceptive k-bit traps (Deb and Goldberg form), under a random XOR relabelling.

    Unitation u of a block: value k if u == k, else k - 1 - u, scaled to [0, 1]. Every block's
    gradient points away from its optimum. The random mask hides the all-ones optimum.
    """
    perm = rng.permutation(L)
    mask = rng.integers(0, 2, L)
    comps = []
    for b in range(L // k):
        idx = perm[b * k:(b + 1) * k]
        corners = ((np.arange(1 << k)[:, None] >> np.arange(k)[::-1]) & 1) ^ mask[idx]
        u = corners.sum(axis=1)
        comps.append((idx, np.where(u == k, k, k - 1 - u) / k))
    return Landscape(L, comps, "trap")


def sharp_peak(L, sigma):
    """Single-peak landscape for the error threshold: master all-zeros has fitness sigma, all else 1."""
    comps = [(np.arange(L), None)]
    land = Landscape.__new__(Landscape)
    land.L, land.comps, land.name, land.table = L, comps, "sharp", None
    land.sigma = float(sigma)
    land.f = lambda bits: np.where(bits.sum(axis=1) == 0, float(sigma), 1.0)
    return land


def make(kind, L, rng):
    """Named landscape: 'smooth' (NK K=0), 'nk2', 'nk4', 'nk8', 'trap' (4-bit traps)."""
    if kind == "smooth":
        return nk(L, 0, rng)
    if kind.startswith("nk"):
        return nk(L, int(kind[2:]), rng)
    if kind == "trap":
        return trap(L, 4, rng)
    raise ValueError(kind)
