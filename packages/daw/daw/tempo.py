# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Tempo map and metre (gap G4): tempo changes, ramps (accelerando, ritardando), bars of any metre, free time.

A map is a list of points (beat, bpm, ramp). From each point the tempo holds (ramp False) or moves linearly in
beats to the next point's tempo (ramp True). Time is the integral of 60 / bpm over beats, in closed form:

    held:  t = 60 u / T0
    ramp:  t = 60 / s ln((T0 + s u) / T0),  s = (T1 - T0) / (b1 - b0)

for u beats into the segment. A sample is round(t fs), so every beat lands on one exact sample, and a map with
one point places notes on the same samples as `Arrangement` at that tempo.

Metre is a list of (bar, numerator, denominator) changes; a beat is a quarter note, so a 6/8 bar holds three
beats and a 3/4 bar three. `bar_beat(bar)` gives the beat a bar line falls on.

`retime(notes, tmap, bpm)` rewrites notes so an `Arrangement` at constant `bpm` plays them on the map's samples
(within the float rounding of beat x 60 / bpm, checked in the tests). `free(seconds)` places a note in seconds.
"""
import math
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Point:
    beat: float
    bpm: float
    ramp: bool = False         # True: tempo moves linearly to the next point's bpm


class TempoMap:
    def __init__(self, points, metre=((1, 4, 4),)):
        self.points = sorted(points, key=lambda p: p.beat)
        if not self.points or self.points[0].beat != 0:
            raise ValueError("a tempo map starts at beat 0")
        self.metre = sorted(metre)
        self._starts = [0.0]
        for i in range(len(self.points) - 1):
            self._starts.append(self._starts[-1] + self._span(i, self.points[i + 1].beat - self.points[i].beat))

    def _span(self, i, u):
        p = self.points[i]
        if p.ramp and i + 1 < len(self.points):
            q = self.points[i + 1]
            s = (q.bpm - p.bpm) / (q.beat - p.beat)
            if s != 0:
                return 60.0 / s * math.log((p.bpm + s * u) / p.bpm)
        return 60.0 * u / p.bpm

    def seconds(self, beat):
        i = max(j for j, p in enumerate(self.points) if p.beat <= beat)
        return self._starts[i] + self._span(i, beat - self.points[i].beat)

    def sample(self, beat, fs):
        i = max(j for j, p in enumerate(self.points) if p.beat <= beat)
        p = self.points[i]
        if not (p.ramp and i + 1 < len(self.points)):   # held: the Arrangement's own expression, exactly
            return int(round(self._starts[i] * fs + (beat - p.beat) * 60.0 * fs / p.bpm))
        return int(round(self.seconds(beat) * fs))

    def bpm(self, beat):
        i = max(j for j, p in enumerate(self.points) if p.beat <= beat)
        p = self.points[i]
        if p.ramp and i + 1 < len(self.points):
            q = self.points[i + 1]
            return p.bpm + (q.bpm - p.bpm) * (beat - p.beat) / (q.beat - p.beat)
        return p.bpm

    def bar_beat(self, bar):
        """Beat at the start of `bar` (bars count from 1)."""
        beat, at = 0.0, 1
        changes = list(self.metre)
        for j, (b, num, den) in enumerate(changes):
            stop = changes[j + 1][0] if j + 1 < len(changes) else bar
            stop = min(stop, bar)
            if stop > at:
                beat += (stop - at) * num * 4.0 / den
                at = stop
        return beat


def free(seconds, bpm):
    """A time in seconds as a beat at constant bpm (free-time notes in an Arrangement)."""
    return seconds * bpm / 60.0


def retime(notes, tmap, bpm):
    """Notes in map beats rewritten as beats at constant bpm: start and end land on the map's times."""
    out = []
    for n in notes:
        t0, t1 = tmap.seconds(n.beat), tmap.seconds(n.beat + n.beats)
        out.append(replace(n, beat=free(t0, bpm), beats=free(t1, bpm) - free(t0, bpm)))
    return out
