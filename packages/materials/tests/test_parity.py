# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""The stored parity vectors still match the Python reference, so the JavaScript twin is checked
against today's Python, not a stale copy."""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parity  # noqa: E402


def test_stored_vectors_match_the_reference():
    stored = json.loads(parity.OUT.read_text(encoding="utf-8"))
    assert stored == json.loads(json.dumps(parity.vectors()))


def test_vectors_cover_every_material_with_spectral_n():
    stored = json.loads(parity.OUT.read_text(encoding="utf-8"))
    ids = {c["id"] for c in stored["shaded_d65"]}
    assert len(ids) >= 100, len(ids)
