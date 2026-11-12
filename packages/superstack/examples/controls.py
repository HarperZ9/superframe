# SPDX-License-Identifier: FSL-1.1-MIT
"""False-success controls: show the check fails when it should.

1. Wrong scene: the Python backend renders AO radius 1.5 instead of 2. Must be refuted.
2. One flipped byte in the reference frame. Must read DRIFT (and sits inside tolerance).
3. Wrong sound: one voice one sample late. Must be refuted.
Exit 1 if any control does not fail as stated.
"""
from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE / "pixels"))
sys.path.insert(0, str(HERE / "sound"))
import check  # noqa: E402
import superstack as ss  # noqa: E402
import sound_ir  # noqa: E402

OUT = HERE / "out"


def main(skip_render: bool = False):
    res = {}
    ref = check.raw_reference(check.RECORDED)
    if not skip_render:
        import py_backend  # needs numpy
        scene = json.loads((HERE / "pixels" / "scene.json").read_text(encoding="utf-8"))
        bad = copy.deepcopy(scene)
        bad["ao"]["radius"] = 1.5
        frame, ao, mask = py_backend.render(bad)
        res["wrong_ao_radius"] = check.reconcile_pixels(ref, {"frame": frame.tobytes(), "ao": ao.astype("<f4").tobytes(),
                                                              "mask": mask.tobytes()})
    flipped = bytearray(ref["frame"])
    flipped[(128 * 256 + 128) * 3] ^= 1
    res["one_byte_flipped"] = check.reconcile_pixels(ref, {**ref, "frame": bytes(flipped)})
    sound = json.loads((HERE / "sound" / "sound.json").read_text(encoding="utf-8"))
    shifted = copy.deepcopy(sound)
    shifted["step_samples"] += 1
    pcm_ref = ss.quantize_s16(sound_ir.render(sound))
    res["sound_one_sample_late"] = ss.reconcile_pcm_s16(pcm_ref, ss.quantize_s16(sound_ir.render(shifted)))
    OUT.mkdir(exist_ok=True)
    (OUT / "controls.json").write_text(json.dumps(res, indent=1, sort_keys=True), encoding="utf-8")
    want = {"wrong_ao_radius": ("DRIFT", "refuted"), "one_byte_flipped": ("DRIFT", "verified"),
            "sound_one_sample_late": ("DRIFT", "refuted")}
    ok = True
    for k, v in res.items():
        got = (v["identity"], v["tolerance"]["verdict"])
        good = got == want[k]
        ok &= good
        print(f"control {k:24} {got[0]:5} {got[1]:9} {'as expected' if good else 'UNEXPECTED, want ' + str(want[k])}")
    return ok


if __name__ == "__main__":
    sys.exit(0 if main("--no-render" in sys.argv) else 1)
