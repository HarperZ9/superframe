# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Scenes that make their own sound: one physics record read by the renderer and by the DAW.

A scene record names its medium, its listener and its sources in SI units. The renderer reads the same record
for what it draws (for rain, the number of drops per cubic metre and their mean size) as the DAW reads for what
it plays (the drops that land per second, their sizes, speeds and the bubbles they leave). Neither side keeps
its own copy of a physical value, so the picture and the sound cannot drift apart. ARCHITECTURE.md beside this
package describes the binding; this module is its first source, rain.

Rain (Marshall and Palmer 1948, rows mp1948.N0 and mp1948.Lambda in packages/measured): drops of diameter D (mm)
have number density N(D) = N0 exp(-Lambda D), Lambda = 4.1 R^-0.21 mm^-1 at rain rate R mm/h. They fall at
terminal speed v(D) = 9.65 - 10.3 exp(-0.6 D) m/s (Atlas, Srivastava and Sekhon 1973; from memory, high), so the
drops landing per square metre per second are the integral of N(D) v(D). A drop of 0.8 to 1.1 mm landing on
water at terminal speed entrains a small bubble every time (Pumphrey and Crum 1989; the window from memory,
moderate), radius near 0.22 mm, which rings at its Minnaert frequency (wavelab), near 15 kHz: the narrow peak
of light rain heard under water. Drops above 2.2 mm sometimes trap larger bubbles (Medwin et al. 1992; the 0.5
chance and the 0.5 to 1.5 mm radii are from memory, low). Every drop also gives an impact click whose size
scales with its momentum. Bubble damping uses a total damping constant 0.055 near 15 kHz (thermal, radiation
and viscous terms together; from memory, moderate).
"""
import math

import numpy as np

from . import PKG  # noqa: F401
from . import nature
from . import superstack as ss
from measured import load

D_GRID = np.linspace(0.1, 6.0, 600)          # mm
REGULAR = (0.8, 1.1)                         # mm, regular entrainment window
DELTA = 0.055


def mp_constants():
    rows = {r["id"]: r["value"] for r in load("facts")["rows"]}
    return rows["mp1948.N0"], rows["mp1948.Lambda"]


def terminal_speed(d_mm):
    return np.maximum(9.65 - 10.3 * np.exp(-0.6 * np.asarray(d_mm, float)), 0.0)


def number_density(d_mm, rate):
    """N(D) in m^-3 mm^-1 at rain rate `rate` mm/h."""
    n0, lam = mp_constants()
    return n0 * np.exp(-lam * rate ** -0.21 * np.asarray(d_mm, float))


def drop_flux(rate):
    """Drops landing per square metre per second."""
    return float(np.trapezoid(number_density(D_GRID, rate) * terminal_speed(D_GRID), D_GRID))


def visual_params(record):
    """What the renderer draws for each rain source: drops per cubic metre and their mean diameter (mm)."""
    out = []
    for s in record["sources"]:
        if s["kind"] == "rain":
            n = number_density(D_GRID, s["rate_mm_h"])
            out.append({"drops_per_m3": float(np.trapezoid(n, D_GRID)),
                        "mean_diameter_mm": float(np.trapezoid(n * D_GRID, D_GRID) / np.trapezoid(n, D_GRID))})
    return out


def rain_events(source, seconds, rng):
    """Arrival time (s), diameter (mm), speed (m/s) and landing point (m) of every drop in `seconds`."""
    rate, area = source["rate_mm_h"], source["area_m2"]
    lam_t = drop_flux(rate) * area
    n = rng.poisson(lam_t * seconds)
    w = number_density(D_GRID, rate) * terminal_speed(D_GRID)
    cdf = np.cumsum(w) / w.sum()
    d = np.interp(rng.random(n), cdf, D_GRID)
    t = np.sort(rng.random(n) * seconds)
    half = math.sqrt(area) / 2
    xy = rng.uniform(-half, half, (n, 2)) + np.asarray(source["centre"][:2])
    pos = np.column_stack([xy, np.full(n, source["centre"][2])])
    return t, d, terminal_speed(d), pos


def drop_sound(d, v, rng, fs, entrain=True):
    """One drop's waveform: a momentum-scaled click and, on water, the bubble it may leave."""
    mass = 1000.0 * math.pi / 6 * (d * 1e-3) ** 3
    click = mass * v * 2e3 * np.hanning(max(3, int(5e-5 * fs)))
    radius = None
    if entrain and REGULAR[0] <= d <= REGULAR[1]:
        radius = 0.22e-3 * (1 + 0.1 * rng.standard_normal())
    elif entrain and d > 2.2 and rng.random() < 0.5:
        radius = rng.uniform(0.5e-3, 1.5e-3)
    if radius is None:
        return click
    f = nature.minnaert_frequency(radius)
    m = int(min(0.02, 8.0 / (math.pi * f * DELTA)) * fs)
    t = np.arange(m) / fs
    ring = 0.02 * np.exp(-math.pi * f * DELTA * t) * np.sin(2 * math.pi * f * t)
    ring[:len(click)] += click
    return ring


def render(record, seconds, fs=48000, entrain=True):
    """Offline render of every rain source at the listener: each drop delayed by r / c and spread as 1 / r."""
    rng = np.random.default_rng(ss.xmur3(ss.substream(record["seed"], "rain")))
    c = nature.consts.water(293.15)["c"] if record["medium"] == "water" else 343.0
    lis = np.asarray(record["listener"], float)
    out = np.zeros(int(seconds * fs) + fs // 10)
    for s in record["sources"]:
        if s["kind"] != "rain":
            continue
        t, d, v, pos = rain_events(s, seconds, rng)
        r = np.maximum(np.linalg.norm(pos - lis, axis=1), 0.05)
        for ti, di, vi, ri in zip(t, d, v, r):
            w = drop_sound(di, vi, rng, fs, entrain) / ri
            i = int(round((ti + ri / c) * fs))
            out[i:i + len(w)] += w[:max(0, len(out) - i)]
    return out[:int(seconds * fs)]


def sample_of_flicks(t_flicks, fs):
    """An engine event time on the flick clock to its exact audio sample (flicks per sample is an integer)."""
    per = ss.flicks_per_sample(fs)
    if t_flicks % per:
        raise ValueError("event time is not on the sample grid")
    return t_flicks // per


RAIN_SCENE = {"kind": "superframe.scene-physics/1", "seed": "forest-in-rain", "medium": "water",
              "listener": [0.0, 0.0, -1.0],
              "sources": [{"kind": "rain", "rate_mm_h": 2.0, "area_m2": 4.0, "centre": [0.0, 0.0, 0.0]}]}


def render_to_wav(record, seconds, out_dir, fs=48000):
    """Render a scene record to demo WAV with a receipt that carries the record's hash and the visual parameters
    the renderer reads from the same record, so one receipt binds the picture's inputs to the sound."""
    from pathlib import Path
    from .export import receipt, write
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    y = render(record, seconds, fs)
    y = 0.5 * y / max(1e-12, np.max(np.abs(y)))
    stereo = np.column_stack([y, y])
    pcm = write(out / "scene.wav", stereo, fs)
    scene = {"kind": "superstack.sound/1", "seed": record["seed"], "rate": fs, "channels": 2,
             "duration_samples": len(y), "scene_physics_sha256": ss.canonical_sha256(record),
             "visual": [{k: round(v, 6) for k, v in p.items()} for p in visual_params(record)]}
    return receipt(scene, pcm, fs, len(y))
