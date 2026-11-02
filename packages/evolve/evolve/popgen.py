# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known laws the engine must reproduce before any knob is read.

Eigen error threshold (Eigen 1971; Q_c = 1 / sigma as stated on the Wikipedia page "Error
threshold (evolution)", fetched 2026-10-29). With copying fidelity Q = (1 - mu)^L the master is
lost when Q < 1 / sigma, so mu_c = 1 - sigma^(-1/L), about ln(sigma) / L for small mu. Without back
mutation the master's stationary share is x = (sigma Q - 1) / (sigma - 1) (from memory: the
standard single-peak quasispecies result).

Kimura fixation probability (Kimura 1962, Genetics 47: 713-719). Diploid, as fetched:
u = (1 - e^(-2s)) / (1 - e^(-4 N s)). Haploid Wright-Fisher with N genomes, by the same diffusion
with variance p(1 - p) / N: u = (1 - e^(-2s)) / (1 - e^(-2 N s)); neutral u = 1 / N.

Both simulations call the engine's own selection (weights, rule 'prop') and mutation (_mutate),
so a pass checks the operators the study uses.
"""
import numpy as np

from .engine import Config, _mutate, weights


def mu_c(sigma, L, exact=True):
    return 1 - sigma ** (-1.0 / L) if exact else np.log(sigma) / L


def master_share(sigma, L, mu):
    Q = (1 - mu) ** L
    return max(0.0, (sigma * Q - 1) / (sigma - 1))


def kimura_haploid(N, s):
    if s == 0:
        return 1.0 / N
    return (1 - np.exp(-2 * s)) / (1 - np.exp(-2 * N * s))


def eigen_share(L, sigma, mu, N, G, rng, burn=None):
    """Mean master share over the last half of G generations, starting from a clonal master."""
    cfg = Config(N=N, mu=mu, sel="prop")
    pop = np.zeros((N, L), np.int8)
    shares = []
    for t in range(G):
        f = np.where(pop.sum(axis=1) == 0, float(sigma), 1.0)
        w = weights(f, 1.0, "prop")
        pop = _mutate(pop[rng.choice(N, size=N, p=w / w.sum())], cfg, rng)
        if t >= (G // 2 if burn is None else burn):
            shares.append(float((pop.sum(axis=1) == 0).mean()))
    return float(np.mean(shares))


def threshold_fit(L, sigma, mus, shares):
    """Fit share = a + b Q on points with share > 0.1 and solve share = 0 for Q, then for mu."""
    Q = (1 - np.asarray(mus)) ** L
    s = np.asarray(shares)
    keep = s > 0.1
    b, a = np.polyfit(Q[keep], s[keep], 1)
    Qc = -a / b
    return float(1 - Qc ** (1.0 / L)), float(Qc)


def fixation(N, s, reps, rng, G_max=100000):
    """Share of single new alleles (fitness 1 + s, rest 1) that fix in haploid WF, via the engine rule."""
    fixed = 0
    for _ in range(reps):
        k = 1
        for _ in range(G_max):
            f = np.r_[np.full(k, 1 + s), np.ones(N - k)]
            w = weights(f, 1.0, "prop")
            k = int(rng.binomial(N, w[:k].sum() / w.sum()))
            if k == 0 or k == N:
                break
        fixed += k == N
    return fixed / reps
