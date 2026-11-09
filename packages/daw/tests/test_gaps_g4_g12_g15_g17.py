# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the tempo map (G4), saturation and crush (G12), the pipe organ (G15) and the prepared
piano (G17), each with a planted control that must fail."""
import math
import sys
from pathlib import Path

import numpy as np
from scipy.integrate import quad
from scipy.linalg import eigh_tridiagonal

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import organ, prepared as P, saturate as S, tempo as T  # noqa: E402
from daw.arrange import Note  # noqa: E402

FS = 48000


def peak_hz(y, fs, lo, hi, nfft=1 << 20):
    spec = np.abs(np.fft.rfft(y * np.hanning(len(y)), nfft))
    a, b = int(lo * nfft / fs), int(hi * nfft / fs)
    return (a + int(np.argmax(spec[a:b]))) * fs / nfft


def sine(f, seconds=0.5, amp=0.8):
    return amp * np.sin(2 * math.pi * f * np.arange(int(seconds * FS)) / FS)


# G12: saturation, crush, hold

def test_tanh_adds_odd_harmonics_only_at_the_fourier_level():
    y = S.saturate(sine(1000.0), "tanh", drive=3.0)
    h = S.harmonics(y[2400:-2400], FS, 1000.0, 5)
    assert h[1] < -90 and h[3] < -90                                     # H2, H4 absent: tanh is odd
    w = np.linspace(0, 2 * math.pi, 200001)[:-1]                        # the third Fourier coefficient, by quadrature
    b = [np.mean(np.tanh(3.0 * 0.8 * np.sin(w)) * np.sin(k * w)) for k in (1, 3)]
    assert abs(h[2] - 20 * math.log10(abs(b[1] / b[0]))) < 0.1


def test_asymmetric_curves_lead_with_the_second_harmonic():
    for curve in ("tube", "diode"):
        h = S.harmonics(S.saturate(sine(1000.0), curve, drive=3.0)[2400:-2400], FS, 1000.0, 4)
        assert h[1] > -40, curve
    ht = S.harmonics(S.saturate(sine(1000.0), "tube", drive=1.0)[2400:-2400], FS, 1000.0, 4)
    assert ht[1] > ht[2] + 5                                             # moderate drive: H2 leads H3
    hs = S.harmonics(S.saturate(sine(1000.0), "tanh", drive=1.0)[2400:-2400], FS, 1000.0, 4)
    assert hs[1] < -90                                                   # planted: the symmetric curve has none


def test_oversampling_cuts_aliases_by_20_db():
    f, n = 7000.0, int(0.5 * FS)
    folded = [abs((k * f + FS / 2) % FS - FS / 2) for k in (5, 7, 9, 11)]     # 35, 49, 63, 77 kHz fold back
    def alias_power(y):
        spec = np.abs(np.fft.rfft(y[2400:-2400] * np.blackman(n - 4800))) ** 2
        return sum(spec[int(round(a * (n - 4800) / FS)) - 2:int(round(a * (n - 4800) / FS)) + 3].sum() for a in folded)
    raw = alias_power(S.saturate(sine(f), "tanh", drive=5.0, oversample=1))
    ovs = alias_power(S.saturate(sine(f), "tanh", drive=5.0, oversample=4))
    assert 10 * math.log10(raw / ovs) > 20


def test_crush_step_and_hold_rate_read_back():
    y = S.crush(sine(110.0, 1.0, 0.99), 8)
    step = np.min(np.diff(np.unique(y)))
    assert abs(step / (2 / 256) - 1) < 0.01
    assert abs(np.min(np.diff(np.unique(S.crush(sine(110.0, 1.0, 0.99), 7)))) / (2 / 256) - 1) > 0.5   # planted
    img = peak_hz(S.hold(sine(1000.0), FS, 11025.0), FS, 5000, 20000)
    assert abs((img + 1000.0) / 11025.0 - 1) < 0.01                      # image at rate - f


# G17: prepared piano

def test_loaded_string_reduces_to_the_harmonic_string_and_keeps_node_modes():
    assert np.max(np.abs(P.loaded_roots(0.3, 0.0, 8) / (math.pi * np.arange(1, 9)) - 1)) < 1e-9
    q = P.loaded_roots(0.5, 0.3, 6)
    assert abs(q[1] / (2 * math.pi) - 1) < 1e-9 and abs(q[3] / (4 * math.pi) - 1) < 1e-9   # mass on their node
    assert q[0] < 0.97 * math.pi and q[2] < 0.99 * 3 * math.pi                            # the rest pulled down


def test_loaded_string_matches_a_finite_difference_eigen_solve():
    a, m, n = 0.3, 0.5, 8
    N = 1600
    h = 1.0 / (N + 1)
    mass = np.full(N, h)
    mass[int(round(a / h)) - 1] += m                                        # the point mass on its node
    d = 1.0 / np.sqrt(mass)
    diag, off = 2.0 / h * d * d, -1.0 / h * d[:-1] * d[1:]
    lam = eigh_tridiagonal(diag, off, select="i", select_range=(0, n - 1), eigvals_only=True)
    q_fd = np.sqrt(lam)
    q = P.loaded_roots(a, m, n)
    assert np.max(np.abs(q / q_fd - 1)) < 0.005
    assert np.max(np.abs(P.loaded_roots(a, 0.0, n) / q_fd - 1)) > 0.02     # planted: no mass


def test_prepared_note_rings_at_its_partials_and_the_wedge_damps_off_node_modes():
    y, f = P.prepared(130.81, 2.0, FS, a=0.3, mass_ratio=0.5)
    assert abs(peak_hz(y[:FS], FS, 0.8 * f[0], 1.2 * f[0]) / f[0] - 1) < 0.002
    late = slice(FS, 2 * FS)
    def ratio(yy, ff):                                                      # partial 2 over partial 1, late
        s = np.abs(np.fft.rfft(yy[late] * np.hanning(FS)))
        return s[int(round(ff[1]))] / s[int(round(ff[0]))]
    dry = ratio(*P.prepared(130.81, 2.0, FS, a=0.5, mass_ratio=0.0, strike=0.3, pickup=0.1))
    wet = ratio(*P.prepared(130.81, 2.0, FS, a=0.5, mass_ratio=0.0, wedge=8.0, strike=0.3, pickup=0.1))
    assert wet > 10 * dry                                                   # partial 2 has a node at the wedge


# G15: pipe organ

def test_pipe_speaks_its_pitch_and_an_8_foot_c_is_about_8_feet():
    rng = np.random.default_rng(0)
    y, f1 = organ.pipe(440.0, 1.0, FS, rng)
    assert abs(f1 / 440.0 - 1) < 1e-9
    assert abs(peak_hz(y[FS // 4:], FS, 400, 480) / 440.0 - 1) < 0.001
    low_c = organ.pipe_for(65.406)                                          # C2, the lowest key of an 8' rank
    assert abs(low_c.length / (8 * 0.3048) - 1) < 0.05


def test_stopped_pipe_is_half_as_long_and_keeps_odd_partials():
    rng = np.random.default_rng(0)
    op, st = organ.pipe_for(220.0, scale=0.05), organ.pipe_for(220.0, stopped=True, scale=0.05)
    assert abs(st.length / op.length / 0.5 - 1) < 0.03
    y, _ = organ.pipe(220.0, 1.0, FS, rng, stopped=True, scale=0.05)
    h = S.harmonics(y[FS // 4:], FS, 220.0, 4)
    assert h[1] < h[2] - 20 and h[3] < h[2] - 20                         # even partials 20 dB under H3


def test_mutation_stops_sound_at_their_ratios():
    for stop, ratio in (("nazard 2 2/3", 3.0), ("tierce 1 3/5", 5.0), ("octave 4", 2.0)):
        y, spoke = organ.play([(0.0, 1.0, [48])], [stop])
        f = spoke[0][2]
        assert abs(f / (130.8128 * ratio) - 1) < 0.01, stop
        assert abs(peak_hz(y[FS // 4:FS], FS, 0.9 * f, 1.1 * f) / f - 1) < 0.002, stop


def test_wind_settles_to_its_sag_with_the_reservoir_time_constant():
    counts = np.r_[np.zeros(FS // 10), np.full(FS, 12)]
    p = organ.wind(counts, FS, k=0.04, tau=0.12)
    target = 1 / (1 + 0.04 * 12)
    assert abs(p[-1] / target - 1) < 0.005
    at_tau = p[FS // 10 + int(0.12 * FS)]
    assert abs((1 - at_tau) / (1 - target) - (1 - math.exp(-1))) < 0.02


# G4: tempo map and metre

def test_constant_map_places_notes_like_the_arrangement():
    tm = T.TempoMap([T.Point(0, 96.0)])
    for beat in np.arange(0, 64, 0.25):
        assert tm.sample(beat, FS) == int(round(beat * 60.0 * FS / 96.0))


def test_ritardando_has_its_closed_form_and_reads_back_within_one_percent():
    tm = T.TempoMap([T.Point(0, 120.0, True), T.Point(4, 60.0), T.Point(8, 60.0)])
    assert abs(tm.seconds(4) - 4 * math.log(2)) < 1e-12
    numeric, _ = quad(lambda b: 60.0 / tm.bpm(b), 0, 4, epsabs=1e-13)
    assert abs(tm.seconds(4) - numeric) < 1e-9
    onsets = np.array([tm.sample(b, FS) for b in np.arange(0, 4.01, 0.25)])      # clicks every sixteenth
    read = 60.0 * 0.25 * FS / np.diff(onsets)
    want = np.array([tm.bpm(b + 0.125) for b in np.arange(0, 4, 0.25)])
    assert np.max(np.abs(read / want - 1)) < 0.01
    assert np.max(np.abs(read / 120.0 - 1)) > 0.3                                 # planted: no ritardando


def test_metre_changes_put_bar_lines_on_exact_samples():
    tm = T.TempoMap([T.Point(0, 90.0)], metre=[(1, 4, 4), (5, 3, 4), (9, 6, 8)])
    assert tm.bar_beat(5) == 16 and tm.bar_beat(9) == 28 and tm.bar_beat(10) == 31
    assert tm.sample(tm.bar_beat(10), FS) - tm.sample(tm.bar_beat(9), FS) == 96000   # 3 beats at 90 bpm


def test_retimed_notes_land_on_the_map_samples_in_an_arrangement():
    tm = T.TempoMap([T.Point(0, 100.0), T.Point(8, 100.0, True), T.Point(16, 70.0), T.Point(24, 70.0)])
    notes = [Note(b, 0.5, 60) for b in np.arange(0, 24, 0.5)]
    for n, r in zip(notes, T.retime(notes, tm, 96.0)):
        assert int(round(r.beat * 60.0 * FS / 96.0)) == tm.sample(n.beat, FS)
