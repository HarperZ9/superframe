# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Known answers for the choir (DAW gap G18): every singer's vibrato rate, depth and pitch offset read back from
their own stem, a chord whose parts sing their notes, a section's vowel within 10 percent of the measured
formants, a shorter tract that raises the formants by the inverse ratio, stems that sum to the mix, and a planted
choir of identical singers that collapses to one voice."""
import math
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from daw import choir as C  # noqa: E402
from daw import sing as G  # noqa: E402
from daw import voice_read as R  # noqa: E402
from measured import load  # noqa: E402

FS = 48000


def mean_cents(y, hz):
    tr = R.f0_track(y, FS)
    return float(np.mean(1200 * np.log2(tr[np.isfinite(tr)] / hz)))


def test_each_singer_reads_back_their_own_vibrato_and_pitch():
    part = {"name": "a", "speaker": 1, "notes": [(0, 220), (3, 220)], "vowels": [(0, "a")], "singers": 6}
    _, stems, rows = C.choir([part], 3.0, FS, seed=5)
    assert len(rows) == 6 and len({round(r["cents"], 3) for r in rows}) == 6
    for r in rows:
        y = stems[r["singer"]][FS:]
        rate, depth = R.vibrato(R.f0_track(y, FS))
        assert abs(rate / r["vibrato_hz"] - 1) < 0.05
        assert abs(depth / r["vibrato_cents"] - 1) < 0.10
        assert abs(mean_cents(y, 220) - r["cents"]) < 3


def test_a_chord_of_four_parts_sings_its_notes():
    notes = (("b", 1, 130.81, -0.6), ("t", 1, 196.0, -0.2), ("al", 2, 261.63, 0.2), ("s", 2, 329.63, 0.6))
    parts = [{"name": n, "speaker": sp, "notes": [(0, f), (2, f)], "vowels": [(0, "a")], "singers": 3, "pan": p}
             for n, sp, f, p in notes]
    mix, stems, rows = C.choir(parts, 2.0, FS, seed=7)
    hz = {n: f for n, _sp, f, _p in notes}
    for r in rows:
        assert abs(mean_cents(stems[r["singer"]][FS // 2:], hz[r["part"]]) - r["cents"]) < 3
    left = sum(math.cos((r["pan"] + 1) * math.pi / 4) * stems[r["singer"]] for r in rows)
    assert np.max(np.abs(left - mix[0])) < 1e-12                        # the stems sum to the mix
    assert mix[0].std() > 0 and mix[1].std() > 0


def test_a_section_sings_the_measured_vowel():
    meas = {(r["speaker"], r["sound"]): r["measured_hz"] for r in load("vocal_tracts_dvtd")["rows"]}
    printed = {"c": 345.0, "walls": False}
    for v, sound in (("a", "tense-a"), ("o", "tense-o")):
        part = {"name": "x", "speaker": 2, "notes": [(0, 110), (1.5, 110)], "vowels": [(0, v)], "singers": 4}
        mix, _, _ = C.choir([part], 1.5, FS, seed=3, tract_sd=0.0, voice=printed)
        f = R.formants(mix.sum(0)[int(0.4 * FS):int(1.3 * FS)], FS)[:2]
        assert all(abs(a / b - 1) < 0.10 for a, b in zip(f, meas[(2, sound)][:2])), (v, f)


def test_a_shorter_tract_raises_the_formants():
    A = G.vowels(1)["a"]
    kw = dict(vibrato=None, jitter=0.0, shimmer=0.0, walls=False)
    base, _ = G.sing([(0, A)], [(0, 110), (1.2, 110)], 1.2, FS, **kw)
    short, _ = G.sing([(0, A)], [(0, 110), (1.2, 110)], 1.2, FS, scale=0.9, **kw)
    f0 = R.formants(base[int(0.3 * FS):int(1.0 * FS)], FS)[:2]
    f1 = R.formants(short[int(0.3 * FS):int(1.0 * FS)], FS)[:2]
    assert all(abs(b / a * 0.9 - 1) < 0.05 for a, b in zip(f0, f1))


def test_identical_singers_collapse_to_one_voice():
    part = {"name": "u", "speaker": 1, "notes": [(0, 165), (1.5, 165)], "vowels": [(0, "schwa")], "singers": 4}
    same = dict(scatter=0.0, vibrato=(5.5, 0.0, 0.25, 0.4), entry_ms=0.0, tract_sd=0.0,
                voice={"jitter": 0.0, "shimmer": 0.0})
    _, flat, _ = C.choir([part], 1.5, FS, seed=1, **same)                # planted: no differences at all
    s = list(flat.values())
    assert all(np.max(np.abs(x - s[0])) < 1e-12 for x in s[1:])
    _, live, _ = C.choir([part], 1.5, FS, seed=1)
    v = list(live.values())
    r = [np.corrcoef(v[0], x)[0, 1] for x in v[1:]]
    assert max(r) < 0.9                                                  # real singers drift apart
