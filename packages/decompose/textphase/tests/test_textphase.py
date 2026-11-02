# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer tests on synthetic sources. Run: python -I -B tests/test_textphase.py (or pytest)."""
import math
import sys
from pathlib import Path

sys.dont_write_bytecode = True
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import numpy as np  # noqa: E402

from textphase import entropy, fits, mi, periodicity, phase, structure, symbols, synth  # noqa: E402

DS = mi.log_grid(1000)
FREQS = [5, 3, 2, 1, 1]
H_TRUE = -sum(p / 12 * math.log2(p / 12) for p in FREQS)


def two_state(n, stay, rng):
    flips = rng.random(n) >= stay
    return np.cumsum(flips) % 2


def test_iid_entropy_and_gas():
    rng = np.random.default_rng(1)
    s = synth.iid(FREQS, 100_000, rng)
    assert abs(entropy.block_rate(s)[0] - H_TRUE) < 0.02
    assert abs(entropy.ppm_rate(s, 5)[0] - H_TRUE) < 0.15  # PPM pays a learning cost on short texts
    assert entropy.lz_rate(s) > H_TRUE  # a compressor is an upper bound
    p = phase.profile(s, 5, rng, ds=DS)
    assert p["decay"]["range"] == 0 and p["phase"] == "gas"
    assert p["periodicity"]["peak"] < 0.05


def test_priming_matches_continuous_coding():
    rng = np.random.default_rng(8)
    s = synth.iid(FREQS, 20_000, rng)
    whole = entropy.ppm_codelengths(s, 5)[10_000:].mean()
    primed = entropy.ppm_codelengths(s[10_000:], 5, tables=entropy.ppm_prime(s[:10_000], 5)).mean()
    assert abs(whole - primed) < 0.01


def test_markov_decays_exponentially_with_known_length():
    rng = np.random.default_rng(2)
    s = two_state(100_000, 0.9, rng)  # correlation lambda = 0.8 per step, I(d) ~ lambda^(2d)
    p = phase.profile(s, 2, rng, ds=DS)
    f = p["decay"]["fit"]
    assert f["best"] == "exp" and p["phase"] == "liquid"
    xi_true = -1 / (2 * math.log(0.8))
    assert abs(f["models"]["exp"]["xi"] - xi_true) / xi_true < 0.3


def test_periodic_is_crystal_at_its_period():
    rng = np.random.default_rng(3)
    s = synth.periodic(rng.integers(0, 20, 37), 100_000, 0.05, rng, 20)
    p = phase.profile(s, 20, rng, ds=DS)
    assert p["periodicity"]["period"] == 37 and p["periodicity"]["peak"] > 0.9
    assert p["phase"] == "crystal" and p["repeat_share"] > 0.3


def test_tree_grammar_is_critical():
    rng = np.random.default_rng(4)
    s = synth.tree_grammar(17, 8, 0.92, rng)
    p = phase.profile(s, 8, rng, ds=DS)
    assert p["phase"] == "critical" and p["decay"]["fit"]["daic_exp_minus_power"] > 10
    assert p["decay"]["range"] >= 500


def test_shuffle_destroys_order():
    rng = np.random.default_rng(5)
    s = two_state(50_000, 0.95, rng)
    d = phase.decay(synth.shuffled(s, rng), DS, rng, 2)
    assert d["range"] == 0


def test_susceptibility_flat_for_iid_and_growing_for_correlated():
    rng = np.random.default_rng(6)
    cl = rng.exponential(1.0, 200_000)
    a, b = entropy.susceptibility(cl, 100), entropy.susceptibility(cl, 2000)
    assert abs(a - 1) < 0.2 and abs(b - 1) < 0.5
    slow = np.repeat(rng.normal(0, 1, 2000), 100)  # blocks of 100 equal values
    assert entropy.susceptibility(slow, 1000) > 5 * entropy.susceptibility(slow, 10)


def test_fits_recover_power_exponent():
    d = np.arange(1, 400)
    f = fits.fit_all(d, 0.3 * d ** -0.7)
    assert f["best"] == "power" and abs(f["models"]["power"]["alpha"] - 0.7) < 1e-6
    g = fits.fit_all(d, 0.3 * np.exp(-d / 25))
    assert g["best"] == "exp" and abs(g["models"]["exp"]["xi"] - 25) < 1e-6


def test_comb_score_finds_line_period():
    rng = np.random.default_rng(7)
    ds = np.arange(1, 200)
    y = 0.01 / ds + 0.002 * (np.mod(ds, 40) == 0) + rng.normal(0, 1e-5, len(ds))
    assert periodicity.comb_score(ds, y, 40) > 0.0015
    assert abs(periodicity.comb_score(ds, y, 33)) < 0.0005


def test_symbols_and_structure():
    s = symbols.chars("Ab,  c\n\n1.")
    assert s.tolist() == [0, 1, 38, 36, 2, 36, 27, 37]
    assert structure.rhyme_key("night") == structure.rhyme_key("delight") == "ight"
    seq, _ = structure.rhyme_classes(["the night", "a sea", "delight", "my tea"] * 50)
    c = structure.class_corr(seq, [1, 2, 3, 4])
    assert c[1] > 0.4 and c[0] < 0 and c[3] > 0.4
    stream, arcs = structure.clause_depth("He said that the dog which ran, was red. It slept.")
    assert stream.max() == 2 and len(arcs) == 2
    st = structure.statements("Every lattice repeats here. A lattice repeats forever now. Rivers wander off slowly.")
    assert structure.backref_distances(st).tolist() == [1, 1]
    names, dist = structure.code_function("def f():\n    return 1\n\n\nx = f()\nprint(x)\n")
    assert names == ["f", "print"] and dist.tolist() == [4]
    assert "def" in structure.code_form("def f(): pass\n")


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print("ok", t.__name__)
    print(f"{len(tests)} passed")
