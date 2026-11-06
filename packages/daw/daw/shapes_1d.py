# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""One-dimensional resonators in closed form: the string, the Euler-Bernoulli bar and the air column.

String (stiff): f_n = n f1 sqrt(1 + B n^2), f1 = sqrt(T / mu) / 2L, B = pi^3 E d^4 / (64 T L^2) (Fletcher 1964).
Bar: f_n = (beta_n L)^2 / (2 pi L^2) sqrt(E I / (rho A)); a rectangular section has I / A = h^2 / 12. Free ends
give cos(x) cosh(x) = 1, pinned ends beta_n L = n pi (Rayleigh, Theory of Sound, ch. 8).
Air column: open-open f_n = n c / 2L', closed-open f_n = (2n - 1) c / 4L', with L' = L + 0.6133 a per open
unflanged end when end_correction is on (Levine and Schwinger 1948; coefficient from memory, high confidence).
"""
import math
from dataclasses import dataclass, replace

import numpy as np
from scipy.optimize import brentq

from .modes import Modes

LEVINE_SCHWINGER = 0.6133  # end correction over radius, unflanged open pipe (from memory, high)


@dataclass(frozen=True)
class String:
    material: object
    length: float          # m
    diameter: float        # m
    tension: float         # N
    stiff: bool = True
    size_exponent = 1.0    # f proportional to length^-1

    @property
    def mu(self):
        return self.material.rho * math.pi * self.diameter ** 2 / 4

    @property
    def inharmonicity(self):
        if not self.stiff:
            return 0.0
        return math.pi ** 3 * self.material.E * self.diameter ** 4 / (64 * self.tension * self.length ** 2)

    def scaled(self, s):
        return replace(self, length=self.length * s)

    def modes(self, n=40):
        k = np.arange(1, n + 1, dtype=float)
        f1 = math.sqrt(self.tension / self.mu) / (2 * self.length)
        f = k * f1 * np.sqrt(1 + self.inharmonicity * k ** 2)
        return Modes(f, [f"n{int(i)}" for i in k], lambda x: np.sin(k * math.pi * x[0]), self.material.eta)


def free_free_roots(n):
    """First n positive roots of cos(x) cosh(x) = 1, as cos(x) - 1 / cosh(x) = 0 to avoid overflow."""
    g = lambda x: math.cos(x) - 1.0 / math.cosh(x)
    return np.array([brentq(g, (k + 0.5) * math.pi - 1, (k + 0.5) * math.pi + 1) for k in range(1, n + 1)])


def clamped_free_roots(n):
    """First n roots of cos(x) cosh(x) = -1 (the cantilever)."""
    g = lambda x: math.cos(x) + 1.0 / math.cosh(x)
    return np.array([brentq(g, (k - 0.5) * math.pi - 1, (k - 0.5) * math.pi + 1) for k in range(1, n + 1)])


def free_free_shape(bl, x):
    """Free-free bar mode at x in [0, 1] for root bl, written with decaying exponentials so it does not overflow."""
    em = math.exp(-bl)
    s_scaled = 1 - em * em - 2 * math.sin(bl) * em          # 2 exp(-bl) (sinh bl - sin bl)
    one_minus_sigma_e = (math.cos(bl) - math.sin(bl) - em) * 2 / s_scaled   # (1 - sigma) exp(bl)
    sigma = 1 - one_minus_sigma_e * em
    y = bl * x
    hyper = 0.5 * (one_minus_sigma_e * np.exp(y - bl) + (1 + sigma) * np.exp(-y))
    return np.cos(y) - sigma * np.sin(y) + hyper


@dataclass(frozen=True)
class Bar:
    material: object
    length: float          # m
    thickness: float       # m, in the bending direction
    ends: str = "free"     # "free", "pinned" or "clamped-free"
    size_exponent = 2.0    # f proportional to length^-2 at fixed thickness

    def scaled(self, s):
        return replace(self, length=self.length * s)

    def roots(self, n):
        if self.ends == "free":
            return free_free_roots(n)
        if self.ends == "clamped-free":
            return clamped_free_roots(n)
        if self.ends == "pinned":
            return math.pi * np.arange(1, n + 1, dtype=float)
        raise ValueError(self.ends)

    def modes(self, n=12):
        bl = self.roots(n)
        k = math.sqrt(self.material.E * self.thickness ** 2 / (12 * self.material.rho))
        f = bl ** 2 / (2 * math.pi * self.length ** 2) * k
        if self.ends == "free":
            shape = lambda x: np.array([free_free_shape(b, x[0]) for b in bl])
        else:  # pinned shape; the cantilever reuses it as an approximation for excitation weights
            shape = lambda x: np.sin(np.arange(1, n + 1) * math.pi * x[0])
        return Modes(f, [f"b{i + 1}" for i in range(n)], shape, self.material.eta)


@dataclass(frozen=True)
class Tube:
    length: float          # m
    radius: float          # m
    ends: str = "open-open"   # or "closed-open"
    sound_speed: float = 0.0  # m/s; pass materials.air_speed() or another medium
    end_correction: bool = True
    q: float = 40.0        # resonance quality factor, from memory (low): wall and radiation loss vary widely
    size_exponent = 1.0

    def scaled(self, s):
        return replace(self, length=self.length * s, radius=self.radius * s)

    def effective_length(self):
        n_open = 2 if self.ends == "open-open" else 1
        return self.length + (n_open * LEVINE_SCHWINGER * self.radius if self.end_correction else 0.0)

    def modes(self, n=16):
        if self.sound_speed <= 0:
            raise ValueError("Tube needs the medium's sound speed")
        le, k = self.effective_length(), np.arange(1, n + 1, dtype=float)
        if self.ends == "open-open":
            f = k * self.sound_speed / (2 * le)
            shape = lambda x: np.sin(k * math.pi * x[0])
        elif self.ends == "closed-open":
            f = (2 * k - 1) * self.sound_speed / (4 * le)
            shape = lambda x: np.cos((2 * k - 1) * math.pi * x[0] / 2)
        else:
            raise ValueError(self.ends)
        return Modes(f, [f"p{int(i)}" for i in k], shape, 1.0 / self.q)
