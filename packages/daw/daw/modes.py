# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A set of modes: frequencies, labels, a shape function and a loss factor.

shape(point) returns every mode's amplitude at a point in normalised coordinates (x in [0, 1] along a
string, bar or tube; (x, y) in [0, 1]^2 on a rectangle; (r, theta) with r in [0, 1] on a disc). Mode
shapes are not normalised to unit modal mass; the renderer scales the sum, so only relative weights matter.
"""
import math
from dataclasses import dataclass
from typing import Callable

import numpy as np


@dataclass(frozen=True)
class Modes:
    freqs: np.ndarray
    labels: list
    shape: Callable
    eta: float                 # loss factor; mode k decays at alpha_k = pi f_k eta (+ alpha0)
    alpha0: float = 0.0        # a frequency-independent decay (support, air), 1/s

    def decay(self):
        return math.pi * np.asarray(self.freqs) * self.eta + self.alpha0

    def t60(self):
        """Time for each mode to fall 60 dB: ln(1000) / alpha."""
        return math.log(1000.0) / self.decay()

    def ratios(self):
        f = np.asarray(self.freqs)
        return f / f[0]

    def below(self, fmax):
        keep = np.asarray(self.freqs) < fmax
        idx = np.flatnonzero(keep)
        return Modes(np.asarray(self.freqs)[idx], [self.labels[i] for i in idx],
                     lambda p, _s=self.shape, _i=idx: np.asarray(_s(p))[_i], self.eta, self.alpha0)


def tune(resonator, target_hz):
    """Scale the resonator's size so its lowest mode sits at target_hz: f scales as size^-p."""
    out = resonator
    for _ in range(8):   # a stiff string is not a pure power law in its length, so iterate to convergence
        f0 = float(out.modes().freqs[0])
        if abs(f0 / target_hz - 1) < 1e-12:
            break
        out = out.scaled((f0 / target_hz) ** (1.0 / resonator.size_exponent))
    return out


def midi_hz(note, a4=440.0):
    """Equal-tempered pitch of a MIDI note number (A4 = note 69)."""
    return a4 * 2.0 ** ((note - 69) / 12.0)
