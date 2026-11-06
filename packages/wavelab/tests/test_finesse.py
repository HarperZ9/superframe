# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for finesse: Mathieu tongues, the parametric threshold, the Faraday half frequency, phased
focusing and time-reversal refocusing, each with a control that must fail."""
import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from wavelab import finesse, timerev  # noqa: E402


@pytest.mark.parametrize("q", [0.1, 0.3])
def test_first_mathieu_tongue(q):
    lo, hi = finesse.tongue_edges(q)
    slo, shi = finesse.tongue_series(q)
    tol = 2e-6 if q < 0.2 else 1e-4
    assert lo == pytest.approx(slo, abs=tol) and hi == pytest.approx(shi, abs=tol)
    assert finesse.unstable(1.0, q) and not finesse.unstable(hi + 0.05, q)


def test_damped_threshold_is_four_lambda_over_omega():
    for lam in (0.005, 0.01):
        assert finesse.threshold(lam) == pytest.approx(4 * lam, rel=0.02)
    assert finesse.threshold(0.01, pump_ratio=1.0) > 5 * 4 * 0.01  # pumping at w0, not 2 w0, needs far more


def test_faraday_response_is_at_half_the_pump():
    ratio, amp = finesse.faraday_response(h=0.2, lam=0.01)
    assert ratio == pytest.approx(0.5, abs=0.01) and amp > 0.1
    _, quiet = finesse.faraday_response(h=0.02, lam=0.01)  # below 4 lam: decays
    assert quiet < 1e-3


def test_phased_gain_n_squared_random_n():
    for n in (8, 32, 128):
        assert finesse.focus_gain(n) == pytest.approx(n * n, rel=1e-9)
        rand = np.mean([finesse.focus_gain(n, "random", seed=s) for s in range(200)])
        assert rand == pytest.approx(n, rel=0.25)
        assert finesse.focus_gain(n, "flipped") < 0.2 * n * n
    assert 0.3 < finesse.focal_width() < 0.45  # a ring focus is J0-shaped: 0.36 wavelength


def test_time_reversal_refocuses_at_the_source_and_scrambled_does_not():
    one = timerev.experiment(receivers=1)
    assert one["hit"] and one["contrast"] > 5 and 0.3 <= one["fwhm_wavelengths"] <= 0.8
    bad = timerev.experiment(receivers=1, scramble=True)
    assert not bad["hit"] or bad["contrast"] < 0.5 * one["contrast"]
