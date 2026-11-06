# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A scene that makes its own sound: rain from one physics record, read by the renderer and the DAW."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.ndimage import uniform_filter1d

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import nature as N  # noqa: E402
from daw import scene as S  # noqa: E402
from daw import superstack as ss  # noqa: E402

FS = 48000


def test_drop_count_follows_the_flux():
    src = {"kind": "rain", "rate_mm_h": 5.0, "area_m2": 2.0, "centre": [0, 0, 0]}
    t, d, v, pos = S.rain_events(src, 20.0, np.random.default_rng(1))
    lam = S.drop_flux(5.0) * 2.0 * 20.0
    assert abs(len(t) - lam) < 4 * math.sqrt(lam)
    w = S.number_density(S.D_GRID, 5.0) * S.terminal_speed(S.D_GRID)
    assert abs(d.mean() / (np.trapezoid(w * S.D_GRID, S.D_GRID) / np.trapezoid(w, S.D_GRID)) - 1) < 0.02


def test_marshall_palmer_size_and_count_follow_the_exponential():
    n0, lam = S.mp_constants()
    vp = S.visual_params({"sources": [{"kind": "rain", "rate_mm_h": 10.0}]})[0]
    L, d0 = lam * 10.0 ** -0.21, S.D_GRID[0]                          # an exponential cut at d0: mean d0 + 1 / L
    assert abs(vp["mean_diameter_mm"] / (d0 + 1 / L) - 1) < 0.01
    assert abs(vp["drops_per_m3"] / (n0 / L * math.exp(-L * d0)) - 1) < 0.01
    assert abs(vp["mean_diameter_mm"] / (1 / L) - 1) > 0.1                 # planted: forgetting the cut


def test_picture_and_sound_move_together_with_the_rain_rate():
    v2, v50 = (S.visual_params({"sources": [{"kind": "rain", "rate_mm_h": r}]})[0] for r in (2.0, 50.0))
    assert v50["drops_per_m3"] > v2["drops_per_m3"] and v50["mean_diameter_mm"] > v2["mean_diameter_mm"]
    assert S.drop_flux(50.0) > 3 * S.drop_flux(2.0)


def test_light_rain_on_water_peaks_in_the_bubble_band():
    y = S.render(S.RAIN_SCENE, 3.0, FS)
    fr = np.fft.rfftfreq(len(y), 1 / FS)
    sm = uniform_filter1d(np.abs(np.fft.rfft(y * np.hanning(len(y)))), 2001)
    band = (fr > 2000) & (fr < 23000)
    peak = fr[band][np.argmax(sm[band])]
    lo, hi = N.minnaert_frequency(0.25e-3), N.minnaert_frequency(0.19e-3)
    assert lo < peak < hi and 13000 < peak < 17000
    dry = S.render(S.RAIN_SCENE, 3.0, FS, entrain=False)                 # planted: no bubbles, no peak there
    sd = uniform_filter1d(np.abs(np.fft.rfft(dry * np.hanning(len(dry)))), 2001)
    assert not lo < fr[band][np.argmax(sd[band])] < hi


def test_scene_render_is_seeded_and_on_the_flick_clock(tmp_path):
    a = S.render_to_wav(S.RAIN_SCENE, 1.0, tmp_path / "a")
    b = S.render_to_wav(S.RAIN_SCENE, 1.0, tmp_path / "b")
    assert a["content_sha256"] == b["content_sha256"] and ss.verify_receipt(a) == []
    assert S.sample_of_flicks(ss.flicks_per_sample(FS) * 24000, FS) == 24000
    assert S.sample_of_flicks(705_600_000, FS) == FS                  # one second of flicks is one second of samples


def test_engine_rain_scene_reads_the_same_record():
    js = Path(__file__).resolve().parents[2] / "rooms" / "core" / "data" / "rain-record.js"
    assert js.read_bytes().replace(bytes([13, 10]), bytes([10])).decode("utf-8") == S.rooms_module()


def test_live_rain_is_the_offline_rain():
    from daw import rain_stream
    scene = S
    ev = rain_stream.bubble_events(scene.RAIN_SCENE, 10.0, np.random.default_rng(4))
    src = scene.RAIN_SCENE["sources"][0]
    w = scene.number_density(scene.D_GRID, 2.0) * scene.terminal_speed(scene.D_GRID)
    frac = np.trapezoid(w * ((scene.D_GRID >= 0.8) & (scene.D_GRID <= 1.1)), scene.D_GRID) / np.trapezoid(w, scene.D_GRID)
    expect = scene.drop_flux(2.0) * src["area_m2"] * 10.0 * frac
    assert abs(len(ev) - expect) < 5 * np.sqrt(expect) + 0.01 * expect
    f = np.array([e[1] for e in ev])
    assert 13000 < np.median(f) < 17000
