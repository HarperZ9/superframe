# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Synthetic controls with designed phases.

gas      iid(freqs, n, rng): independent symbols at given frequencies. I(d) = 0 for every d.
liquid   markov(seq, k, n, rng): k-th order chain fitted to seq. Finite memory, so I(d) decays
         exponentially in d (a finite-state source has a spectral gap).
crystal  periodic(unit, n, noise, rng): a unit repeated; with noise > 0 each symbol is replaced by a
         random one with that probability, so order stays long-range and the match excess peaks at
         the unit length.
shuffle  shuffled(seq, rng): the same symbols in random order.
"""
import numpy as np


def iid(freqs, n, rng):
    p = np.asarray(freqs, float)
    p = p / p.sum()
    return rng.choice(len(p), size=n, p=p)


def markov(seq, k, n, rng):
    """Sample n symbols from the order-k chain with the counts of seq (unseen context: restart)."""
    s = [int(x) for x in seq]
    table = {}
    for i in range(k, len(s)):
        table.setdefault(tuple(s[i - k:i]), []).append(s[i])
    starts = [tuple(s[i - k:i]) for i in range(k, len(s))]
    ctx = starts[int(rng.integers(len(starts)))]
    out = list(ctx)
    draws = rng.random(n)
    while len(out) < n:
        nxt = table.get(ctx)
        if not nxt:
            ctx = starts[int(rng.integers(len(starts)))]
            continue
        x = nxt[int(draws[len(out) % n] * len(nxt))]
        out.append(x)
        ctx = ctx[1:] + (x,) if k else ()
    return np.array(out[:n], dtype=np.int64)


def periodic(unit, n, noise=0.0, rng=None, alphabet=None):
    u = np.asarray(unit, dtype=np.int64)
    s = np.tile(u, n // len(u) + 1)[:n].copy()
    if noise > 0:
        a = alphabet or int(u.max()) + 1
        flip = rng.random(n) < noise
        s[flip] = rng.integers(0, a, flip.sum())
    return s


def shuffled(seq, rng):
    return rng.permutation(np.asarray(seq))


def tree_grammar(depth, alphabet, keep, rng):
    """Lin and Tegmark's critical source: a symbol branches into two children, each a copy of the
    parent with probability keep and a fresh uniform symbol otherwise; the leaves are the text.
    Two leaves at distance d share an ancestor about log2(d) levels up, so I(d) falls as a power law."""
    s = np.array([int(rng.integers(alphabet))])
    for _ in range(depth):
        s = np.repeat(s, 2)
        fresh = rng.random(len(s)) >= keep
        s[fresh] = rng.integers(0, alphabet, fresh.sum())
    return s
