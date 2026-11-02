# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
import cv2
import numpy as np
import pytest

from quality import pacing


def test_steady_60hz_scores_clean():
    ts = np.arange(0, 2000, 1000 / 60)
    r = pacing.analyse_intervals(ts)
    assert r["period_ms"] == pytest.approx(16.667, abs=0.01)
    assert r["dropped"] == 0
    assert r["jitter_ms"] < 0.01
    assert r["fps"] == pytest.approx(60, abs=0.1)


def test_dropped_frames_counted():
    p = 1000 / 120
    ts = list(np.arange(0, 100) * p)
    ts = ts[:50] + [t + 2 * p for t in ts[50:]]  # one gap of three periods: two dropped
    r = pacing.analyse_intervals(ts, period_ms=p)
    assert r["dropped"] == 2
    assert r["long_share"] > 0


def test_record_budget_flags():
    ts = list(np.arange(0, 120) * (1000 / 60))
    rec = {"ts": ts, "cb": [5.0] * 100 + [12.0] * 19, "cls": 0.02, "loaf": [80]}
    r = pacing.analyse_record(rec)
    assert r["budget_60_ok"] is True
    assert r["budget_120_ok"] is False
    assert r["cls"] == 0.02 and r["long_frames"] == 1


def _write_clip(path, hold, n=48, fps=24):
    vw = cv2.VideoWriter(str(path), cv2.VideoWriter_fourcc(*"MJPG"), fps, (64, 64))
    rng = np.random.default_rng(0)
    frame = None
    for i in range(n):
        if i % hold == 0:
            frame = (rng.random((64, 64, 3)) * 255).astype(np.uint8)
        vw.write(frame)
    vw.release()


@pytest.mark.parametrize("hold", [1, 2, 3])
def test_video_cadence_recovers_ones_twos_threes(tmp_path, hold):
    p = tmp_path / f"h{hold}.avi"
    _write_clip(p, hold)
    r = pacing.cadence(str(p))
    assert r["gap_mode"] == hold
    assert r["unique_rate"] == pytest.approx(24 / hold, rel=0.1)


def test_jittered_long_gap_rounds_to_whole_vsyncs():
    # a timestamp a little early (2.9 periods) is still three vsyncs: two frames lost, not one
    p = 1000 / 60
    ts = [0, p, 2 * p, 2 * p + 2.9 * p, 3 * p + 2.9 * p]
    assert pacing.analyse_intervals(ts, period_ms=p)["dropped"] == 2
