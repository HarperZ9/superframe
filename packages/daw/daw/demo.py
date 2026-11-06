# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A short demo piece, rendered offline from a seed: seven objects of five materials in one room.

    python -I -m daw.demo OUT_DIR [--seed STRING] [--seconds S]     (run from packages/daw)

Writes demo.wav (48 kHz, 16-bit stereo), demo.flac, receipt.json, and prints the PCM sha256. The notes
are drawn from the seed through the superstack seed rule, so the same seed always gives the same bytes.
"""
import argparse
import json
import sys
from pathlib import Path

import numpy as np

from . import materials as M
from . import superstack as ss
from .arrange import Arrangement, Envelope, Instrument, Note, Track
from .export import receipt, write
from .mixer import mix
from .outline import Outline, polygon_mask
from .room import Room
from .shapes_1d import Bar, String, Tube
from .shapes_2d import CircularMembrane, CircularPlate

SCALE = [0, 2, 3, 7, 9]          # a pentatonic set of steps above the root, in semitones
LEAF = [(0.5, 0.02), (0.86, 0.3), (0.78, 0.78), (0.5, 0.98), (0.22, 0.78), (0.14, 0.3)]


def instruments():
    al, oak, steel = M.material("aluminium"), M.material("oak"), M.material("steel_mild")
    brass, glass = M.material("brass"), M.material("glass_crown")
    leaf = Outline(polygon_mask(LEAF, 72), 0.3, glass, h=0.004, k=24)
    return {
        "aluminium bar": Instrument("aluminium bar", Bar(al, 0.3, 0.012), "strike", (0.5,), (0.02,), 1.2e-3, 3.0),
        "oak bar": Instrument("oak bar", Bar(oak, 0.35, 0.02), "strike", (0.5,), (0.03,), 3e-3, 1.0),
        "steel string": Instrument("steel string", String(steel, 0.65, 0.4e-3, 70.0), "pluck", (0.13,), (0.31,), tail=2.5),
        "brass plate": Instrument("brass plate", CircularPlate(brass, 0.2, 0.002), "strike", (0.35, 0.4), (0.6, 1.3),
                                  4e-3, 4.0),
        "glass leaf": Instrument("glass leaf", leaf, "strike", (0.42, 0.46), (0.6, 0.55), 0.8e-3, 2.5),
        "air column": Instrument("air column", Tube(0.6, 0.012, "closed-open", M.air_speed(20.0)), "breath",
                                 (0.0,), (0.95,), tail=0.6),
        "drum": Instrument("drum", CircularMembrane(0.18, 1800.0, 0.25), "strike", (0.3, 0.0), (0.5, 0.7), 2e-3, 1.2),
    }


def pick(rng, root, k):
    """k pitches from the scale above root, by the seeded generator."""
    return [root + SCALE[i] + 12 * o for i, o in zip(rng.integers(0, 5, k), rng.integers(0, 2, k))]


def compose(seed, seconds=20.0):
    """The arrangement for a seed: the note choices come from xmur3(seed) through numpy's PCG64."""
    rng = np.random.default_rng(ss.xmur3(seed))
    ins, beats = instruments(), max(4, int(seconds * 96 / 60) - 4)
    t = lambda name, notes, **kw: Track(name, ins[name], notes, **kw)
    vib = [Note(b, 1, p, 0.7) for b, p in zip(range(0, beats, 2), pick(rng, 69, beats // 2))]
    mar = [Note(b + 0.5, 0.5, p, 0.6) for b, p in zip(range(0, beats, 1), pick(rng, 57, beats))]
    strg = [Note(b, 2, p, 0.6) for b, p in zip(range(4, beats, 4), pick(rng, 45, beats // 4))]
    gong = [Note(0, 4, 45, 0.9), Note(16, 4, 43, 0.8)]
    leaf = [Note(b + 0.25, 0.5, p, 0.5) for b, p in zip(range(8, beats, 3), pick(rng, 81, beats // 3))]
    air = [Note(0, 8, 57, 0.4), Note(12, 8, 52, 0.4)]
    drum = [Note(b, 0.5, 40, 0.8 if b % 4 == 0 else 0.5) for b in range(0, beats, 2)]
    tracks = [t("aluminium bar", vib, pan=-0.4, gain_db=-3), t("oak bar", mar, pan=0.35, gain_db=-4),
              t("steel string", strg, pan=-0.15, gain_db=-5), t("brass plate", gong, gain_db=-9, send=0.6),
              t("glass leaf", leaf, pan=0.6, gain_db=-8), t("drum", drum, pan=0.1, gain_db=-7, send=0.2),
              t("air column", air, gain_db=-12, send=0.5,
                automation={"pan": Envelope([(0.0, -0.8), (seconds, 0.8)])})]
    return Arrangement(tracks, bpm=96.0, fs=48000, seconds=seconds, room=Room()), rng


def scene_of(seed, arr):
    return {"kind": "superstack.sound/1", "seed": seed, "rate": arr.fs, "channels": 2,
            "duration_samples": arr.n(), "bpm": arr.bpm, "room": {"dims": list(arr.room.dims), "t60": arr.room.t60},
            "tracks": [{"name": t.name, "notes": len(t.notes), "gain_db": t.gain_db, "pan": t.pan, "send": t.send}
                       for t in arr.tracks]}


def render_demo(out_dir, seed="ringing-objects", seconds=20.0):
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    arr, rng = compose(seed, seconds)
    stereo = mix(arr, rng)
    pcm = write(out / "demo.wav", stereo, arr.fs)
    flac = write(out / "demo.flac", stereo, arr.fs, "flac", 16)
    scene = scene_of(seed, arr)
    rec = receipt(scene, pcm, arr.fs, arr.n(), outputs={"demo.flac": ss.sha256_hex(flac)})
    lufs = ss.integrated_lufs(stereo[: arr.fs * 10].reshape(-1).tolist(), arr.fs, 2)
    rec_doc = {"receipt": rec, "first_10s_lufs": lufs, "peak_dbfs": ss.peak_dbfs(stereo.reshape(-1).tolist())}
    (out / "receipt.json").write_text(json.dumps(rec_doc, indent=1), encoding="utf-8")
    return rec, stereo


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("out")
    ap.add_argument("--seed", default="ringing-objects")
    ap.add_argument("--seconds", type=float, default=20.0)
    a = ap.parse_args(argv)
    rec, _ = render_demo(a.out, a.seed, a.seconds)
    print(rec["content_sha256"])


if __name__ == "__main__":
    main(sys.argv[1:])
