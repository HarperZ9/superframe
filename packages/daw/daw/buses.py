# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Group buses and sidechain compression that keep the stems additive.

A bus gathers the tracks whose `Track.bus` names it. Its processing is one gain curve over time, computed once
from a detector signal and applied to every member's whole stem (dry, pan, width and its own sends), so the
member stems still sum to the master bit for bit by the rule in stems.py: g (a + b) is applied as g a + g b,
each stem written on its own.

- `gain_db`: a fixed bus level.
- `compressor`: a feed-forward compressor. The detector is the bus sum's peak, max(|L|, |R|), or a key track's
  dry signal when `sidechain` names a track (the kick that ducks a pad), held at its largest value over the last
  `hold` seconds (a causal running maximum). Gain reduction in dB is the hard-knee
  static curve (over the threshold, 1 - 1 / ratio of the excess), smoothed by one pole with the attack time
  constant while the reduction grows and the release time constant while it shrinks.

The bus acts on the member's full stem, so a ducked pad's reverb return ducks with it (post-fader sends).
"""
import math
from dataclasses import dataclass

import numpy as np
from scipy.ndimage import maximum_filter1d


@dataclass(frozen=True)
class Compressor:
    threshold_db: float = -18.0
    ratio: float = 4.0
    attack: float = 0.005      # seconds: time constant of a growing gain reduction
    release: float = 0.120     # seconds: time constant of a shrinking one
    makeup_db: float = 0.0
    hold: float = 0.020        # seconds: the detector holds the largest peak this long, so a cycle's zero
                               # crossings do not ripple the gain (longer than one period of 50 Hz)


@dataclass(frozen=True)
class Bus:
    gain_db: float = 0.0
    compressor: Compressor = None
    sidechain: str = None      # a track name: its dry signal drives the compressor in place of the bus sum


def static_reduction(level_db, comp):
    """Gain reduction in dB (zero or negative) for a detector level, from the hard-knee static curve."""
    over = np.maximum(np.asarray(level_db, float) - comp.threshold_db, 0.0)
    return -over * (1.0 - 1.0 / comp.ratio)


def smooth(target_db, comp, fs):
    """One-pole attack and release over the gain reduction in dB (a per-sample loop: the branch decides the pole)."""
    a_att = math.exp(-1.0 / (comp.attack * fs))
    a_rel = math.exp(-1.0 / (comp.release * fs))
    out = np.empty(len(target_db))
    y = 0.0
    for i, x in enumerate(target_db.tolist()):
        a = a_att if x < y else a_rel
        y = a * y + (1.0 - a) * x
        out[i] = y
    return out


def gain_curve(detector, comp, fs):
    """Linear gain over time from a detector signal (mono, or stereo as (n, 2))."""
    d = np.asarray(detector, float)
    peak = np.max(np.abs(d), 1) if d.ndim == 2 else np.abs(d)
    w = 2 * max(int(round(comp.hold * fs)) // 2, 0) + 1                  # odd window; causal: the last w samples
    peak = maximum_filter1d(np.r_[np.zeros(w // 2), peak], w, mode="constant")[:len(peak)]
    level = 20.0 * np.log10(np.maximum(peak, 1e-9))
    g_db = smooth(static_reduction(level, comp), comp, fs) + comp.makeup_db
    return 10.0 ** (g_db / 20.0)


def apply(arr, stems, dry, fs):
    """Apply every bus of `arr` to its members' stems in place; returns {bus: minimum gain in dB} for the receipt.
    `dry` maps track name to its dry mono signal (after its own gain), the sidechain source."""
    report = {}
    buses = getattr(arr, "buses", {}) or {}
    for tr in arr.tracks:
        name = getattr(tr, "bus", None)
        if name is not None and name not in buses:
            raise KeyError(f"track {tr.name!r} is routed to bus {name!r}, which is not in Arrangement.buses")
    for name in sorted(buses):
        bus = buses[name]
        members = [tr.name for tr in arr.tracks if getattr(tr, "bus", None) == name]
        if not members:
            continue
        g = np.full(len(stems[members[0]]), 10.0 ** (bus.gain_db / 20.0))
        if bus.compressor is not None:
            if bus.sidechain is not None:
                if bus.sidechain not in dry:
                    raise KeyError(f"bus {name!r} sidechain {bus.sidechain!r} is not a track")
                detector = dry[bus.sidechain]
            else:
                detector = sum(stems[m] for m in members)
            g = g * gain_curve(detector, bus.compressor, fs)
        for m in members:
            stems[m] = stems[m] * g[:, None]
        report[name] = 20.0 * math.log10(max(float(g.min()), 1e-12))
    return report
