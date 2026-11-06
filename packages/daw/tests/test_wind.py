# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Wind against the measured storm recordings: the same spectrum estimator on both, slope and peak."""
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "measured" / "build"))
from daw import wind as W  # noqa: E402
from measured import load  # noqa: E402
import b_storm  # noqa: E402

FS = b_storm.FS
STORMS = {r["id"]: r for r in load("storm_spectra")["rows"]}


def test_noise_holds_each_storm_slope():
    for rid in ("storm.ocean_storm", "storm.rain_thunder"):
        beta = STORMS[rid]["beta"]
        y = W.coloured_noise(FS * 30, FS, beta, np.random.default_rng(1))
        assert abs(b_storm.spectrum_stats(y)["beta"] - beta) < 0.1, rid
    white = np.random.default_rng(2).standard_normal(FS * 30)                  # planted: white noise
    assert abs(b_storm.spectrum_stats(white)["beta"] - STORMS["storm.ocean_storm"]["beta"]) > 1.0


def test_howling_wind_slope_and_its_branch_tone():
    rec = STORMS["storm.howling_wind_spruce"]
    y = W.wind(30.0, FS, rec["beta"], np.random.default_rng(3))
    got = b_storm.spectrum_stats(y)
    assert abs(got["beta"] - rec["beta"]) < 0.1
    assert abs(got["peaks_hz"][0] / rec["peaks_hz"][0] - 1) < 0.03          # 187.5 Hz: St U / d
    off = b_storm.spectrum_stats(W.wind(30.0, FS, rec["beta"], np.random.default_rng(3), diameter=0.01))
    assert abs(off["peaks_hz"][0] / rec["peaks_hz"][0] - 1) > 0.5             # planted: a twig half as thick
