# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Pre-play shareability: how well can a speaker who sees one object through lens A tell a listener who
sees K candidates through lens B which one it means? Estimated from a small sample of paired percepts.

Input: n objects, each recorded as A's cells (n, dA) and B's cells (n, dB), integer codes from 0. Nothing
about thresholds, noise or which world feature a cell reads is needed. Method: two-fold cross-fitting.
On one fold, link each A component to the B component with the largest Miller-Madow corrected plug-in
mutual information (kept if above tau bits) and fit add-alpha tables p(a_u | b_v). On the other fold,
score each object's B percept against K-1 distractor percepts from the same fold by the naive-Bayes
product, pick the best, and count hits. The result estimates the Bayes referential accuracy.

Source: formula round 1 (2026-10-29), candidate C1. Option fact, alpha 1.0, tau 0.02 was chosen on F79's
126 replayed pairs and scored on 168 fresh pairs (n 400): MAE to learned accuracy 0.035 against 0.155 for
the Fano bound on the exact overlap. A line fitted to Fano on the development pairs reached 0.029, so the
gain over Fano is mostly level; the estimator's advantage is that it needs no lens model.
"""
import numpy as np

ALPHA, TAU = 1.0, 0.02


def mi_miller_madow(a, b, qa, qb):
    """Plug-in mutual information in bits between two integer codes, Miller-Madow corrected."""
    n = len(a)
    N = np.zeros((qa, qb))
    np.add.at(N, (a, b), 1.0)
    p = N / n
    pa, pb = p.sum(1, keepdims=True), p.sum(0, keepdims=True)
    nz = p > 0
    mi = float((p[nz] * np.log2(p[nz] / (pa @ pb)[nz])).sum())
    k = nz.sum() - (pa > 0).sum() - (pb > 0).sum() + 1
    return mi - k / (2 * n * np.log(2))


def _logcond(a, b, qa, qb, alpha):
    N = np.zeros((qa, qb))
    np.add.at(N, (a, b), 1.0)
    return np.log((N + alpha) / (N.sum(0, keepdims=True) + alpha * qa))


def _links(pa, pb, qa, qb, alpha, tau):
    out = []
    for u in range(pa.shape[1]):
        mis = [mi_miller_madow(pa[:, u], pb[:, v], qa[u], qb[v]) for v in range(pb.shape[1])]
        v = int(np.argmax(mis))
        if mis[v] > tau:
            out.append((u, v, _logcond(pa[:, u], pb[:, v], qa[u], qb[v], alpha)))
    return out


def shareability(pa, pb, K=4, rng=None, alpha=ALPHA, tau=TAU, reps=20):
    """Cross-fitted estimate of referential-game accuracy (1/K is chance). pa (n, dA), pb (n, dB) int."""
    pa, pb = np.atleast_2d(np.asarray(pa, int).T).T, np.atleast_2d(np.asarray(pb, int).T).T
    if len(pa) != len(pb) or len(pa) < 4 * K:
        raise ValueError("need the same n >= 4K objects for both lenses")
    rng = np.random.default_rng(0) if rng is None else rng
    qa = [int(pa[:, j].max()) + 1 for j in range(pa.shape[1])]
    qb = [int(pb[:, j].max()) + 1 for j in range(pb.shape[1])]
    idx = rng.permutation(len(pa))
    folds = (idx[: len(pa) // 2], idx[len(pa) // 2:])
    hits = total = 0
    for tr, te in (folds, folds[::-1]):
        links = _links(pa[tr], pb[tr], qa, qb, alpha, tau)
        m = len(te)
        for _ in range(reps):
            cand = np.column_stack([np.arange(m), (np.arange(m)[:, None] + rng.integers(1, m, (m, K - 1))) % m])
            s = rng.uniform(0, 1e-9, cand.shape)
            for u, v, lc in links:
                s = s + lc[pa[te][:, u][:, None], pb[te][cand, v]]
            hits += int((s.argmax(1) == 0).sum())
            total += m
    return hits / total
