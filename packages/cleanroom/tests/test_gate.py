# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Lineage labels, the difference report, release notes and the publish gate."""
import io
import os
import shutil
import zipfile

import numpy as np
from PIL import Image

import fixtures as F
from cleanroom import gate, lineage, release
from cleanroom.blend import run as blend_run
from cleanroom.config import use_libs
from cleanroom.difference import HONESTY, text_metrics
from cleanroom.difference import run as report_run
from cleanroom.lineage import Workspace
from cleanroom.vault import sha256_file

use_libs("design-parts")
from design_parts import generate  # noqa: E402


def _out(world, name):
    d = world["out"]
    d.mkdir(exist_ok=True)
    return str(d / name)


def _copy_derived(world, name, im, shas):
    ws = Workspace(world["root"])
    for s in shas:
        ws.open_copy(s)
    ws.transform("test-edit")
    p = _out(world, name)
    im.save(p, "PNG")
    ws.write(p)
    return p


def test_exact_and_embedded_copies_are_refused(world):
    src = world["pics"][0][1]
    exact = _out(world, "exact.jpg")
    shutil.copyfile(src, exact)
    d = gate.check(exact, world["root"])
    assert not d["allowed"] and d["exact_vault_copy"]
    padded = _out(world, "padded.bin")
    with open(padded, "wb") as f, open(src, "rb") as s:
        f.write(b"header" * 100 + s.read() + b"trailer")
    d = gate.check(padded, world["root"])
    assert not d["allowed"] and d["embedded_vault_copies"] == [world["shas"]["pic0.md"][0]]
    z = _out(world, "export.zip")
    with zipfile.ZipFile(z, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.write(src, "assets/hero.jpg")
    d = gate.check(z, world["root"])
    assert not d["allowed"] and d["embedded_vault_copies"]


def test_workspace_labels(world):
    ws = Workspace(world["root"])
    sha = world["shas"]["pic1.md"][0]
    ws.open_spec(f"spec-{sha[:16]}-v1")
    assert ws.label == lineage.SPEC
    ws.open_copy(sha)
    assert ws.label == lineage.COPY


def test_light_edit_fails_patch_match_even_with_note(world):
    im, _ = world["pics"][0]
    sha = world["shas"]["pic0.md"][0]
    p = _copy_derived(world, "light.png", F.light_edit(im), [sha])
    rep = report_run(p, world["root"])
    assert rep["honesty"] == HONESTY
    lin = [c for c in rep["comparisons"] if c["relation"] == "lineage"][0]
    patch = [c for c in lin["checks"] if c["metric"] == "patch_region_share"][0]
    assert patch["value"] > 0.5 and not patch["pass"]
    release.record(world["root"], sha256_file(p), rep["report_sha256"], "tester", "known-answer test")
    d = gate.check(p, world["root"])
    assert not d["allowed"]
    assert any("difference check" in r for r in d["reasons"])


def _heavy_recipe(world, name, weights=(1, 1, 1)):
    shas = [world["shas"][f"pic{i}.md"][0] for i in range(3)]
    return {"seed": 7, "size": 256, "output": _out(world, name),
            "sources": [{"ref": f"vault:{s}", "weight": w} for s, w in zip(shas, weights)],
            "knobs": {"marble": 1.0, "swirl": 0.8, "marble_tines": 7, "lattice": "hex", "lattice_cell": 6,
                      "detune": 0.5, "reverb": 0.5, "reverb_passes": 2, "temperature": 0.3}}


def test_copy_derived_needs_note_then_passes(world):
    out, lin = blend_run(_heavy_recipe(world, "heavy.png"), world["root"])
    assert lin["label"] == lineage.COPY and lin["default_route"] == "internal"
    d = gate.check(out, world["root"])
    assert d["report_passes_all"], d["report_failed"]
    assert d["report_checks_run"] >= 3 * 3 + 1  # three lineage pictures, three image checks each, dominance
    assert not d["allowed"] and "no release note" in " ".join(d["reasons"])
    release.record(world["root"], sha256_file(out), d["report_sha256"], "tester", "heavy transform, checks pass")
    d = gate.check(out, world["root"])
    assert d["allowed"], d["reasons"]


def test_spec_derived_generated_piece_passes(world):
    ws = Workspace(world["root"])
    sha = world["shas"]["pic2.md"][0]
    spec = ws.open_spec(f"spec-{sha[:16]}-v1")
    from cleanroom.blend import spec_params
    a = generate.render(spec_params(spec), size=384, seed=3)
    p = _out(world, "from_spec.png")
    Image.fromarray((a * 255).astype(np.uint8)).save(p)
    lin = ws.write(p)
    assert lin["label"] == lineage.SPEC and lin["default_route"] == "public"
    d = gate.check(p, world["root"])
    assert d["allowed"], d
    assert d["report_sha256"] and d["report_checks_run"] >= 3


def test_internal_route_records_but_does_not_refuse(world):
    im, _ = world["pics"][0]
    p = _copy_derived(world, "light_internal.png", F.light_edit(im), [world["shas"]["pic0.md"][0]])
    d = gate.check(p, world["root"], route="internal")
    assert d["allowed"] and d["reasons"]


def test_text_verbatim_run_fails_and_short_overlap_passes(world):
    sha = world["shas"]["post.md"][0]
    planted = "Notes. while the tide turns slowly over the mudflat and the reeds lean east. End."
    m = text_metrics(planted, world["text"], 5)
    assert m["longest_common_run_words"] == 13
    p = _out(world, "essay.txt")
    with open(p, "w", encoding="utf-8") as f:
        f.write(planted)
    ws = Workspace(world["root"])
    ws.open_copy(sha)
    ws.write(p)
    rep = report_run(p, world["root"])
    failed = {c["metric"] for c in rep["failed"]}
    assert "longest_common_run_words" in failed
    ok = "A heron at dusk. The tide turns, and salt hangs in the air above the grey water."
    assert text_metrics(ok, world["text"], 5)["longest_common_run_words"] <= 7


def test_lineage_report_detects_changed_output(world):
    p = _copy_derived(world, "changed.png", F.textured(99), [world["shas"]["pic1.md"][0]])
    with open(p, "ab") as f:
        f.write(b"\0")
    assert lineage.report(p, world["root"])["matches_file"] is False
    assert not gate.check(p, world["root"])["allowed"]
