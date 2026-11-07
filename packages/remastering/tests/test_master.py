# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Planted tests for every mastering stage: EQ, compressor, multiband, true-peak limiter, width, dither, the
preset chain and reference match, plus the accelerated recursions held to bit identity with plain Python."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.signal import welch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from remastering import accel, master  # noqa: E402
from remastering import dither as D  # noqa: E402
from remastering import dynamics as DY  # noqa: E402
from remastering import eq as EQ  # noqa: E402
from remastering import loudness as LD  # noqa: E402
from remastering import resample as RS  # noqa: E402
from remastering import stereo as ST  # noqa: E402

FS = 48000
RNG = np.random.default_rng(7)


def pink(n, rng=RNG):
    w = rng.standard_normal(n)
    f = np.fft.rfftfreq(n, 1 / FS)
    s = np.fft.rfft(w) / np.sqrt(np.maximum(f, 20.0))
    x = np.fft.irfft(s, n)
    return x / np.abs(x).max()


def test_min_and_linear_phase_eq_hit_the_band_gain():
    bands = [("peak", 1000.0, 6.0, 1.0), ("lowshelf", 100.0, -4.0, 0.7), ("highshelf", 8000.0, 3.0, 0.7)]
    r = EQ.response_db(bands, FS, [1000.0])
    assert abs(r[0] - 6.0) < 0.1
    for fn in (EQ.minimum_phase, EQ.linear_phase):
        t = np.arange(FS) / FS
        y = fn(np.sin(2 * math.pi * 1000 * t), bands, FS)
        got = 20 * np.log10(np.abs(y[FS // 4: -FS // 4]).max())
        assert abs(got - EQ.response_db(bands, FS, [1000.0])[0]) < 0.1


def test_linear_phase_eq_is_symmetric_and_aligned():
    h = EQ.linear_phase_bands([("peak", 2000.0, 9.0, 2.0)], FS)
    assert np.allclose(h, h[::-1], atol=1e-12)
    imp = np.zeros(8000)
    imp[4000] = 1.0
    out = EQ.apply_fir(imp, h)
    assert int(np.argmax(np.abs(out))) == 4000          # the peak stays where the impulse was: no delay


def test_compressor_static_curve():
    """A steady tone 20 dB over threshold at 4:1 comes out 15 dB lower (hard knee)."""
    t = np.arange(2 * FS) / FS
    level_in = -6.0                                      # mean square of this sine, dB
    amp = math.sqrt(2) * 10 ** (level_in / 20)
    y = np.stack([amp * np.sin(2 * math.pi * 500 * t)] * 2)
    out, g = DY.compress(y, FS, threshold=-26.0, ratio=4.0, knee=0.0, attack=0.002, release=0.05)
    assert abs(np.median(g[FS:]) - (-15.0)) < 0.5


def test_multiband_with_unity_ratios_reconstructs_the_input():
    x = np.stack([pink(FS), pink(FS)])
    out, _ = DY.multiband(x, FS, (120.0, 1000.0, 6000.0), [{}, {}, {}, {}])
    assert np.abs(out - x).max() < 1e-9
    bands = DY.split_bands(x, (120.0, 1000.0, 6000.0), FS)
    assert np.abs(sum(bands) - x).max() < 1e-9


def test_true_peak_limiter_holds_the_ceiling_between_samples():
    t = np.arange(2 * FS) / FS
    y = np.sin(2 * math.pi * FS / 4 * t + math.pi / 4) * 1.4      # intersample peaks 3 dB over the samples
    y = np.stack([y, y])
    out, _ = DY.true_peak_limit(y, FS, ceiling_db=-1.0)
    check = RS.oversample(out, 16)                                 # independent, finer check
    assert 20 * np.log10(np.abs(check).max()) <= -1.0 + 0.1


def test_width_and_mid_side():
    x = np.stack([pink(FS), pink(FS, np.random.default_rng(8))])
    assert np.allclose(ST.from_ms(ST.to_ms(x)), x)
    mono = ST.width(x, 0.0)
    assert ST.correlation(mono) > 0.9999
    assert ST.side_ratio_db(ST.width(x, 1.5)) > ST.side_ratio_db(x) + 3.4


def test_dither_shapes_noise_out_of_the_sensitive_band():
    x = np.zeros((1, 44100 * 2))
    plain, _ = D.requantise(x, 16, "none")
    shaped, _ = D.requantise(x, 16, "lipshitz5")
    f, p0 = welch(plain[0], 44100, nperseg=4096)
    _, p1 = welch(shaped[0], 44100, nperseg=4096)
    band = (f > 1000) & (f < 4000)
    assert 10 * np.log10(p1[band].mean() / p0[band].mean()) < -6


def test_tpdf_dither_removes_truncation_distortion():
    """A sine at 0.4 LSB vanishes without dither (all zeros) and survives with it as signal plus noise."""
    t = np.arange(44100) / 44100
    x = (0.4 / 32768) * np.sin(2 * math.pi * 1000 * t)
    hard = np.floor(x * 32768 + 0.5)
    assert np.all(hard == 0)
    y, _ = D.requantise(x[None, :], 16, "none")
    c = np.dot(y[0], x) / np.dot(x, x)
    assert 0.8 < c < 1.2


def test_accelerated_recursions_match_plain_python_bit_for_bit():
    x = np.abs(RNG.standard_normal(4000))
    assert np.array_equal(accel.follow(x, 0.9, 0.99, fast=True), accel.follow(x, 0.9, 0.99, fast=False))
    d = RNG.random(4000) / 32768
    c = np.array(D.SHAPES["lipshitz5"])
    a = accel.shape_quantise(x * 0.1, d, c, 32768.0, fast=True)
    b = accel.shape_quantise(x * 0.1, d, c, 32768.0, fast=False)
    assert np.array_equal(a, b)


def test_waveguide_matches_the_daw_reference():
    from daw.waveguide import hammer, loop_params, string
    n, a, g = loop_params(220.0, FS, 2.0)
    h = hammer(FS)
    ref = string(220.0, 0.5, FS, h, 2.0)
    got = accel.waveguide(h, int(0.5 * FS), n, a, g)
    assert np.array_equal(ref, got)


def test_streaming_preset_lands_on_target():
    x = np.stack([pink(10 * FS), pink(10 * FS, np.random.default_rng(3))]) * 0.3
    out, pcm, rep = master.run(x, FS, master.PRESETS["streaming"])
    assert abs(rep["after"]["integrated_lufs"] - (-14.0)) <= 0.2
    assert LD.true_peak(out, FS) <= -1.0 + 0.15
    assert pcm.dtype == np.int32 and np.abs(pcm).max() <= 32767


def test_reference_match_moves_the_spectrum_onto_the_reference():
    x = np.stack([pink(10 * FS)] * 2) * 0.2
    ref = EQ.minimum_phase(x, [("highshelf", 4000.0, 6.0, 0.7), ("lowshelf", 150.0, -5.0, 0.7)], FS)
    s = master.reference_settings(x, ref, FS)
    out, _, _ = master.run(x, FS, s)
    f, a = master.ltas_db(out, FS)
    _, b = master.ltas_db(ref, FS)
    band = (f >= 50) & (f <= 16000)
    d = master.smooth_octave(f, a, 3) - master.smooth_octave(f, b, 3)
    d = d[band] - np.median(d[band])
    assert math.sqrt(np.mean(d ** 2)) < 1.0
