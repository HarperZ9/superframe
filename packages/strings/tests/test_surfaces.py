# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for graphs on identified squares: Euler's planar bounds, and explicit crossing-free drawings of K5 and
K3,3 on the torus, the Moebius strip and the Klein bottle that a planted wrong identification breaks."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from stringlab import surfaces as s  # noqa: E402

TORUS_K5 = ([[0.455, 1.147], [1.114, 1.306], [0.714, 1.011], [0.73, 0.186], [0.786, 0.547]],
            [(-1, 0), (-1, 1), (0, 0), (-1, 1), (0, 0), (0, 1), (0, 1), (0, 1), (0, 0), (0, 0)])
MOEBIUS_K33 = ([[0.005, 0.302], [0.033, 0.07], [0.381, 0.009], [-0.032, 0.166], [0.275, 0.45], [0.367, 0.112]],
               [(0, 0), (0, 0), (-1, 0), (0, 0), (-1, 0), (-1, 0), (0, 0), (-1, 0), (0, 0)])


def test_euler_bounds_reject_k5_and_k33_in_the_plane():
    assert not s.euler_planar_bounds(s.complete(5))
    assert not s.euler_planar_bounds(s.k33(), bipartite=True)
    assert s.euler_planar_bounds(s.complete(4))


def test_k5_on_the_torus_has_a_crossing_free_drawing():
    pos, lifts = TORUS_K5
    _, edges = s.complete(5)
    assert s.crossings("torus", np.array(pos), edges, lifts) == 0
    assert s.nondegenerate("torus", np.array(pos), edges, lifts)


def test_k33_on_the_moebius_strip_and_its_planted_wrong_twin():
    pos, lifts = MOEBIUS_K33
    _, edges = s.k33()
    assert s.crossings("moebius", np.array(pos), edges, lifts) == 0
    assert s.band_ok("moebius", np.array(pos), edges, lifts)
    assert s.crossings("cylinder", np.array(pos), edges, lifts) > 0   # same drawing without the flip: crossings


def test_plane_search_never_reaches_zero_for_k5():
    rng = np.random.default_rng(0)
    assert s.anneal("plane", s.complete(5), rng, steps=600)[0] >= 1
