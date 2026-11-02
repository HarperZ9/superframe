# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""P22 phosphor impulse response after Kuhn 2002 (IEEE S&P), eqs. 8-10, as a stdlib model.

Each colour is a sum of exponentials a_i exp(-2 pi f_i t), plus for green and blue a power law
A ((t + t0) / 1 s)^-n. Amplitudes are in W / (V s sr) for a 1 V video drive; Kuhn states the
absolute scale is good to about a factor of two, so use the shape, not the scale.
One monitor, one measurement, video-level drive (not fixed beam current).
"""
import math

from . import load

_COEF = load("p22_kuhn2002")["model"]


class Response:
    def __init__(self, colour):
        c = _COEF[colour]
        self.exps = [(t["a"], t["f_hz"]) for t in c["exp"]]
        p = c.get("power")
        self.power = (p["A"], p["t0_s"], p["n"]) if p else None

    def I(self, t):
        """Radiant intensity per volt at t >= 0 seconds."""
        s = sum(a * math.exp(-2 * math.pi * f * t) for a, f in self.exps)
        if self.power:
            A, t0, n = self.power
            s += A * (t + t0) ** -n
        return s

    def energy(self, t=math.inf):
        """Emitted energy (W s / (V s sr) units) between 0 and t."""
        e = 0.0
        for a, f in self.exps:
            k = 2 * math.pi * f
            e += a / k * (1 - (math.exp(-k * t) if t != math.inf else 0.0))
        if self.power:
            A, t0, n = self.power
            tail = 0.0 if t == math.inf else (t + t0) ** (1 - n)
            e += A / (n - 1) * (t0 ** (1 - n) - tail)
        return e

    def F(self, t):
        """Fraction of the total emitted energy released by time t (finite because n > 1)."""
        return self.energy(t) / self.energy()

    def t_to(self, level, of="peak"):
        """First t where I(t)/I(0) falls to level (of="peak") or F(t) reaches level (of="energy")."""
        g = (lambda t: self.I(t) / self.I(0.0) - level) if of == "peak" else (lambda t: level - self.F(t))
        lo, hi = 1e-12, 1e4
        for _ in range(200):
            mid = math.sqrt(lo * hi)
            if g(mid) > 0:
                lo = mid
            else:
                hi = mid
        return hi

    def power_only_t_to(self, level):
        """Time for the power-law term alone to fall to level of its own t = 0 value."""
        A, t0, n = self.power
        return t0 * (level ** (-1 / n) - 1)


def red():
    return Response("red")


def green():
    return Response("green")


def blue():
    return Response("blue")
