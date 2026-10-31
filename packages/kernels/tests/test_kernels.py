# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The canonical form runs everywhere. The full equivalence check needs PyTorch with CUDA, so it skips on CI."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from kcore import canonical  # noqa: E402

VECTORS = json.loads((ROOT.parent / "_vectors" / "canonical_vectors.json").read_text(encoding="utf-8"))


def test_the_canonical_form_answers_every_vector():
    assert len(VECTORS["cases"]) >= 30, "the vector file moved or its shape changed"
    for case in VECTORS["cases"]:
        assert canonical.sha256(case["input"]) == case["sha256"], case["id"]


@pytest.mark.skipif(bool(os.environ.get("CI")), reason="the check needs PyTorch with CUDA, which GitHub CI does not have")
def test_kernels_check_passes_on_a_cuda_machine():
    torch = pytest.importorskip("torch", reason="the check needs PyTorch")
    if not torch.cuda.is_available():
        pytest.skip("no CUDA device")
    run = subprocess.run([sys.executable, "-B", str(ROOT / "kernels.py"), "check", "--no-receipts"],
                         capture_output=True, text=True)
    assert run.returncode == 0, run.stdout[-2000:] + run.stderr[-2000:]
