# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The engine's impact scene (engine/impacts.mjs over rooms/core/data/impact-scene.js) and the workstation agree
on the physics: each bar's fundamental equals the modal core's, balls land where the geometry puts them, bounces
follow free fall and the restitution, a ball over no bar makes no sound, and sound reaches the listener after
r / c with 1 / r spreading."""
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
SCENE_JS = Path(__file__).resolve().parents[2] / "rooms" / "core" / "data" / "impact-scene.js"


def node_json(code):
    out = subprocess.run(["node", "--input-type=module", "-e", code], capture_output=True, text=True, check=True)
    return json.loads(out.stdout)


@pytest.fixture(scope="module")
def world():
    if not shutil.which("node"):
        pytest.skip("no node")
    events = json.loads(subprocess.run(["node", str(SCRIPT), "--dry"], capture_output=True, text=True,
                                       check=True).stdout)
    scene = node_json(f"import {{ IMPACT_SCENE }} from '{SCENE_JS.as_uri()}'; console.log(JSON.stringify(IMPACT_SCENE))")
    return events, scene


def test_engine_bars_ring_at_the_modal_core_fundamental(world):
    events, scene = world
    for e in events:
        bar = scene["bars"][e["bar"]]
        want = Bar(M.material(bar["material"]), bar["length"], bar["thickness"]).modes(1).freqs[0]
        assert abs(e["f1"] / want - 1) < 1e-9 and e["eta"] == M.material(bar["material"]).eta


def test_balls_land_where_the_geometry_says_and_bounce_by_free_fall(world):
    events, scene = world
    g = [r["value"] for r in load("codata2022")["rows"] if r["quantity"] == "standard acceleration of gravity"][0]
    assert {e["ball"] for e in events} == {0, 1, 2, 3}                       # ball 4 is over no bar: silent
    for j in range(4):
        hits = sorted((e for e in events if e["ball"] == j), key=lambda e: e["t"])
        ball, bar = scene["balls"][j], scene["bars"][hits[0]["bar"]]
        assert abs(hits[0]["x"] - (ball["x"] - bar["x0"]) / bar["length"]) < 1e-12
        drop = ball["y"] - (bar["y"] + bar["thickness"] / 2 + ball["radius"])
        assert abs(hits[0]["t"] - (math.sqrt(2 * drop / g) + 0.15 * j)) < 1e-12
        amps = np.array([e["amp"] for e in hits])
        assert np.allclose(amps[1:] / amps[:-1], 0.6)


def test_sound_reaches_the_listener_after_its_flight(world):
    events, scene = world
    c = M.air_speed(scene["temperatureC"])
    for e in events:
        assert abs(e["heard"] - e["t"] - e["r"] / c) < 1e-9
        assert abs(e["kind"] - (1 + 0.999 * e["x"])) < 1e-12
