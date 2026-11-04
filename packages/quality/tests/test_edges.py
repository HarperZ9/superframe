# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
import cv2
import numpy as np

from quality import edges


def _disc(aa: bool, scale=1):
    s = 256 * (4 if aa else 1)
    img = np.zeros((s, s), np.uint8)
    cv2.circle(img, (s // 2, s // 2), int(s * 0.35), 255, -1, lineType=cv2.LINE_8)
    if aa:
        img = cv2.resize(img, (256, 256), interpolation=cv2.INTER_AREA)  # 4x supersampled coverage
    return np.repeat(img[..., None].astype(float), 3, 2)


def test_aliased_disc_has_jaggies_and_aa_disc_does_not():
    hard, soft = edges.analyse(_disc(False)), edges.analyse(_disc(True))
    assert hard["edges"] > 50 and soft["edges"] > 50
    assert hard["stair_share"] > 0.5
    assert soft["stair_share"] < 0.2
    assert soft["aa_share"] > hard["aa_share"]


def test_blurred_edge_is_wider():
    crisp = _disc(True)
    soft = cv2.GaussianBlur(crisp, (0, 0), 2.5)
    a, b = edges.analyse(crisp), edges.analyse(soft)
    assert a["width_p50"] <= 1.6
    assert b["width_p50"] > 3.0


def test_flat_image_reports_no_edges():
    r = edges.analyse(np.full((64, 64, 3), 90.0))
    assert r["edges"] == 0


def _strokes(line_type):
    img = np.full((600, 800, 3), (221, 235, 241), np.uint8)
    r = np.random.default_rng(7)
    for _ in range(300):
        a, b, t, l, w = r.random() * 800, r.random() * 600, r.random() * 6.28, 20 + r.random() * 80, int(1 + r.random() * 3)
        cv2.line(img, (int(a), int(b)), (int(a + np.cos(t) * l), int(b + np.sin(t) * l)), (14, 19, 23), w, line_type)
    return img.astype(float)


def test_calibration_strokes_separate_on_spec_thresholds():
    # QUALITY-SPEC R3 thresholds (aa >= 0.6, stair <= 0.3) must split aliased from anti-aliased strokes
    hard, soft = edges.analyse(_strokes(cv2.LINE_8)), edges.analyse(_strokes(cv2.LINE_AA))
    assert hard["aa_share"] < 0.6 and hard["stair_share"] > 0.3
    assert soft["aa_share"] >= 0.6 and soft["stair_share"] <= 0.3
