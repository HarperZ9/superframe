# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The room and the medium: a shoebox of damped normal modes from packages/instruments/room/modes.py.

That model fixes the sound speed at 343 m/s. A room in another medium (water, say) has the same modes as a
room scaled by 343 / c, because every mode frequency is c times a function of 1 / size; so the dimensions and
positions are scaled before the call and nothing is copied. The stereo pair is two microphones a short
spacing apart. Above fmax the modes overlap (the Schroeder frequency 2000 sqrt(T60 / V) Hz, Schroeder 1962, is
about 200 Hz for this room), so the field there is diffuse and is modelled as seeded noise decaying at the same
T60, its level matched to the modal part across fmax. Modes are kept only where they are distinct.
"""
from dataclasses import dataclass

import numpy as np

from . import PKG  # noqa: F401  (sets sys.path for instruments/room)
import modes as room_modes  # packages/instruments/room/modes.py

MODEL_SPEED = room_modes.C


@dataclass(frozen=True)
class Room:
    dims: tuple = (6.0, 4.5, 3.0)      # m
    t60: float = 0.9                   # s
    source: tuple = (1.6, 1.2, 1.2)
    mic: tuple = (4.6, 3.1, 1.5)
    spacing: float = 0.3               # m between the two microphones, along y
    sound_speed: float = MODEL_SPEED   # m/s of the medium filling the room
    fmax: float = 400.0

    def impulse_responses(self, fs, rng, seconds=None):
        """Left and right impulse responses, normalised so the louder has peak 1."""
        k = MODEL_SPEED / self.sound_speed
        dims = tuple(d * k for d in self.dims)
        src = tuple(p * k for p in self.source)
        out, seed = [], int(rng.integers(2 ** 32))   # one draw: both microphones hear the same mode decays
        for dy in (-self.spacing / 2, self.spacing / 2):
            mic = (self.mic[0] * k, (self.mic[1] + dy) * k, self.mic[2] * k)
            sub = np.random.default_rng(seed)
            h, _ = room_modes.impulse_response(dims, src, mic, self.t60, fs, self.fmax, sub, seconds=seconds)
            out.append(self._diffuse(h, fs, sub))
        peak = max(np.abs(out[0]).max(), np.abs(out[1]).max())
        return out[0] / peak, out[1] / peak

    def _diffuse(self, h, fs, rng):
        """Add the diffuse field above fmax: noise with the room's decay, level matched at fmax."""
        t = np.arange(len(h)) / fs
        tail = rng.standard_normal(len(h)) * np.exp(-6.91 * t / self.t60)
        fr = np.fft.rfftfreq(len(h), 1.0 / fs)
        H, N = np.fft.rfft(h), np.fft.rfft(tail)
        N[fr < self.fmax] = 0.0
        below = np.mean(np.abs(H[(fr > 0.7 * self.fmax) & (fr < self.fmax)]))
        above = np.mean(np.abs(N[(fr >= self.fmax) & (fr < 1.3 * self.fmax)]))
        return h + np.fft.irfft(N * (below / above), len(h))

    def mode_frequencies(self):
        """Mode frequencies of this room in its medium, below fmax."""
        k = MODEL_SPEED / self.sound_speed
        f, _ = room_modes.eigenfrequencies(tuple(d * k for d in self.dims), self.fmax)  # same f, scaled room
        return f
