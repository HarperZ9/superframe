# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the expressive tract: measured vowels sung back within 10 percent of their measured
formants, a vowel glide that ends where its second shape says, a pitch line and vibrato read back from the
audio, jitter read back from the flow, and effort read back as the H1 - H2 tilt."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import sing as G  # noqa: E402
from daw import tract as T  # noqa: E402
from daw import voice_read as R  # noqa: E402
from measured import load  # noqa: E402

FS = 48000
PRINTED = dict(vibrato=None, jitter=0.0, shimmer=0.0, c=345.0, walls=False)   # the printed models: rigid, room air


def measured(speaker, sound):
    rows = {(r["speaker"], r["sound"]): r["measured_hz"] for r in load("vocal_tracts_dvtd")["rows"]}
    return rows[(speaker, sound)]


def test_vectorised_transfer_equals_the_reference_chain():
    A, L = G.vowels(1)["a"]
    f = np.linspace(50, 5000, 300)
    for walls in (False, True):
        a = G.transfer(f, A, np.full(len(A), L / len(A)), 345.0, walls=walls)
        b = T.transfer(f, A, np.full(len(A), L / len(A)), 345.0, walls=walls)
        assert np.max(np.abs(a - b) / np.abs(b)) < 1e-9


def test_sung_vowels_meet_their_measured_formants():
    cases = [(1, "a", "tense-a"), (1, "ae", "tense-ae"), (1, "schwa", "schwa"), (2, "a", "tense-a"),
             (2, "o", "tense-o"), (2, "schwa", "schwa")]
    for spk, v, sound in cases:
        y, _ = G.sing([(0, G.vowels(spk)[v])], [(0, 110), (1.2, 110)], 1.2, FS, **PRINTED)
        f = R.formants(y[int(0.3 * FS):int(1.0 * FS)], FS)[:2]
        assert all(abs(a / b - 1) < 0.10 for a, b in zip(f, measured(spk, sound)[:2])), (spk, v, f)


def test_a_vowel_glide_lands_on_each_shape():
    V = G.vowels(2)
    path = [(0, V["a"]), (0.5, V["a"]), (0.8, V["e"]), (1.4, V["e"])]
    y, _ = G.sing(path, [(0, 110), (1.4, 110)], 1.4, FS, **PRINTED)
    start = R.formants(y[int(0.1 * FS):int(0.45 * FS)], FS)[:2]
    end = R.formants(y[int(0.9 * FS):int(1.3 * FS)], FS)[:2]
    assert all(abs(a / b - 1) < 0.10 for a, b in zip(start, measured(2, "tense-a")[:2]))
    assert all(abs(a / b - 1) < 0.10 for a, b in zip(end, measured(2, "tense-e")[:2]))
    mid = [R.formants(y[int(t * FS):int((t + 0.06) * FS)], FS)[1] for t in (0.55, 0.62, 0.7)]
    assert start[1] < mid[0] < mid[1] < mid[2] < end[1]                 # F2 rises through the glide


def test_pitch_line_and_vibrato_read_back():
    V = G.vowels(1)
    y, _ = G.sing([(0, V["schwa"])], [(0, 120), (0.3, 120), (0.7, 180), (1.0, 180)], 1.0, FS,
                  vibrato=None, jitter=0.0, shimmer=0.0)
    tr = R.f0_track(y, FS)
    t = np.arange(len(tr)) * 0.005 + 0.02
    lo, hi = np.nanmedian(tr[(t > 0.1) & (t < 0.25)]), np.nanmedian(tr[(t > 0.8) & (t < 0.95)])
    assert abs(R.cents(lo, 120)) < 5 and abs(R.cents(hi, 180)) < 5
    rise = tr[(t > 0.35) & (t < 0.65)]
    assert np.all(np.diff(rise[np.isfinite(rise)]) > -0.5)
    for v in ("a", "schwa"):
        y, _ = G.sing([(0, V[v])], [(0, 220), (3, 220)], 3.0, FS, vibrato=(5.5, 60.0, 0.3, 0.4), seed=1)
        rate, depth = R.vibrato(R.f0_track(y[FS:], FS))
        assert abs(rate / 5.5 - 1) < 0.05 and abs(depth / 60 - 1) < 0.10
    flat, _ = G.sing([(0, V["a"])], [(0, 220), (3, 220)], 3.0, FS, vibrato=None, seed=1)   # planted: none
    assert R.vibrato(R.f0_track(flat[FS:], FS))[1] < 10


def test_jitter_and_shimmer_read_back_from_the_flow():
    f0 = np.full(4 * FS, 150.0)
    for target in (0.005, 0.01, 0.02):
        flow, _ = G.source(f0, FS, 0.5, target, 0.0, 0.0, np.random.default_rng(2))
        opens = np.flatnonzero((flow[1:] > 0) & (flow[:-1] <= 0))
        P = np.diff(opens).astype(float)
        assert abs(np.mean(np.abs(np.diff(P))) / P.mean() / target - 1) < 0.25
    flow, _ = G.source(f0, FS, 0.5, 0.0, 0.05, 0.0, np.random.default_rng(3))
    opens = np.flatnonzero((flow[1:] > 0) & (flow[:-1] <= 0))
    peaks = np.array([flow[a:b].max() for a, b in zip(opens[:-1], opens[1:])])
    assert abs(np.std(peaks) / np.mean(peaks) / 0.05 - 1) < 0.15
    a, _ = G.sing([(0, G.vowels(1)["a"])], [(0, 150), (0.5, 150)], 0.5, FS, seed=9)
    b, _ = G.sing([(0, G.vowels(1)["a"])], [(0, 150), (0.5, 150)], 0.5, FS, seed=9)
    assert np.array_equal(a, b)


def _h1h2(y, f0):
    s = y[int(0.3 * FS):int(1.1 * FS)]
    sp = 20 * np.log10(np.abs(np.fft.rfft(s * np.hanning(len(s)))) + 1e-12)
    fr = np.fft.rfftfreq(len(s), 1.0 / FS)
    near = lambda f: sp[np.abs(fr - f) < 4].max()                      # noqa: E731
    return near(f0) - near(2 * f0)


def test_effort_presses_the_voice():
    V = G.vowels(1)
    soft, _ = G.sing([(0, V["a"])], [(0, 120), (1.2, 120)], 1.2, FS, vibrato=None, jitter=0, shimmer=0, effort=0.1)
    pressed, _ = G.sing([(0, V["a"])], [(0, 120), (1.2, 120)], 1.2, FS, vibrato=None, jitter=0, shimmer=0, effort=0.9)
    assert _h1h2(soft, 120) - _h1h2(pressed, 120) > 5.0
    assert G.effort_pulse(0.1)[0] > G.effort_pulse(0.9)[0]
    breathy, _ = G.sing([(0, V["a"])], [(0, 120), (1.2, 120)], 1.2, FS, vibrato=None, jitter=0, shimmer=0,
                        aspiration=0.2, seed=4)
    assert R.hnr(breathy[int(0.3 * FS):int(1.1 * FS)], FS, 120) < R.hnr(soft[int(0.3 * FS):int(1.1 * FS)], FS, 120) - 6
    assert math.isfinite(_h1h2(breathy, 120))
