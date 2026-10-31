# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""lattice.stats.bh against the shared stats golden vectors (packages/_vectors/stats_vectors.json).

The vectors also hold Holm, Bonferroni, the binomial upper tail and Wilson; lattice.stats has no
copy of those, so only the BH rows apply. The bootstrap helpers draw from a seeded generator and
have no golden vector yet.
"""
import json
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))

from lattice import stats as St  # noqa: E402

VECTORS = json.loads((HERE.parents[2] / "_vectors" / "stats_vectors.json").read_text(encoding="utf-8"))
FAMILIES = VECTORS["families"]


def test_vector_file_shape():
    assert VECTORS["schema"] == "stats-vectors/1"
    assert len(FAMILIES) >= 8


@pytest.mark.parametrize("fam", FAMILIES, ids=[f["id"] for f in FAMILIES])
def test_bh_reject_flags_match_vectors(fam):
    names = [f"t{i}" for i in range(len(fam["p"]))]
    out = St.bh(dict(zip(names, fam["p"])), q=fam["alpha"])
    assert [out[n]["reject"] for n in names] == fam["bh"]


@pytest.mark.parametrize("fam", [f for f in FAMILIES if f["p"]], ids=[f["id"] for f in FAMILIES if f["p"]])
def test_bh_adjusted_p_is_monotone_in_raw_p(fam):
    names = [f"t{i}" for i in range(len(fam["p"]))]
    out = St.bh(dict(zip(names, fam["p"])), q=fam["alpha"])
    pairs = sorted((out[n]["p"], out[n]["p_bh"]) for n in names)
    adj = [a for _, a in pairs]
    assert adj == sorted(adj)
    assert all(a >= p for p, a in pairs)
