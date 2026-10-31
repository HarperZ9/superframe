# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Blends (reproducibility, dominance, intact regions) and audio fingerprint known answers."""
import json

import numpy as np
from PIL import Image

import fixtures as F
from cleanroom import audiofeat, gate, media
from cleanroom.blend import run as blend_run
from cleanroom.vault import sha256_file


def _out(world, name):
    world["out"].mkdir(exist_ok=True)
    return str(world["out"] / name)


def test_ten_source_blend_reproduces_bit_identically(world):
    srcs = [{"ref": f"vault:{world['shas'][f'pic{i}.md'][0]}", "weight": 1 + i} for i in range(3)]
    sha = world["shas"]["pic0.md"][0]
    srcs.append({"ref": f"spec:spec-{sha[:16]}-v1", "weight": 0.5, "channels": {"colour": 3.0}})
    for k in range(6):
        srcs.append({"ref": "gen:", "params": {"prim_count": 5 + 3 * k, "hue_cos": np.cos(k), "hue_sin": np.sin(k)},
                     "seed": k, "weight": 0.3 + 0.1 * k, "detune": 0.1 * k, "opacity": 0.5 + 0.05 * k})
    assert len(srcs) == 10
    R = {"seed": 21, "size": 192, "output": _out(world, "ten.png"), "sources": srcs,
         "knobs": {"marble": 0.6, "lattice": "vogel", "lattice_cell": 5, "reverb": 0.4, "reverb_passes": 2,
                   "temperature": 0.5, "layer_mix": 0.4, "attack": 0.2, "release": 0.1, "rhythm_gain": 0.3,
                   "material": "copper", "material_mix": 0.3, "detune": 0.2}}
    out, lin = blend_run(R, world["root"])
    first = sha256_file(out)
    with open(out + ".recipe.json", encoding="utf-8") as f:
        resolved = json.load(f)
    assert all(s["sha256"] for s in resolved["sources"]) and resolved["seed"] == 21
    assert resolved["knobs"]["material"] == "copper"
    out2, _ = blend_run(resolved, world["root"])
    assert sha256_file(out2) == first
    assert len(lin["blend"]["sources"]) == 10
    for s in lin["blend"]["sources"]:
        assert "slider_weight_form" in s and "measured_attribution" in s


def test_intact_region_fails_with_three_sources(world):
    shas = [world["shas"][f"pic{i}.md"][0] for i in range(3)]
    R = {"seed": 3, "size": 256, "output": _out(world, "intact3.png"),
         "sources": [{"ref": f"vault:{shas[0]}", "order": 2, "attack": 0.55},
                     {"ref": f"vault:{shas[1]}", "order": 0}, {"ref": f"vault:{shas[2]}", "order": 1}],
         "knobs": {"layer_mix": 1.0, "texture_mix": 0.0}}
    out, lin = blend_run(R, world["root"])
    d = gate.check(out, world["root"])
    failed = {(c["metric"]) for c in d["report_failed"]}
    assert "patch_region_share" in failed
    lineage_patch = [c["metrics"]["patch"]["largest_region_share"] for c in
                     __import__("json").load(open(d["report_stored_at"]))["comparisons"]
                     if c["relation"] == "lineage" and c["vault_sha256"] == shas[0]][0]
    assert lineage_patch > 0.3  # the top layer covers x > 0.55 at full opacity
    assert not d["allowed"]


def test_99_to_1_blend_with_intact_region_is_caught(world):
    shas = [world["shas"][f"pic{i}.md"][0] for i in range(2)]
    R = {"seed": 4, "size": 256, "output": _out(world, "ninety_nine.png"),
         "sources": [{"ref": f"vault:{shas[0]}", "weight": 99}, {"ref": f"vault:{shas[1]}", "weight": 1}],
         "knobs": {"texture_mix": 0.0}}
    out, lin = blend_run(R, world["root"])
    d = gate.check(out, world["root"])
    failed = {c["metric"] for c in d["report_failed"]}
    assert "patch_region_share" in failed and "max_measured_attribution" in failed
    assert not d["allowed"]


def test_balanced_heavy_blend_passes_checks(world):
    shas = [world["shas"][f"pic{i}.md"][0] for i in range(3)]
    R = {"seed": 8, "size": 256, "output": _out(world, "balanced.png"),
         "sources": [{"ref": f"vault:{s}"} for s in shas],
         "knobs": {"marble": 1.0, "swirl": 0.7, "lattice": "hex", "lattice_cell": 7, "detune": 0.6,
                   "reverb": 0.5, "reverb_passes": 2}}
    out, lin = blend_run(R, world["root"])
    d = gate.check(out, world["root"])
    assert d["report_passes_all"], d["report_failed"]
    assert d["report_checks_run"] >= 10
    assert max(s["measured_attribution"] for s in lin["blend"]["sources"]) <= 0.5


def test_fingerprint_known_answers(world, tmp_path):
    a = F.tone_wav(str(tmp_path / "a.wav"), seconds=12, seed=1)
    b = F.tone_wav(str(tmp_path / "b.wav"), seconds=12, seed=2)
    xa, sr = media.read_wav(a)
    xb, _ = media.read_wav(b)
    fa, fb = audiofeat.fingerprint(xa, sr), audiofeat.fingerprint(xb, sr)
    assert audiofeat.longest_match_seconds(fa, fa) > 11
    assert audiofeat.longest_match_seconds(fa, fb) < 3
    spliced = np.concatenate([xb[:sr * 3], xa[sr * 2:sr * 8], xb[sr * 3:sr * 6]])
    sec = audiofeat.longest_match_seconds(audiofeat.fingerprint(spliced, sr), fa)
    assert 5 < sec < 7


def test_region_search_controls():
    """False-success control: unrelated pictures share no region. Regression: a copy superposed on
    its own mirror image (the real 99 to 1 failure found on 2026-10-30) is still found."""
    from cleanroom import perceptual
    a = media.image_array(F.textured(31), 320)
    b = media.image_array(F.textured(32), 320)
    assert perceptual.copied_region(a, b)["largest_region_share"] == 0.0
    big = np.asarray(F.textured(31), float) / 255
    ghost = 0.5 * big + 0.5 * big[:, ::-1]
    ghost = ghost[40:472, 40:472] * 0.6 + 0.4  # cropped and washed out
    reg = perceptual.copied_region(a, media.image_array(ghost, 320))
    assert reg["largest_region_share"] > 0.03
