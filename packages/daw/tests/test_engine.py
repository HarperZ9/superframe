# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The engine's impact scene (engine/impacts.mjs) and the workstation agree on the physics: a bar's fundamental
from the engine equals the modal core's, bounces follow free fall, and each impact is weaker by the restitution."""
import json
import math
import shutil
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw.shapes_1d import Bar  # noqa: E402
from measured import load  # noqa: E402

SCRIPT = Path(__file__).resolve().parents[1] / "engine" / "impacts.mjs"
SCENE = [("steel_mild", 0.20, 0.008, 0.8), ("aluminium", 0.25, 0.012, 1.1), ("steel_mild", 0.16, 0.006, 0.5),
         ("aluminium", 0.32, 0.012, 1.4)]


@pytest.fixture(scope="module")
def events():
    if not shutil.which("node"):
        pytest.skip("no node")
    out = subprocess.run(["node", str(SCRIPT), "--dry"], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


def test_engine_bars_ring_at_the_modal_core_fundamental(events):
    for i, (mat, length, h, _) in enumerate(SCENE):
        f1 = [e["f1"] for e in events if e["bar"] == i][0]
        assert abs(f1 / Bar(M.material(mat), length, h).modes(1).freqs[0] - 1) < 1e-9
        eta = [e["eta"] for e in events if e["bar"] == i][0]
        assert eta == M.material(mat).eta


def test_bounces_follow_free_fall_and_restitution(events):
    g = [r["value"] for r in load("codata2022")["rows"] if r["quantity"] == "standard acceleration of gravity"][0]
    for i, (_, _, _, drop) in enumerate(SCENE):
        hits = [e for e in events if e["bar"] == i]
        assert abs(hits[0]["t"] - (math.sqrt(2 * drop / g) + 0.15 * i)) < 1e-12
        amps = np.array([e["amp"] for e in hits])
        assert np.allclose(amps[1:] / amps[:-1], 0.6)
        v = math.sqrt(2 * g * drop) * 0.6
        assert abs(hits[1]["t"] - hits[0]["t"] - 2 * v / g) < 1e-12
