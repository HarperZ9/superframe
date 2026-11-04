# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
from pathlib import Path

import cv2
import numpy as np
import pytest

from quality import ssim


def _img(rng, h=96, w=128):
    base = cv2.GaussianBlur(rng.random((h, w)) * 255, (0, 0), 3)
    return np.repeat(base[..., None], 3, 2)


def test_identical_is_one(rng):
    a = _img(rng)
    r = ssim.compare_arrays(a, a.copy())
    assert r["ssim"] == pytest.approx(1.0, abs=1e-9)
    assert r["worst_tile"] == pytest.approx(1.0, abs=1e-9)


def test_symmetric_and_bounded(rng):
    a, b = _img(rng), _img(rng)
    ab, ba = ssim.compare_arrays(a, b)["ssim"], ssim.compare_arrays(b, a)["ssim"]
    assert ab == pytest.approx(ba, abs=1e-9)
    assert -1 <= ab < 0.9


def test_local_defect_caught_by_worst_tile(rng):
    a = _img(rng, 256, 256)
    b = a.copy()
    b[100:130, 100:130] = 255 - b[100:130, 100:130]  # small local regression
    r = ssim.compare_arrays(a, b)
    assert r["ssim"] > 0.95           # the mean hides it
    assert r["worst_tile"] < 0.8      # the tile does not (the mean stays above 0.95)
    x, y = r["worst_at"]
    assert 64 <= x <= 128 and 64 <= y <= 128


def test_size_mismatch_raises(rng):
    with pytest.raises(ValueError):
        ssim.compare_arrays(_img(rng, 64, 64), _img(rng, 64, 65))


def test_check_baselines_never_overwrites_and_flags_regression(tmp_path: Path, rng):
    gold, act = tmp_path / "golden", tmp_path / "actual"
    act.mkdir()
    a = _img(rng).astype(np.uint8)
    cv2.imwrite(str(act / "plate.png"), a)
    assert ssim.check(gold, act)["pass"] is False             # missing golden fails without --update
    assert ssim.check(gold, act, update=True)["results"]["plate.png"]["status"] == "baselined"
    assert ssim.check(gold, act)["pass"] is True
    b = a.copy()
    b[10:40, 10:40] = 255 - b[10:40, 10:40]
    cv2.imwrite(str(act / "plate.png"), b)
    r = ssim.check(gold, act, update=True)                     # update must not hide the regression
    assert r["pass"] is False
    assert r["results"]["plate.png"]["status"] == "fail"
