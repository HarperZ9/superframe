# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
import numpy as np

from quality import banding


def ramp(w=384, h=192, lo=40.0, hi=60.0):
    """Horizontal float ramp, lo..hi code values, 3 channels."""
    x = np.linspace(lo, hi, w)
    return np.repeat(np.repeat(x[None, :, None], h, axis=0), 3, axis=2)


def test_quantised_ramp_is_banded():
    img = np.round(ramp())  # 20 codes over 384 px: 19 px bands, no dither
    r = banding.analyse(img)
    assert r["smooth_tiles"] > 0
    assert r["banded_share"] > 0.5
    assert r["worst_band_px"] >= 15
    assert r["pass"] is False


def test_tpdf_dithered_ramp_passes(rng):
    f = ramp()
    tpdf = rng.random(f.shape) - rng.random(f.shape)
    img = np.round(f + tpdf)
    r = banding.analyse(img)
    assert r["smooth_tiles"] > 0
    assert r["banded_share"] == 0
    assert r["pass"] is True


def test_histogram_gaps_detected(rng):
    # a 6-bit ramp scaled to 8 bits skips 3 of every 4 codes, even with noise-free output
    f = ramp(lo=30, hi=70)
    img = np.round(f / 4) * 4
    r = banding.analyse(img)
    assert r["gap_ratio"] > 0.5
    assert r["pass"] is False


def test_flat_fields_and_photo_noise_are_not_flagged(rng):
    flat = np.full((192, 384, 3), 128.0)
    assert banding.analyse(flat)["smooth_tiles"] == 0
    noisy = np.clip(np.round(ramp() + rng.normal(0, 2.0, (192, 384, 3))), 0, 255)
    assert banding.analyse(noisy)["pass"] is True


def test_steep_ramp_has_narrow_bands_that_pass():
    # 1 code per pixel: a staircase but bands only 1 px wide, invisible
    x = np.arange(96, dtype=float) * 0.4 + 20
    img = np.round(np.repeat(np.repeat(x[None, :, None], 96, 0), 3, 2))
    r = banding.analyse(img)
    assert r["banded_tiles"] == 0


def test_faint_line_and_ray_fan_are_not_ramps():
    img = np.full((192, 384, 3), 8.0)
    img[:, 200] = 12.0  # a 1 px hairline, 4 codes above the ground
    assert banding.analyse(img)["smooth_tiles"] == 0
    yy, xx = np.mgrid[:192, :384]
    fan = 8 + 3 * (np.floor(np.degrees(np.arctan2(yy - 96, xx - 192)) / 10) % 2)
    assert banding.analyse(np.repeat(fan[..., None], 3, 2))["banded_tiles"] == 0
