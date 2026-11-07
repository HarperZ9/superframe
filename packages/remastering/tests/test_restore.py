# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Planted damage on synthetic audio, each repair scored against the clean original. The thresholds are the floors
these methods clear on these signals; the scored study on music is in the private results, not here."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from remastering import refine  # noqa: E402
from remastering.restore import ar, repair, spectral  # noqa: E402

FS = 44100
RNG = np.random.default_rng(11)


def music(seconds=4.0, seed=0):
    """Three decaying harmonic notes per second over a soft noise floor: tonal, so AR models fit it."""
    rng = np.random.default_rng(seed)
    n = int(seconds * FS)
    t = np.arange(n) / FS
    y = np.zeros(n)
    for k in range(int(seconds * 3)):
        f0 = 110 * 2 ** (rng.integers(0, 24) / 12)
        s = int(k / 3 * FS)
        tt = t[: n - s]
        y[s:] += sum(0.6 ** h * np.sin(2 * math.pi * f0 * (h + 1) * tt) for h in range(6)) * np.exp(-tt * 3)
    y += 0.002 * rng.standard_normal(n)
    y = y / np.abs(y).max() * 0.8
    return np.stack([y, np.roll(y, 7)])


def snr(c, e, sel=None):
    if sel is not None:
        c, e = c[:, sel], e[:, sel]
    return 10 * np.log10((c ** 2).sum() / ((c - e) ** 2).sum())


def test_lsar_fills_a_short_gap():
    x = music(1.0)[0]
    m = np.zeros(len(x), bool)
    m[20000:20100] = True
    z = ar.lsar(np.where(m, 0, x)[16000:24100], m[16000:24100], 128)
    assert snr(x[None, 20000:20100], z[None, 4000:4100]) > 20


def test_declick():
    x = music()
    d = x.copy()
    sel = np.zeros(x.shape[1], bool)
    for i in RNG.integers(2000, x.shape[1] - 2000, 30):
        d[:, i:i + 2] += 0.6
        sel[i:i + 2] = True
    r, regions = repair.declick(d, FS)
    assert snr(x, r, sel) > snr(x, d, sel) + 10
    assert len(regions) >= 30


def test_declip_respects_the_clip_level():
    x = music()
    pk = 0.5 * np.abs(x).max()
    d = np.clip(x, -pk, pk)
    r, _ = repair.declip(d, FS)
    clipped = np.abs(d) >= 0.995 * np.abs(d).max()
    assert np.all(np.abs(r[clipped]) >= 0.995 * pk - 1e-9)          # never back inside the clip level
    assert snr(x, r, clipped.any(0)) > snr(x, d, clipped.any(0)) + 1


def test_short_gaps():
    x = music()
    d = x.copy()
    m = np.zeros(x.shape[1], bool)
    for i in np.linspace(FS // 2, x.shape[1] - FS // 2, 10).astype(int):
        m[i:i + 100] = True
    d[:, m] = 0
    r, _ = repair.fill_gaps(d, FS, mask=m)
    assert snr(x, r, m) > snr(x, d, m) + 8          # 100-sample gaps; some land on note onsets


def test_long_gap_from_a_repeat():
    base = music(3.0)
    x = np.concatenate([base, base, base, base], 1)                 # a loop: the gap's content exists elsewhere
    a, b = int(4.0 * FS), int(5.0 * FS)
    d = x.copy()
    d[:, a:b] = 0
    r, regions, info = repair.fill_long_gap(d, FS, a, b)
    sel = np.zeros(x.shape[1], bool)
    sel[a:b] = True
    assert info["score"] > 0.95 and regions[0][2] == "inferred"
    assert snr(x, r, sel) > 20


def test_dehum_finds_mains_and_leaves_music():
    x = music(8.0)
    t = np.arange(x.shape[1]) / FS
    hum = sum(0.5 ** k * np.sin(2 * math.pi * 50.0 * (k + 1) * t) for k in range(5)) * 0.03
    r, _, info = spectral.dehum(x + hum, FS)
    assert info["hum_hz"] is not None and abs(info["hum_hz"] - 50.0) < 0.1
    assert snr(x, r) > snr(x, x + hum) + 6
    clean, _, info2 = spectral.dehum(x, FS)
    assert info2["hum_hz"] is None                                  # nothing to remove: nothing removed


def test_dewow_reduces_pitch_drift():
    t = np.arange(int(6 * FS)) / FS
    x = sum(0.5 ** h * np.sin(2 * math.pi * 440 * (h + 1) * t) for h in range(4))[None, :]
    speed = 1 + 0.004 * np.sin(2 * math.pi * 0.7 * t)
    pos = np.clip(np.cumsum(speed) - speed[0], 0, len(t) - 1)
    d = spectral.sinc_read(x[0], pos)[None, :]
    r, _, _ = spectral.dewow(d, FS)
    before = np.median(np.abs(spectral.track_speed(d, FS)[0]))
    after = np.median(np.abs(spectral.track_speed(r, FS)[0]))
    assert after < 0.5 * before


def test_bandwidth_extension_adds_only_above_the_cutoff():
    x = music()
    from scipy.signal import firwin
    from remastering.eq import apply_fir
    d = apply_fir(x, firwin(2047, 8000, window=("kaiser", 12.0), fs=FS))
    r, regions, _ = spectral.extend_bandwidth(d, FS, 8000)
    w = np.hanning(d.shape[1])
    D, R = np.abs(np.fft.rfft(d[0] * w)), np.abs(np.fft.rfft(r[0] * w))
    f = np.fft.rfftfreq(d.shape[1], 1 / FS)
    assert R[(f > 9000) & (f < 16000)].mean() > 10 * D[(f > 9000) & (f < 16000)].mean()
    assert regions[0][2] == "inferred"


def test_denoise_raises_snr():
    x = music()
    n = RNG.standard_normal(x.shape) * np.sqrt((x ** 2).mean()) * 0.1
    r, _ = refine.denoise(x + n, FS)
    assert snr(x, r) > snr(x, x + n) + 2


def test_debleed_keeps_the_sum():
    x = music()
    stems = {"a": 0.7 * x, "b": 0.3 * x + 0.01 * RNG.standard_normal(x.shape)}
    out = refine.debleed(stems)
    assert np.abs(sum(out.values()) - sum(stems.values())).max() < 1e-9
