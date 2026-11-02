# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Measured quantities: population diversity (entropy) and information about the optimum (signal).

Entropy is measured, never set: the sum over sites of the binary entropy of each site's allele
frequency, in bits (0 for a clonal population, L for a uniform one).

Signal is the mutual information between a population's genome symbols and the optimum's bits,
pooled over (site, individual) pairs and multiplied by L. It assumes sites are exchangeable. The
plug-in estimate carries the Miller-Madow bias correction (cells - 1) / (2 n ln 2) per table.
Analog genomes are quantised to b bits per site before counting, so the same estimator reads both
genome kinds; bits per stored genome bit is then I / (L b).
"""
import numpy as np


def hb(p):
    p = np.clip(np.asarray(p, float), 1e-12, 1 - 1e-12)
    return -(p * np.log2(p) + (1 - p) * np.log2(1 - p))


def diversity(pop):
    """Sum of per-site allele entropies, bits. Analog genomes are read by rounding."""
    b = np.rint(pop) if pop.dtype.kind == "f" else pop
    return float(hb(b.mean(axis=0)).sum())


def quantise(x, b):
    """Uniform b-bit quantiser on [0, 1]; b = 1 is rounding to the nearest bit."""
    levels = 1 << b
    return np.minimum((np.asarray(x, float) * levels).astype(int), levels - 1)


def mi_pooled(sym, opt, n_sym):
    """L times I(O; S) in bits, from the pooled joint over sites and individuals, Miller-Madow."""
    sym = np.asarray(sym, int)
    n, L = sym.shape
    o = np.broadcast_to(np.asarray(opt, int)[None, :], sym.shape).ravel()
    s = sym.ravel()
    joint = np.zeros((2, n_sym))
    np.add.at(joint, (o, s), 1)
    tot = joint.sum()

    def h(counts):
        p = counts[counts > 0] / tot
        return -(p * np.log2(p)).sum() + (np.count_nonzero(counts) - 1) / (2 * tot * np.log(2))

    mi = h(joint.sum(1)) + h(joint.sum(0)) - h(joint.ravel())
    return float(max(0.0, mi) * L)


def signal(pop, opt, b=1):
    """Bits about the optimum held by the population (digital: b ignored; analog: b-bit symbols)."""
    if pop.dtype.kind == "f":
        return mi_pooled(quantise(pop, b), opt, 1 << b)
    return mi_pooled(pop, opt, 2)


def match_rate(pop, opt):
    b = np.rint(pop) if pop.dtype.kind == "f" else pop
    return float((b == np.asarray(opt)[None, :]).mean())
