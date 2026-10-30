# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The kernel contract, run as a test: every kernel matches its reference bit for bit on the CPU paths
present (CUDA too when torch with CUDA is installed), passes its known answers, and its controls catch a
1-ulp perturbation. Nothing is written: receipts stay off and kernels.json is only read.

Run: python -B -m pytest -q -p no:cacheprovider tests   (from packages/kernels)
"""
import json
from pathlib import Path

import pytest

import advect_diffuse.kernel as K_ad
import blend.kernel as K_bl
import lattice_resample.kernel as K_lr
import spectral_shade.kernel as K_ss
from kcore.check import check_kernel

ROOT = Path(__file__).resolve().parents[1]
MODULES = [K_bl, K_ad, K_lr, K_ss]
CONTRACT = ["spec", "reference", "cpu_fast", "gpu_fast", "equivalence", "benchmark", "receipt", "buildlang_note"]


@pytest.mark.parametrize("mod", MODULES, ids=lambda m: m.NAME)
def test_kernel_meets_contract(mod):
    res = check_kernel(mod, threads=2, write_receipts=False)
    assert res["mode"] == "bit-identical"
    for dev, v in res["vs_reference"].items():
        assert v["pass"] and v["max_ulp"] == 0, (dev, v)
    for pair, v in res["cross_device"].items():
        assert v["pass"] and v["receipt_outputs_equal"], (pair, v)
    assert res["known_answers"], "a kernel needs at least one known answer"
    assert all(k["pass"] for k in res["known_answers"]), res["known_answers"]
    assert res["controls"]["one_ulp_perturbation_detected"] is True
    assert all(v["caught"] for v in res["controls"].get("drift_variants", [])), res["controls"]
    assert res["pass"] is True


def test_registry_lists_every_kernel_with_the_whole_contract():
    reg = json.loads((ROOT / "kernels.json").read_text(encoding="utf-8"))
    assert reg["contract"] == CONTRACT
    names = {k["name"] for k in reg["kernels"]}
    assert names == {m.NAME for m in MODULES}
    for k in reg["kernels"]:
        assert set(CONTRACT) <= set(k["contract"]) | {"equivalence"}, k["name"]
        assert (ROOT / k["path"] / "SPEC.md").exists(), k["name"]


def test_control_a_flipped_output_bit_is_not_equal():
    """The equality the contract relies on must be able to fail (false-success control)."""
    import numpy as np
    from kcore.check import _same
    a = np.linspace(0, 1, 64, dtype=np.float32)
    b = a.copy()
    b.view(np.uint32)[7] ^= 1
    assert not _same(K_bl, {"x": a}, {"x": b})
