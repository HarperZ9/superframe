# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The VST3 bundle (vst3/vst3.c) played by a VST3 host (vst3/host_vst3.c) against the CLAP bundle.

Known answers: the factory lists the three instruments as audio modules with no latency; each one's VST3 output
equals its CLAP output bit for bit, with note-ons and note-offs, at any host block size. Planted control: notes
one sample late through VST3 must differ from the CLAP output. Skips with the reason where buildc or a C compiler
is missing; the CI job that builds buildc must not skip.
"""
import json
import os
import subprocess
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import clap_build, native, vst3_build  # noqa: E402

FS = 48000
NAMES = ["superframe bars", "superframe piano", "superframe organ"]
EVENTS = ["100:69:1.0:0:0", "600:81:0.5:0:0", "9000:69:0:0:1", "9000:60:0.75:0:0", "20000:57:0.25:0:0",
          "30000:60:0:0:1", "30000:81:0:0:1"]


@pytest.fixture(scope="module")
def built(tmp_path_factory):
    why = clap_build.unavailable() or native.unavailable()
    if why and os.environ.get("DAW_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    root = tmp_path_factory.mktemp("vst3")
    return vst3_build.build(root / "vst3"), clap_build.build(root / "clap")


def run(host, plugin, index, events, block, tag):
    out = Path(plugin).parent / f"out-{tag}-{index}-{block}.f32"
    args = [str(host), f"{plugin}#{index}", str(out), str(block), "1.0", str(FS), *events]
    r = subprocess.run(args, capture_output=True, text=True, check=True)
    return np.fromfile(out, dtype=np.float32), json.loads(r.stdout)


@pytest.mark.parametrize("index", [0, 1, 2])
def test_vst3_equals_clap_bit_for_bit(built, index):
    (module, vhost), (clap, chost) = built
    y, info = run(vhost, module, index, EVENTS, 256, "v")
    want, _ = run(chost, clap, index, EVENTS, 256, "c")
    assert info["name"] == NAMES[index] and info["latency"] == 0
    assert np.any(want != 0) and y.tobytes() == want.tobytes()
    late = [":".join([str(int(e.split(":")[0]) + 1)] + e.split(":")[1:]) for e in EVENTS]
    assert run(vhost, module, index, late, 256, "late")[0].tobytes() != want.tobytes()   # planted: one sample late


def test_vst3_block_size_changes_no_bit(built):
    (module, vhost), _ = built
    runs = [run(vhost, module, 2, EVENTS, b, "b")[0] for b in (64, 1000, 4096)]
    for y in runs[1:]:
        assert y.tobytes() == runs[0].tobytes()


def test_module_is_in_the_vst3_bundle_layout(built):
    (module, _), _ = built
    parts = Path(module).parts
    assert parts[-4] == "superframe.vst3" and parts[-3] == "Contents"
    assert parts[-2] in ("x86_64-win", "x86_64-linux")
