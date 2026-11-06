# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: the regular octagon with angle pi/4 and opposite sides glued has one vertex class (genus 2); the
side pairings map side j + 4 onto side j; K5 draws without crossings and its face-traced rotation has Euler genus at
most 4; the Gamma_d convention switches reproduce the default."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import genus as g, hyperbolic as hy, stringbursts as sb  # noqa: E402


def test_octagon_is_genus_two():
    assert hy.vertex_classes() == 1 and hy.side_pairing_ok()
    assert 1 - 4 + 1 == 2 - 2 * 2


def test_k5_draws_without_crossings():
    dr = hy.Drawing(hy.complete(5), 1, 2)
    c, pos, lift = hy.anneal(dr, np.random.default_rng(1), steps=3000)
    assert c == 0
    assert g.euler_genus(5, dr.edges, dr.rotation(pos, lift)) in (2, 4)


def test_gamma_d_overrides_default():
    assert sb.gamma_d(100, g1k=sb.G1["k"], delta=sb.DELTA, g2=sb.G2) == sb.gamma_d(100)
    assert sb.gamma_d(100, delta=1.0) > sb.gamma_d(100)
