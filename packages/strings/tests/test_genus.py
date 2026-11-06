# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers: Euler genus from face tracing for explicit embeddings (planar K4, K7 on the torus, K6 in the
projective plane, K8 on the double torus), and the Ringel-Youngs and Franklin formulas."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import genus as g  # noqa: E402

K7_TORUS = [[(i + p) % 7 for p in (1, 3, 2, 6, 4, 5)] for i in range(7)]
K6_RP2 = ([[3, 4, 5, 1, 2], [5, 3, 4, 2, 0], [4, 5, 3, 0, 1], [1, 4, 0, 2, 5], [5, 2, 1, 3, 0], [3, 2, 4, 0, 1]],
          {(0, 4): -1, (0, 5): -1, (1, 3): -1, (1, 5): -1, (3, 4): -1})
K8_GENUS2 = [[7, 5, 3, 1, 2, 6, 4], [4, 5, 6, 2, 0, 3, 7], [7, 6, 0, 1, 3, 4, 5], [6, 7, 1, 0, 5, 4, 2],
             [2, 3, 1, 7, 0, 6, 5], [1, 3, 0, 7, 2, 4, 6], [2, 7, 3, 1, 5, 4, 0], [5, 0, 4, 1, 3, 6, 2]]


def test_formulas():
    assert [g.genus_complete(n) for n in (4, 5, 6, 7, 8, 9)] == [0, 1, 1, 1, 2, 3]
    assert g.genus_bipartite(3, 3) == 1 and g.genus_bipartite(5, 5) == 3
    assert [g.nonorientable_genus_complete(n) for n in (5, 6, 7, 8)] == [1, 1, 3, 4]


def test_planar_k4():
    assert g.faces(4, g.complete(4)[1], [[1, 2, 3], [0, 3, 2], [0, 1, 3], [0, 2, 1]]) == 4


def test_explicit_embeddings():
    assert g.euler_genus(7, g.complete(7)[1], K7_TORUS) == 2
    n, e = g.complete(6)
    assert g.euler_genus(n, e, K6_RP2[0], K6_RP2[1]) == 1 and not g.orientable(n, e, K6_RP2[1])
    assert g.euler_genus(8, g.complete(8)[1], K8_GENUS2) == 4


def test_search_never_beats_the_genus():
    rng = np.random.default_rng(0)
    assert g.anneal(g.complete(5), rng, steps=3000)[0] == 2
    assert min(g.random_euler_genus(g.complete(7), rng, 10)) >= 2
