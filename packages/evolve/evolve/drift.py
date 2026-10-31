# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Static and dynamic environments as XOR masks over time.

static    the mask stays 0.
random    every `period` generations `d` sites chosen at random flip: a random walk of the optimum,
          not predictable from its past.
seasonal  the mask alternates between 0 and a fixed mask M (|M| = d) every `period` generations:
          the optimum moves, but the move repeats on a known calendar, so it can be forecast.
"""
import numpy as np


class Drift:
    def __init__(self, L, kind="static", period=10, d=1, rng=None):
        self.L, self.kind, self.period, self.d = L, kind, int(period), int(d)
        self.rng = rng if rng is not None else np.random.default_rng(0)
        self.mask = np.zeros(L, np.int8)
        self.M = np.zeros(L, np.int8)
        if kind == "seasonal":
            self.M[self.rng.choice(L, size=d, replace=False)] = 1

    def phase(self, t):
        return (t // self.period) % 2 if self.kind == "seasonal" else 0

    def step(self, t):
        """Mask in force at generation t (call once per generation, in order)."""
        if self.kind == "random" and t > 0 and t % self.period == 0:
            self.mask[self.rng.choice(self.L, size=self.d, replace=False)] ^= 1
        elif self.kind == "seasonal":
            self.mask = self.M.copy() if self.phase(t) else np.zeros(self.L, np.int8)
        return None if self.kind == "static" else self.mask
