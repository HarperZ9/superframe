# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
import cv2
import numpy as np

from quality import grain


def test_grain_amplitude_tracks_noise_sd(rng):
    base = np.full((256, 256, 3), 120.0)
    lo = grain.grain_stats(base + rng.normal(0, 2, (256, 256, 1)))
    assert lo["surface_sd"] > 0
    hi = grain.grain_stats(base + rng.normal(0, 8, (256, 256, 1)))
    assert 0 < lo["grain_sd"] < hi["grain_sd"]
    # residual after a 1.5 px blur keeps most of white noise: ratio near 4
    assert 3.0 < hi["grain_sd"] / lo["grain_sd"] < 5.0


def test_mono_grain_has_low_chroma_ratio_and_colour_grain_high(rng):
    base = np.full((256, 256, 3), 120.0)
    mono = grain.grain_stats(base + rng.normal(0, 6, (256, 256, 1)))
    colour = grain.grain_stats(base + rng.normal(0, 6, (256, 256, 3)))
    assert mono["chroma_ratio"] < 0.05
    assert colour["chroma_ratio"] > 1.0


def test_clumped_grain_is_wider_and_lower_frequency(rng):
    n = rng.normal(0, 1, (256, 256))
    fine = np.repeat((120 + 6 * n)[..., None], 3, 2)
    clump = cv2.GaussianBlur(n, (0, 0), 1.2)
    clump = np.repeat((120 + 6 * clump / clump.std())[..., None], 3, 2)
    f, c = grain.grain_stats(fine), grain.grain_stats(clump)
    assert c["grain_corr_px"] > f["grain_corr_px"]
    assert c["spectral_centroid"] < f["spectral_centroid"]


def test_halftone_pitch_and_angle_recovered():
    yy, xx = np.mgrid[:256, :256]
    for period, ang in ((8.0, 0.0), (6.0, 45.0)):
        t = np.radians(ang)
        u = xx * np.cos(t) + yy * np.sin(t)
        img = 128 + 100 * np.cos(2 * np.pi * u / period)
        r = grain.cell_pitch(img)
        assert abs(r["cell_px"] - period) / period < 0.08
        assert min(abs(r["cell_angle"] - ang), 180 - abs(r["cell_angle"] - ang)) < 6
        assert r["cell_peak"] > 30  # peak-to-mean power


def test_clipping_shares():
    img = np.full((10, 10, 3), 100.0)
    img[0, :, 0] = 255
    img[1, :5, 2] = 0
    c = grain.clipping(img)
    assert c["clip_high"] == 0.1
    assert c["clip_low"] == 0.05
