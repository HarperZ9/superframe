# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 5c: renormalization-group flow of the 2-D Ising model by majority-rule block spins.

Swendsen-Wang sampling at coupling K (J / kT, zero field, periodic). Block spins (b = 3,
majority, no ties) coarse-grain a sample level by level. The nearest-neighbour
correlation falls with each blocking below Kc (flow toward K = 0) and rises above it (toward infinite
K); where two levels give the same correlation is the fixed point, which should sit near the exact
critical coupling Kc = ln(1 + sqrt 2) / 2 = 0.4407 (Onsager). Effective couplings per level, read off an
unblocked reference curve, draw the flow arrows.
"""
import numpy as np
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

KC = 0.5 * np.log(1 + np.sqrt(2))


def sample(L, K, rng, sweeps=200, burn=60, every=5, start=None):
    """Swendsen-Wang cluster sampling (periodic): aligned neighbours bond with probability 1 - exp(-2K),
    each cluster takes a fresh random sign. Cluster moves avoid critical slowing down near Kc."""
    s = rng.choice([-1, 1], (L, L)).astype(np.int8) if start is None else start.copy()
    idx = np.arange(L * L).reshape(L, L)
    p = 1.0 - np.exp(-2.0 * K)
    out = []
    for t in range(sweeps):
        rows, cols = [], []
        for ax in (0, 1):
            nb = np.roll(idx, -1, ax)
            bond = (s == np.roll(s, -1, ax)) & (rng.random((L, L)) < p)
            rows.append(idx[bond])
            cols.append(nb[bond])
        r, c = np.concatenate(rows), np.concatenate(cols)
        g = coo_matrix((np.ones(len(r), np.int8), (r, c)), shape=(L * L, L * L))
        _, lab = connected_components(g, directed=False)
        sign = rng.choice(np.array([-1, 1], np.int8), lab.max() + 1)
        s = sign[lab].reshape(L, L)
        if t >= burn and (t - burn) % every == 0:
            out.append(s.copy())
    return out


def block(s, rng, b=3):
    """Majority rule over b x b blocks (b odd, so there are no ties)."""
    L = s.shape[0] // b
    t = s[:L * b, :L * b].reshape(L, b, L, b).sum(axis=(1, 3))
    return np.sign(t).astype(np.int8)
def nn_corr(s):
    return float(np.mean(s * np.roll(s, 1, 0) + s * np.roll(s, 1, 1)) / 2)


def flow(Ks, rng, L=243, levels=3, sweeps=200, ref_L=81):
    """For each K, the nearest-neighbour correlation of the lattice after 0..levels majority blockings
    (c[level, K]); and the effective coupling of each level read from the reference curve c(K) of an
    unblocked ref_L lattice. Below Kc the correlation falls with level, above it rises."""
    Ks = np.asarray(Ks, float)
    c = np.zeros((levels + 1, len(Ks)))
    ref = np.zeros(len(Ks))
    for j, K in enumerate(Ks):
        S = sample(L, K, rng, sweeps)
        for x in S:
            for lev in range(levels + 1):
                c[lev, j] += nn_corr(x) / len(S)
                if lev < levels:
                    x = block(x, rng)
        ref[j] = np.mean([nn_corr(x) for x in sample(ref_L, K, rng, sweeps)])
    order = np.argsort(ref)
    K_eff = np.interp(c, ref[order], Ks[order])
    return {"K": Ks, "c": c, "ref": ref, "K_eff": K_eff}


def fixed_point(res, a=1, b=2):
    """Coupling where the level-a and level-b correlations cross (first sign change of c_b - c_a)."""
    d = res["c"][b] - res["c"][a]
    K = res["K"]
    idx = np.where(np.diff(np.sign(d)) != 0)[0]
    if len(idx) == 0:
        return float("nan")
    i = idx[0]
    return float(K[i] - d[i] * (K[i + 1] - K[i]) / (d[i + 1] - d[i]))
