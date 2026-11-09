# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The timeline: instruments, notes in beats, tracks with automation, and an arrangement at one tempo.

Time is kept in beats and placed on the sample grid as round(beat * 60 * fs / bpm), so a note lands on
one exact sample, and the same arrangement always lands on the same samples. Automation is a piecewise
linear envelope in seconds, evaluated once per sample.
"""
from dataclasses import dataclass, field

import numpy as np

from . import synth
from .modes import midi_hz, tune


@dataclass(frozen=True)
class Note:
    beat: float
    beats: float = 1.0
    pitch: float = 60          # MIDI note number; fractional values are microtones
    velocity: float = 0.8      # 0 to 1


@dataclass(frozen=True)
class Instrument:
    """A resonator (any shape object with modes(), scaled() and size_exponent) and how it is played."""
    name: str
    resonator: object
    kind: str = "strike"       # strike, pluck or breath
    x_in: tuple = (0.23,)
    x_out: tuple = (0.71,)
    tau: float = 1e-3          # mallet contact time, s
    tail: float = 2.0          # seconds rendered after the note's length
    tuned: bool = True         # scale the object so its lowest mode sits on the note's pitch

    def play(self, note, fs, seconds_per_beat, rng):
        res = tune(self.resonator, midi_hz(note.pitch)) if self.tuned else self.resonator
        hold = note.beats * seconds_per_beat
        return synth.render(res.modes(), fs, hold + self.tail, self.x_in, self.x_out, self.kind, self.tau,
                            rng=rng, velocity=note.velocity, hold=hold)


@dataclass
class Envelope:
    points: list               # [(seconds, value), ...], sorted by time

    def sample(self, n, fs):
        t = np.arange(n) / fs
        p = np.asarray(self.points, float)
        return np.interp(t, p[:, 0], p[:, 1])


@dataclass
class Track:
    name: str
    instrument: Instrument
    notes: list
    gain_db: float = 0.0
    pan: float = 0.0           # -1 left to +1 right
    send: float = 0.3          # share sent to the room
    automation: dict = field(default_factory=dict)   # "gain_db" or "pan" -> Envelope
    inserts: list = field(default_factory=list)      # callables f(mono, fs) -> mono, run in order on the track
    width: float = 0.0         # 0 mono-placed; up to 1: a decorrelated side signal widens the track (stems.widen)
    sends: dict = field(default_factory=dict)        # space name -> send level, for Arrangement.spaces

    def control(self, key, n, fs):
        if key in self.automation:
            return self.automation[key].sample(n, fs)
        return np.full(n, getattr(self, key))


@dataclass
class Arrangement:
    tracks: list
    bpm: float = 96.0
    fs: int = 48000
    seconds: float = 20.0
    room: object = None
    room_return_db: float = -6.0
    ceiling: float = 0.98      # master limiter ceiling, linear
    spaces: dict = field(default_factory=dict)       # name -> Room or Space: extra reverb buses fed by Track.sends

    @property
    def seconds_per_beat(self):
        return 60.0 / self.bpm

    def sample_of(self, beat):
        return int(round(beat * 60.0 * self.fs / self.bpm))

    def n(self):
        return int(round(self.seconds * self.fs))


def render_track(arr, track, rng):
    """One track as a mono buffer: every note rendered and added at its exact sample."""
    n = arr.n()
    buf = np.zeros(n)
    for note in track.notes:
        start = arr.sample_of(note.beat)
        if start >= n:
            continue
        y = track.instrument.play(note, arr.fs, arr.seconds_per_beat, rng)
        end = min(n, start + len(y))
        buf[start:end] += y[:end - start]
    for fx in track.inserts:
        buf = np.asarray(fx(buf, arr.fs), float)[:n]
    return buf
