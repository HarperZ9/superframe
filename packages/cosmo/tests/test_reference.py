# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The emulator table against CAMB: a transcription error in the emulator port would not land this close."""
import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from cosmolab import reference  # noqa: E402

CAMB = json.loads((reference.DATA / "camb_reference.json").read_text())


def test_cosmicemu_table_agrees_with_camb_halofit_at_halofits_accuracy():
    k = np.array(CAMB["k"])
    s = (k > 0.01) & (k < 5.0)
    for z in ("0", "1"):
        r = reference.cosmicemu(k[s], float(z)) / np.array(CAMB["halofit"][z])[s]
        assert np.all(np.abs(r - 1) < 0.045)          # measured: within 4 percent, emulator below at k > 0.2


def test_cosmicemu_boost_tends_to_one_on_large_scales():
    for z in (0.0, 1.0):
        b = reference.cosmicemu_boost(np.array([0.005, 0.01, 0.02]), z)
        assert np.all(np.abs(b - 1) < 0.02)
