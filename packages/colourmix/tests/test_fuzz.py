# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The fuzz target runs in a child process, so a trap or crash in a kernel shows as a bad exit code."""
import json
import subprocess
import sys
from pathlib import Path

import pytest

from colourmix import fuzz, reference

PKG = Path(__file__).resolve().parents[1]


def test_fuzz_run_is_clean(kernels):
    r = subprocess.run([sys.executable, "-m", "colourmix.fuzz", "60000"], cwd=PKG, capture_output=True, text=True)
    assert r.returncode == 0, r.stdout[-400:] + r.stderr[-400:]
    out = json.loads(r.stdout)
    assert out["seed"] == fuzz.FUZZ_SEED and out["cases"] == 60000
    assert out["mismatches"] == 0 and out["accepted"] + out["rejected"] == 60000
    assert out["accepted"] > 1000 and out["rejected"] > 1000       # both paths are exercised
    assert out["malformed_tried"] == out["malformed_refused"] == 448


def test_the_reference_refuses_malformed_values():
    assert fuzz.malformed(reference) == (448, 448)


def test_a_value_outside_64_bits_is_a_value_error():
    with pytest.raises(ValueError):
        reference.mayer_count(1 << 63)
    with pytest.raises(TypeError):
        reference.mayer_count(True)
