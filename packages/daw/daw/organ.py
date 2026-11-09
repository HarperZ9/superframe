# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Pipe organ from the air column (gap G15): flue pipes, ranks and stops by footage, and a wind supply that sags.

Pitch. A pipe is a `shapes_1d.Tube`: open at both ends it speaks c / (2 L_e), stopped (closed at the top) it
speaks c / (4 L_e) an octave lower, with the Levine-Schwinger end correction 0.6133 r per open end in L_e. The
pipe for a pitch is cut to L = c / (2 f) - 2 (0.6133 r) (open) or c / (4 f) - 0.6133 r (stopped), so the
render's pitch comes back out of the tube. A rank's footage names its pitch: an 8' stop sounds the key, 4' an
octave up, 2 2/3' (the nazard) a twelfth, 2' two octaves, 1 3/5' (the tierce) two octaves and a third; the
ratio is 8 / footage, and a 16' or 8' stopped rank is cut half as long as an open one.

Tone. A jet-driven pipe locks its partials to exact harmonics of the fundamental (the jet drives the column
in a periodic regime even though the column's own resonances are slightly stretched). The partial levels are a
voicing choice, not measured: open principals fall as n^-1.2, stopped flutes keep odd partials and hold even
ones 30 dB down (a closed-open column has odd resonances only). Speech: the second partial speaks first and the
fundamental grows in over the attack (the "chiff"), with a short burst of jet noise; release falls in 40 ms after the key
is let go. Every partial comes from one recurrence oscillator (`voice`), not libm's sine, so clap/organ.c gives
the same bits.

Wind. All pipes share one supply. A pipe's level follows the supply pressure, which falls when more pipes
speak, p = p0 / (1 + k n), and settles with the reservoir's time constant. Pitch is held constant under sag
(a real flue pipe's pitch rises slightly with pressure; not modelled).
"""
import math
from dataclasses import dataclass

import numpy as np
from scipy.signal import sosfilt

from .materials import air_speed
from .modes import midi_hz
from .shapes_1d import LEVINE_SCHWINGER, Tube


@dataclass(frozen=True)
class Rank:
    name: str
    footage: float             # 8.0 is unison pitch; 4.0 an octave up; 2 2/3 a twelfth
    stopped: bool = False
    scale: float = 0.035       # pipe radius over its length (a voicing choice; a wide flute or a narrow string)
    level: float = 1.0


STOPS = {
    "principal 8": Rank("principal 8", 8.0),
    "octave 4": Rank("octave 4", 4.0, level=0.7),
    "stopped flute 8": Rank("stopped flute 8", 8.0, stopped=True, scale=0.06),
    "nazard 2 2/3": Rank("nazard 2 2/3", 8.0 / 3.0, scale=0.05, level=0.5),
    "fifteenth 2": Rank("fifteenth 2", 2.0, level=0.5),
    "tierce 1 3/5": Rank("tierce 1 3/5", 1.6, scale=0.05, level=0.4),
}


def pipe_for(f, stopped=False, scale=0.035, c=None):
    """The Tube that speaks f: length cut for the end corrections, radius = scale x length."""
    c = air_speed() if c is None else c
    quarter = c / (4 * f) if stopped else c / (2 * f)
    n_open = 1 if stopped else 2
    length = quarter / (1 + n_open * LEVINE_SCHWINGER * scale)    # L + n 0.6133 (scale L) = quarter
    return Tube(length, scale * length, "closed-open" if stopped else "open-open", c)


MAX_PARTIALS = 24
RELEASE = 0.04                 # seconds; the pipe falls to silence in a straight line after the key is let go
NOISE = 0.034641016151377546   # jet-noise amplitude: uniform in [-1, 1) at 0.02 sqrt(3), the old Gaussian's RMS
_GOLD, _M1, _M2 = 0x9E3779B97F4A7C15, 0xBF58476D1CE4E5B9, 0x94D049BB133111EB


def levels(stopped):
    """Partial levels for k = 1 .. MAX_PARTIALS: open n^-1.2; stopped odd n^-1.5 with even partials 30 dB down."""
    k = np.arange(1, MAX_PARTIALS + 1)
    if stopped:
        return np.where(k % 2 == 1, k ** -1.5, 10 ** (-30 / 20) * k ** -1.5)
    return k ** -1.2


def noise(serial, n, seed=0):
    """Jet noise for one pipe: splitmix64 of (serial << 32 | sample), uniform in [-1, 1). Counter-based, so C
    computes the same doubles (clap/organ.c)."""
    z = (np.uint64(serial) << np.uint64(32)) | np.arange(n, dtype=np.uint64)
    z = z + np.uint64((seed * _GOLD + _GOLD) % (1 << 64))
    z = (z ^ (z >> np.uint64(30))) * np.uint64(_M1)
    z = (z ^ (z >> np.uint64(27))) * np.uint64(_M2)
    z = z ^ (z >> np.uint64(31))
    return ((z >> np.uint64(11)).astype(np.float64) * 2.0 ** -53) * 2.0 - 1.0


def _osc(b0, b1, c2, n):
    """One recurrence oscillator: an impulse through the section (b0, b1, 0; 1, -2c, 1), so y[j] = cos(w j)
    for (1, -c) and sin(w j) for (0, s). sosfilt's order of operations is the C kernel's (clap/organ.c)."""
    x = np.zeros(n)
    x[0] = 1.0
    return sosfilt(np.array([[b0, b1, 0.0, 1.0, -c2, 1.0]]), x)


def voice(c, s, count, lev, r, n_hold, release, serial, seed=0):
    """One pipe from stored numbers: cos and sin of its step (c, s), `count` partials with levels `lev`, the
    attack's per-sample decay r, held n_hold samples then released over `release` samples. Every operation is
    an IEEE add, multiply or divide in a fixed order, which clap/organ.c repeats sample by sample."""
    n = n_hold + release
    cos_w = _osc(1.0, -c, c + c, n)
    sin_w = _osc(0.0, s, c + c, n)
    two_c = cos_w + cos_w
    tone = np.zeros(n)
    prev2, prev, s2 = np.zeros(n), sin_w, np.zeros(n)
    if count >= 1:
        tone += lev[0] * prev
    for kk in range(2, count + 1):                      # Chebyshev: sin(k t) = 2 cos t sin((k-1) t) - sin((k-2) t)
        cur = two_c * prev - prev2
        tone += lev[kk - 1] * cur
        if kk == 2:
            s2 = cur
        prev2, prev = prev, cur
    step = np.full(n, r)
    step[0] = 1.0
    d = np.multiply.accumulate(step)                    # r^j, one multiply per sample as in C
    grow, chiff = 1.0 - d, d * d
    chiff_amp = 1.5 * lev[1] if count >= 2 else 0.0     # the second partial speaks first
    y = grow * tone + (chiff_amp * chiff) * s2
    rel = np.ones(n)
    rel[n_hold:] = 1.0 - np.arange(release) / float(release)
    return (y + (noise(serial, n, seed) * chiff) * NOISE) * rel


def coeffs(f1, fs, partials=MAX_PARTIALS):
    """(cos w, sin w, partial count) for a pipe speaking f1 at fs; partials stay under 0.45 fs."""
    w = 2 * math.pi * f1 / fs
    count = int(sum(1 for kk in range(1, partials + 1) if kk * f1 < 0.45 * fs))
    return math.cos(w), math.sin(w), count


def attack_decay(fs, attack=0.06):
    return math.exp(-1.0 / (attack * fs))


def pipe(f, seconds, fs, rng, stopped=False, scale=0.035, attack=0.06, partials=24, pressure=None):
    """One flue pipe at frequency f (Hz), sounding for `seconds` including its 40 ms release; returns the
    signal and the tube's own pitch. rng picks the pipe's noise stream."""
    tube = pipe_for(f, stopped, scale)
    f1 = float(tube.modes(1).freqs[0])
    n = int(round(seconds * fs))
    release = int(round(RELEASE * fs))
    c, s, count = coeffs(f1, fs, partials)
    serial = int(rng.integers(1 << 32))
    y = voice(c, s, count, levels(stopped), attack_decay(fs, attack), max(n - release, 0), release, serial)[:n]
    if pressure is not None:
        p = np.asarray(pressure)[:n]
        y[:len(p)] *= p
    return y, f1


def wind_decay(fs, tau=0.12):
    return math.exp(-1.0 / (tau * fs))


def wind(counts, fs, k=0.04, tau=0.12, a=None):
    """Supply pressure (1 at rest) from the number of pipes speaking at each sample, through the reservoir's
    first-order response, run as one sosfilt section so the C kernel can repeat it bit for bit."""
    a = wind_decay(fs, tau) if a is None else a
    target = 1.0 / (1.0 + k * np.asarray(counts, float))
    return sosfilt(np.array([[1.0 - a, 0.0, 0.0, 1.0, -a, 0.0]]), target - 1.0) + 1.0


ORDER = list(STOPS)            # stops speak in this order on every key (the plugin's bit order)


def live_design(fs, attack=0.06, tau=0.12):
    """The numbers a pipe needs, derived here: coef(stop_index, key) -> (c, s, count), level tables, attack and
    wind decays. organ_table.read(fs) returns the same shape from the CLAP plugin's stored header."""
    def coef(si, key):
        r = STOPS[ORDER[si]]
        f1 = float(pipe_for(midi_hz(key) * 8.0 / r.footage, r.stopped, r.scale).modes(1).freqs[0])
        return coeffs(f1, fs)
    return {"coef": coef, "open": levels(False), "stopped": levels(True), "attack": attack_decay(fs, attack),
            "wind": wind_decay(fs, tau), "release": int(round(RELEASE * fs))}


def play(chords, stops, fs=48000, seconds=None, seed=0, k=0.04, design=None):
    """Play chords [(start_s, length_s, [midi, ...]), ...] on the named stops; returns (signal, pipes) where
    pipes lists (midi, stop, frequency) for every pipe that spoke.

    The model is causal, as the plugin is: a key's pipes speak from its start sample, count toward the wind
    while held, and fall to silence over 40 ms after its end sample. Pipes start in time order, then key order,
    then the stop order of ORDER; that order numbers their noise streams and orders the sum, so clap/organ.c
    gives the same bits (tests/test_clap_organ.py) while no more than its 256 pipes sound at once."""
    d = live_design(fs) if design is None else design
    names = [s for s in ORDER if s in stops]
    events = sorted(((int(round(s * fs)), int(round((s + dur) * fs)), list(keys)) for s, dur, keys in chords),
                    key=lambda e: e[0])
    rel = d["release"]
    end = max(e for _, e, _ in events) + rel
    n = max(int(round(seconds * fs)) if seconds else 0, end)
    counts = np.zeros(n + 1)
    for i0, i1, keys in events:
        counts[i0] += len(keys) * len(names)
        counts[i1] -= len(keys) * len(names)
    press = wind(np.cumsum(counts)[:n], fs, k, a=d["wind"])
    out, spoke, serial = np.zeros(n), [], 0
    for i0, i1, keys in events:
        for key in keys:
            for name in names:
                si, r = ORDER.index(name), STOPS[name]
                c, s, count = d["coef"](si, key)
                y = voice(c, s, count, d["stopped" if r.stopped else "open"], d["attack"], i1 - i0, rel, serial, seed)
                m = min(len(y), n - i0)
                out[i0:i0 + m] += r.level * (y[:m] * press[i0:i0 + m])
                spoke.append((key, name, math.atan2(s, c) * fs / (2 * math.pi)))
                serial += 1
    return out, spoke
