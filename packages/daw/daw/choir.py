# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A choir from the expressive tract: parts of several singers, each a whole voice of its own.

Every singer is drawn from the seeded generator, so a choir is a list of people who differ the way singers in a
section differ: a pitch offset (cents, sd `scatter`), their own vibrato rate and depth, a late or early entry,
a tract a little longer or shorter than the measured one (which moves every formant by the inverse ratio), their
own jitter and shimmer seeds, and a place in the stereo field (equal-power pan). A part sings one pitch line
and one vowel path over the shapes of one measured speaker (`sing.vowels`); a chord is several parts. The mix
is the sum of the singers' stems, each normalised to the same peak and divided by the number of singers, so
stems and mix agree to rounding. The receipt lists every singer's drawn values, which is what the tests read
back against.
"""
import math

import numpy as np

from . import sing as G


def draw(rng, scatter, vibrato, entry_ms, tract_sd, pan):
    rate, depth, onset, fade = vibrato
    return {"cents": float(rng.normal(0.0, scatter)),
            "vibrato": (float(rng.normal(rate, 0.25)), float(max(0.0, rng.normal(depth, 0.12 * depth))),
                        onset, fade),
            "entry_s": float(abs(rng.normal(0.0, entry_ms / 1000.0))),
            "scale": float(rng.normal(1.0, tract_sd)),
            "pan": float(np.clip(pan + rng.uniform(-0.15, 0.15), -1.0, 1.0)),
            "seed": int(rng.integers(0, 2 ** 31))}


def _singer(part, s, seconds, fs, voice):
    shapes = G.vowels(part.get("speaker", 1))
    path = [(t, shapes[v]) for t, v in part["vowels"]]
    k = 2.0 ** (s["cents"] / 1200.0)
    points = [(t, hz * k) for t, hz in part["notes"]]
    lead = int(round(s["entry_s"] * fs))
    y, _ = G.sing(path, points, seconds, fs, vibrato=s["vibrato"], seed=s["seed"], scale=s["scale"], **voice)
    return np.concatenate([np.zeros(lead), y])[:len(y)]


def choir(parts, seconds, fs, seed=0, scatter=12.0, vibrato=(5.5, 45.0, 0.25, 0.4), entry_ms=25.0,
          tract_sd=0.02, voice=None):
    """parts: [{"name", "speaker", "notes": [(t, Hz)], "vowels": [(t, sound)], "singers": n, "pan": p}].
    Returns (stereo mix (2, n), {singer id: mono stem}, receipt rows)."""
    voice = dict(voice or {})
    rng = np.random.default_rng(seed)
    total = sum(p.get("singers", 4) for p in parts)
    n = int(seconds * fs)
    mix, stems, rows = np.zeros((2, n)), {}, []
    for part in parts:
        for i in range(part.get("singers", 4)):
            s = draw(rng, scatter, vibrato, entry_ms, tract_sd, part.get("pan", 0.0))
            sid = f"{part['name']}{i + 1}"
            y = _singer(part, s, seconds, fs, voice) / total
            th = (s["pan"] + 1) * math.pi / 4
            mix[0] += math.cos(th) * y
            mix[1] += math.sin(th) * y
            stems[sid] = y
            rows.append({"singer": sid, "part": part["name"], **{k: v for k, v in s.items() if k != "vibrato"},
                         "vibrato_hz": s["vibrato"][0], "vibrato_cents": s["vibrato"][1]})
    return mix, stems, rows
