# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""data/materials.json and eda/data/board-materials.json are generated from packages/materials.

The diagram pages inline these files, so they stay in the repo. Each is pinned by sha256 to a fresh export
from the materials package; a change to the package that is not re-exported here fails this test.
Re-export with: python -I packages/diagram/build/materials_export.py and eda/build/board_materials.py.
"""
import hashlib
import importlib.util
from pathlib import Path

PKG = Path(__file__).resolve().parents[1]


def _load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _sha(text):
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def test_materials_json_is_a_fresh_export():
    m = _load(PKG / "build" / "materials_export.py", "diagram_materials_export")
    fresh = m.text(m.build())
    assert _sha((PKG / "data" / "materials.json").read_text(encoding="utf-8")) == _sha(fresh)


def test_board_materials_json_is_a_fresh_export():
    b = _load(PKG / "eda" / "build" / "board_materials.py", "diagram_board_materials")
    fresh = b.text(b.build())
    assert _sha((PKG / "eda" / "data" / "board-materials.json").read_text(encoding="utf-8")) == _sha(fresh)


def test_the_pin_detects_a_changed_value():
    m = _load(PKG / "build" / "materials_export.py", "diagram_materials_export_planted")
    out = m.build()
    out["materials"]["copper"]["sigma"]["value"] *= 1.001
    assert _sha(m.text(out)) != _sha((PKG / "data" / "materials.json").read_text(encoding="utf-8"))
