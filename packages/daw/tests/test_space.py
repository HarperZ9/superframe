# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sound in space, reference implementation: delay to the sample, inverse-square loss, ISO 9613-1 air
absorption against the Kaye and Laby table, the Doppler shift, and the radiation moment of plate modes."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import materials as M  # noqa: E402
from daw import propagate as P  # noqa: E402

FS = 48000


def test_delay_is_distance_over_speed_to_the_sample():
    c = M.air_speed(20.0)
    for r in (1.0, 3.43, 17.0, 40.0):
        x = np.zeros(64); x[0] = 1.0
        y, delay = P.static_path(x, FS, (0, 0, 0), (r, 0, 0), c)
        assert int(np.argmax(np.abs(y))) == round(r / c * FS)
        assert abs(delay - r / c * FS) < 1e-9


def test_water_carries_sound_faster():
    x = np.zeros(8); x[0] = 1.0
    _, d_air = P.static_path(x, FS, (0, 0, 0), (10, 0, 0), M.air_speed(20.0))
    _, d_water = P.static_path(x, FS, (0, 0, 0), (10, 0, 0), M.water_speed())
    assert abs(d_air / d_water - M.water_speed() / M.air_speed(20.0)) < 1e-12


def test_inverse_square_law():
    x = np.zeros(8); x[0] = 1.0
    p1 = np.abs(P.static_path(x, FS, (0, 0, 0), (2, 0, 0), 343.0)[0]).sum()
    p2 = np.abs(P.static_path(x, FS, (0, 0, 0), (4, 0, 0), 343.0)[0]).sum()
    assert abs(20 * math.log10(p1 / p2) - 6.0206) < 1e-3          # doubling distance: -6.02 dB
    assert abs(20 * math.log10(p1 / p2) - 12.04) > 1               # planted: an intensity-as-pressure slip


def _air_rows():
    return [r for r in M.table().values() if r["id"].startswith("air.atten.")]


def test_iso9613_matches_the_published_table():
    rows = _air_rows()
    assert len(rows) == 108
    err = np.array([P.iso9613_alpha(r["f_hz"], 20.0, r["rh_percent"]) * 1000 / r["value"] - 1 for r in rows])
    assert np.abs(err).max() < 0.06 and np.median(np.abs(err)) < 0.015


def test_iso9613_without_nitrogen_relaxation_fails_the_table():
    rows = _air_rows()

    def no_n(f, rh):
        full = P.iso9613_alpha(f, 20.0, rh)
        T, h = 293.15, rh * 10 ** (-6.8346 * (273.16 / 293.15) ** 1.261 + 4.6151)
        frn = 9.0 + 280.0 * h
        return full - 8.686 * f ** 2 * 0.1068 * math.exp(-3352.0 / T) / (frn + f ** 2 / frn)
    err = np.array([no_n(r["f_hz"], r["rh_percent"]) * 1000 / r["value"] - 1 for r in rows])
    assert np.abs(err).max() > 0.06


def test_absorption_filters_highs_more_than_lows():
    fs, n = FS, 4096
    t = np.arange(n) / fs
    x = np.sin(2 * math.pi * 500 * t) + np.sin(2 * math.pi * 8000 * t)
    air = {"celsius": 20.0, "rh": 20.0, "kpa": 101.325}
    y, _ = P.static_path(x, fs, (0, 0, 0), (200.0, 0, 0), 343.0, air=air)
    y0, _ = P.static_path(x, fs, (0, 0, 0), (200.0, 0, 0), 343.0)
    spec, spec0 = np.abs(np.fft.rfft(y)), np.abs(np.fft.rfft(y0))
    fr = np.fft.rfftfreq(len(y), 1 / fs)
    loss = lambda f0: 20 * math.log10(spec0[np.argmin(np.abs(fr - f0))] / spec[np.argmin(np.abs(fr - f0))])
    assert abs(loss(8000) - P.iso9613_alpha(8000, 20.0, 20.0) * 200) < 0.5
    assert abs(loss(500) - P.iso9613_alpha(500, 20.0, 20.0) * 200) < 0.1 and loss(8000) > 10 * loss(500)


def test_doppler_shift_for_an_approaching_source():
    c, v, f0 = 343.0, 20.0, 1000.0
    n = FS * 2
    x = np.sin(2 * math.pi * f0 * np.arange(n) / FS)
    traj = lambda tau: np.stack([-100.0 + v * tau, np.zeros_like(tau), np.zeros_like(tau)], 1)
    y, _ = P.moving_path(x, FS, traj, (0, 0, 0), c, FS)
    seg = y[FS // 2: FS]                                   # source well short of the listener
    assert abs(P.zero_cross_frequency(seg, FS) / (f0 * P.doppler_factor(c, v)) - 1) < 2e-4
    assert abs(P.zero_cross_frequency(seg, FS) / (f0 * (1 + v / c)) - 1) > 2e-4   # planted: the moving-listener formula


def test_plate_mode_volume_velocity():
    n = 200
    xs = (np.arange(n) + 0.5) / n
    X, Y = np.meshgrid(xs, xs, indexing="ij")
    for m, k in ((1, 1), (2, 1), (3, 1), (3, 3), (2, 2)):
        img = np.sin(m * math.pi * X) * np.sin(k * math.pi * Y)
        assert abs(P.volume_velocity(img, 1.0 / n ** 2) - P.rect_mode_volume_velocity(m, k)) < 1e-4
    assert P.rect_mode_volume_velocity(2, 1) == 0.0 and P.rect_mode_volume_velocity(1, 1) > 0.4
