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
fundamental grows in over the attack (the "chiff"), with a short burst of jet noise; release falls in 40 ms.

Wind. All pipes share one supply. A pipe's level follows the supply pressure, which falls when more pipes
speak, p = p0 / (1 + k n), and settles with the reservoir's time constant. Pitch is held constant under sag
(a real flue pipe's pitch rises slightly with pressure; not modelled).
"""
import math
from dataclasses import dataclass

import numpy as np
from scipy.signal import lfilter

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


def pipe(f, seconds, fs, rng, stopped=False, scale=0.035, attack=0.06, partials=24, pressure=None):
    """One flue pipe at frequency f (Hz), held for `seconds`; returns the signal and the tube's own pitch."""
    tube = pipe_for(f, stopped, scale)
    f1 = float(tube.modes(1).freqs[0])
    n = int(round(seconds * fs))
    t = np.arange(n) / fs
    k = np.arange(1, partials + 1)
    keep = k * f1 < 0.45 * fs
    k = k[keep]
    lev = k ** -1.2
    if stopped:
        lev = np.where(k % 2 == 1, k ** -1.5, 10 ** (-30 / 20) * k ** -1.5)
    grow = 1 - np.exp(-t / attack)
    chiff = np.exp(-t / (0.5 * attack))
    rel = np.clip((seconds - t) / 0.04, 0.0, 1.0)
    y = np.zeros(n)
    for kk, a in zip(k, lev):
        env = grow if kk == 1 else (grow + (1.5 * chiff if kk == 2 else 0.0))
        y += a * env * np.sin(2 * math.pi * kk * f1 * t)
    noise = rng.standard_normal(n) * chiff * 0.02
    y = (y + noise) * rel
    if pressure is not None:
        p = np.asarray(pressure)[:n]
        y[:len(p)] *= p
    return y, f1


def wind(counts, fs, k=0.04, tau=0.12):
    """Supply pressure (1 at rest) from the number of pipes speaking at each sample, through the reservoir's
    first-order response."""
    target = 1.0 / (1.0 + k * np.asarray(counts, float))
    a = math.exp(-1.0 / (tau * fs))
    return lfilter([1 - a], [1, -a], target - 1.0) + 1.0


def play(chords, stops, fs=48000, seconds=None, seed=0, k=0.04):
    """Play chords [(start_s, length_s, [midi, ...]), ...] on the named stops; returns (signal, pipes) where
    pipes lists (midi, stop, frequency) for every pipe that spoke."""
    rng = np.random.default_rng(seed)
    end = max(s + d for s, d, _ in chords) + 0.1
    n = int(round((seconds or end) * fs))
    counts = np.zeros(n)
    for s, d, keys in chords:
        counts[int(s * fs):int((s + d) * fs)] += len(keys) * len(stops)
    press = wind(counts, fs, k)
    out, spoke = np.zeros(n), []
    for s, d, keys in chords:
        i0 = int(round(s * fs))
        for key in keys:
            for name in stops:
                r = STOPS[name]
                f = midi_hz(key) * 8.0 / r.footage
                y, f1 = pipe(f, d, fs, rng, r.stopped, r.scale, pressure=press[i0:])
                m = min(len(y), n - i0)
                out[i0:i0 + m] += r.level * y[:m]
                spoke.append((key, name, f1))
    return out, spoke
