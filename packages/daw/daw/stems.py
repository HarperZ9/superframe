# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Additive stems: every track written as its own file, and the files sum to the master exactly (gap G1).

mixer.mix keeps the room on one shared bus scaled by the peak of its own output, and discards the limiter's
gain curve, so its stems do not sum to its master. Here each part of the master belongs to exactly one stem:
- each track's dry signal (gain and pan as in mixer.place);
- each track's own room return: its send convolved with the room's impulse responses, times one fixed room
  gain for the piece, db(room_return_db) / sqrt(energy of the louder response), set from the room before any
  note is rendered and never from the output;
- one static gain to the piece's target loudness (loudness.gain_to_target), the same for every stem;
- the master limiter's gain curve, computed once on the summed signal and applied to every stem.
Every operation after the per-track render is linear and shared, so sum(stems) equals the master.

Bit-exact rule. At 32-bit float the written master is float32(sum of the float32 stems, added in float64 in
track order); at 24-bit the master is the integer sum of the 24-bit stems. check_sum() rebuilds the master
from the stem files by that rule and compares every bit; leaving any stem out must fail.
"""
import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import oaconvolve

from . import loudness as LD
from . import superstack as ss
from .arrange import render_track
from .mixer import db, limit, place

SUBTYPE = {32: "FLOAT", 24: "PCM_24"}
FULL24 = 2 ** 23 - 1


def room_gain(arr, hl, hr):
    """The piece's fixed linear room gain: the return level over the impulse responses' energy."""
    energy = max(float(np.sum(hl * hl)), float(np.sum(hr * hr)))
    return float(db(arr.room_return_db)) / math.sqrt(energy)


def render(arr, rng, target_lufs=None):
    """Render every track to an additive stereo stem. Returns (stems, info): stems maps track name to an
    (n, 2) float64 array whose sum is the master; info holds the room gain, the loudness gain and the
    limiter's minimum gain, for the receipt."""
    n, fs = arr.n(), arr.fs
    names = [t.name for t in arr.tracks]
    if len(set(names)) != len(names):
        raise ValueError("track names must be unique: each names one stem file")
    ir = arr.room.impulse_responses(fs, rng) if arr.room is not None else None
    g_room = room_gain(arr, *ir) if ir is not None else 0.0
    buses = {}
    for name in sorted(getattr(arr, "spaces", {}) or {}):           # extra spaces, in name order (seeded)
        h = arr.spaces[name].impulse_responses(fs, rng)
        buses[name] = (h, room_gain(arr, *h))
    stems = {}
    for tr in arr.tracks:
        mono = render_track(arr, tr, rng)
        gain = tr.control("gain_db", n, fs)
        st = place(mono, gain, tr.control("pan", n, fs))
        dry = mono * db(gain)
        if getattr(tr, "width", 0.0) > 0:
            st = st + widen(dry, tr.width, tr.name, fs=fs)
        send = dry * tr.send
        if ir is not None and np.any(send):
            st = st + g_room * _wet(send, ir, n)
        for name, level in (getattr(tr, "sends", {}) or {}).items():
            if name not in buses:
                raise KeyError(f"track {tr.name!r} sends to {name!r}, which is not in Arrangement.spaces")
            if level > 0:
                st = st + buses[name][1] * _wet(dry * level, buses[name][0], n)
        stems[tr.name] = st
    pre = sum(stems.values())
    g_loud = LD.gain_to_target(pre, fs, target_lufs) if target_lufs is not None else 1.0
    _, curve = limit(pre * g_loud, arr.ceiling, fs)
    total = g_loud * curve[:, None]
    for k in stems:
        stems[k] = stems[k] * total
    info = {"room_gain": g_room, "loudness_gain_db": 20 * math.log10(g_loud), "target_lufs": target_lufs,
            "limiter_min_gain_db": 20 * math.log10(max(float(curve.min()), 1e-12))}
    return stems, info


def _wet(x, ir, n):
    return np.stack([oaconvolve(x, ir[0])[:n], oaconvolve(x, ir[1])[:n]], 1)


def widen(mono, width, name, ms=25.0, fs=48000):
    """A side signal for stereo width: the track through two different sparse decorrelation filters (velvet
    noise, Jarvelainen and Karjalainen 2007: +/-1 pulses about every 1.5 ms over `ms` milliseconds, unit energy),
    left minus right, scaled by width / 2. Added to a mid-placed stem it leaves the mono sum (L + R) unchanged,
    so the track is wider without being louder or thinner in mono."""
    rng = np.random.default_rng(ss.xmur3("widen:" + name))
    m = int(ms * fs / 1000)
    taps = []
    for _ in range(2):
        v = np.zeros(m)
        idx = np.arange(0, m, 72) + rng.integers(0, 72, len(range(0, m, 72)))
        idx = idx[idx < m]
        v[idx] = rng.choice((-1.0, 1.0), len(idx)) * np.exp(-3.0 * idx / m)
        taps.append(v / np.sqrt(np.sum(v * v)))
    side = (oaconvolve(mono, taps[0])[: len(mono)] - oaconvolve(mono, taps[1])[: len(mono)]) * width / 2
    return np.stack([side, -side], 1)


def quantise(stem, bits):
    """The stem as it is written: float32 for 32-bit, integers in [-2^23 + 1, 2^23 - 1] for 24-bit."""
    if bits == 32:
        return np.asarray(stem, np.float32)
    if bits == 24:
        return np.floor(np.clip(stem, -1.0, 1.0) * FULL24 + 0.5).astype(np.int32)
    raise ValueError("stems are written at 24-bit integer or 32-bit float")


def master_of(quantised, bits):
    """The master from written stems, by the bit-exact rule (track order, float64 accumulator)."""
    acc = np.zeros(next(iter(quantised.values())).shape, np.float64 if bits == 32 else np.int64)
    for q in quantised.values():
        acc += q
    if bits == 32:
        return acc.astype(np.float32)
    if np.any(np.abs(acc) > FULL24):
        raise ValueError("the integer sum of the 24-bit stems passes full scale; lower the ceiling")
    return acc.astype(np.int32)


def _write(path, data, fs, bits):
    if bits == 24:   # libsndfile writes PCM_24 from int32 by its top 24 bits
        sf.write(str(path), (data.astype(np.int64) << 8).astype(np.int32), fs, subtype="PCM_24")
    else:
        sf.write(str(path), data, fs, subtype="FLOAT")


def _read(path, bits):
    if bits == 24:
        return (sf.read(str(path), dtype="int32")[0].astype(np.int64) >> 8).astype(np.int32)
    return sf.read(str(path), dtype="float32")[0]


def write(out_dir, stems, fs, name="master", bits=32):
    """Write every stem and the master. Returns the rows for the receipt: file, sha256 of the file, and the
    stem's loudness and true peak."""
    out = Path(out_dir)
    (out / "stems").mkdir(parents=True, exist_ok=True)
    q = {k: quantise(v, bits) for k, v in stems.items()}
    files = {f"stems/{_slug(k)}.wav": v for k, v in q.items()}
    files[f"{name}.wav"] = master_of(q, bits)
    rows = []
    for rel, data in files.items():
        _write(out / rel, data, fs, bits)
        f = data.astype(np.float64) / (FULL24 if bits == 24 else 1.0)
        m = LD.measure(f, fs) if np.any(f) else {"integrated_lufs": None, "true_peak_dbtp": None}
        rows.append({"file": rel, "sha256": ss.sha256_hex((out / rel).read_bytes()), "bits": bits,
                     "integrated_lufs": _num(m["integrated_lufs"]), "true_peak_dbtp": _num(m["true_peak_dbtp"])})
    (out / "stems.json").write_text(json.dumps({"master": f"{name}.wav", "bits": bits, "order": list(stems),
                                                "files": rows}, indent=1), encoding="utf-8")
    return rows


def check_sum(out_dir, leave_out=None):
    """Rebuild the master from the stem files and compare it bit for bit. leave_out names one stem to drop,
    as the planted control. Returns {"equal": bool, "max_abs_diff": float}."""
    out = Path(out_dir)
    man = json.loads((out / "stems.json").read_text(encoding="utf-8"))
    bits = man["bits"]
    q = {k: _read(out / f"stems/{_slug(k)}.wav", bits) for k in man["order"] if k != leave_out}
    rebuilt, master = master_of(q, bits), _read(out / man["master"], bits)
    diff = float(np.max(np.abs(rebuilt.astype(np.float64) - master.astype(np.float64))))
    return {"equal": bool(np.array_equal(rebuilt, master)), "max_abs_diff": diff}


def receipt(out_dir, scene, rows, info, fs, does_not_prove=()):
    """Write receipt.json: a superstack.receipt/1 record whose content hash is the master by the superstack
    16-bit rule, every written file's sha256 as an output, the master's R128 loudness, and the render
    gains. Returns the document."""
    from .export import DOES_NOT_PROVE, pcm_s16
    from .export import receipt as make
    out = Path(out_dir)
    man = json.loads((out / "stems.json").read_text(encoding="utf-8"))
    master = _read(out / man["master"], man["bits"]).astype(np.float64)
    if man["bits"] == 24:
        master /= FULL24
    rec = make(scene, pcm_s16(master), fs, len(master), outputs={r["file"]: r["sha256"] for r in rows})
    doc = {"receipt": rec, "loudness": LD.measure(master, fs), "render": info, "stems": rows,
           "notes": list(DOES_NOT_PROVE) + list(does_not_prove)}
    (out / "receipt.json").write_text(json.dumps(doc, indent=1), encoding="utf-8")
    return doc


def _slug(name):
    return "".join(c if c.isalnum() or c in "-_" else "-" for c in name.lower())


def _num(x):
    return None if x is None or not math.isfinite(x) else float(x)
