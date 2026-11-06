# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two-dimensional resonators in closed form: membranes and Kirchhoff plates.

Circular membrane (radius a, wave speed c = sqrt(T / sigma)): f_mn = j_mn c / (2 pi a), j_mn the n-th zero
of J_m. Rectangular membrane: f = (c / 2) sqrt((m / a)^2 + (n / b)^2).
Simply supported rectangular plate (Navier): omega = pi^2 ((m / a)^2 + (n / b)^2) sqrt(D / (rho h)) with
D = E h^3 / (12 (1 - nu^2)) (Leissa 1969, ch. 4). Clamped circular plate: omega = lambda^2 / a^2 sqrt(D / (rho h)),
lambda the roots of J_n(l) I_{n+1}(l) + I_n(l) J_{n+1}(l) = 0 (Leissa eq. 2.5, rewritten with the recurrences).
"""
import math
from dataclasses import dataclass, replace

import numpy as np
from scipy.optimize import brentq
from scipy.special import ive, jn_zeros, jv

from .modes import Modes


def flexural_rigidity(m, h):
    if m.nu is None:
        raise ValueError(f"{m.name}: no Poisson ratio in the table; plates need one")
    return m.E * h ** 3 / (12 * (1 - m.nu ** 2))


def _sorted(f, labels):
    o = np.argsort(f, kind="stable")
    return np.asarray(f)[o], [labels[i] for i in o], o


@dataclass(frozen=True)
class CircularMembrane:
    radius: float
    tension: float         # N/m
    areal_density: float   # kg/m^2 (material rho times thickness)
    size_exponent = 1.0
    eta: float = 3e-3      # air loading dominates a membrane's loss; from memory, low

    def scaled(self, s):
        return replace(self, radius=self.radius * s)

    def modes(self, m_max=8, n_max=4):
        c = math.sqrt(self.tension / self.areal_density)
        f, lab, mm, zz = [], [], [], []
        for m in range(m_max + 1):
            for n, j in enumerate(jn_zeros(m, n_max), 1):
                f.append(j * c / (2 * math.pi * self.radius)); lab.append(f"({m},{n})"); mm.append(m); zz.append(j)
        f, lab, o = _sorted(f, lab)
        mm, zz = np.asarray(mm)[o], np.asarray(zz)[o]
        shape = lambda p: jv(mm, zz * p[0]) * np.cos(mm * p[1])
        return Modes(f, lab, shape, self.eta)


@dataclass(frozen=True)
class RectPlate:
    """Simply supported rectangular plate; with plate=False it is a rectangular membrane under tension."""
    material: object
    a: float
    b: float
    h: float
    plate: bool = True
    tension: float = 0.0   # N/m, membrane only
    size_exponent = 2.0

    def scaled(self, s):
        return replace(self, a=self.a * s, b=self.b * s)

    def modes(self, m_max=8, n_max=8):
        m, n = np.meshgrid(np.arange(1, m_max + 1), np.arange(1, n_max + 1), indexing="ij")
        m, n = m.ravel(), n.ravel()
        k2 = (m / self.a) ** 2 + (n / self.b) ** 2
        if self.plate:
            w = math.pi ** 2 * k2 * math.sqrt(flexural_rigidity(self.material, self.h) / (self.material.rho * self.h))
            f = w / (2 * math.pi)
        else:
            f = 0.5 * math.sqrt(self.tension / (self.material.rho * self.h)) * np.sqrt(k2)
        f, lab, o = _sorted(f, [f"({i},{j})" for i, j in zip(m, n)])
        mo, no = m[o], n[o]
        shape = lambda p: np.sin(mo * math.pi * p[0]) * np.sin(no * math.pi * p[1])
        return Modes(f, lab, shape, self.material.eta)


def clamped_circular_lambdas(n, count, lmax=60.0):
    """Roots lambda of J_n I_{n+1} + I_n J_{n+1} = 0; I is divided out with exponential scaling for stability."""
    g = lambda x: jv(n, x) * ive(n + 1, x) / ive(n, x) + jv(n + 1, x)
    xs = np.linspace(0.5, lmax, 4000)
    v = g(xs)
    roots = [brentq(g, xs[i], xs[i + 1]) for i in range(len(xs) - 1) if v[i] * v[i + 1] < 0]
    return np.array(roots[:count])


@dataclass(frozen=True)
class CircularPlate:
    """Clamped circular plate."""
    material: object
    radius: float
    h: float
    size_exponent = 2.0

    def scaled(self, s):
        return replace(self, radius=self.radius * s)

    def modes(self, n_max=6, s_max=3):
        lam, lab, nn = [], [], []
        for n in range(n_max + 1):
            for s, l in enumerate(clamped_circular_lambdas(n, s_max)):
                lam.append(l); lab.append(f"s{s}n{n}"); nn.append(n)
        lam, nn = np.asarray(lam), np.asarray(nn)
        w = lam ** 2 / self.radius ** 2 * math.sqrt(flexural_rigidity(self.material, self.h) / (self.material.rho * self.h))
        f, lab, o = _sorted(w / (2 * math.pi), lab)
        lo, no = lam[o], nn[o]

        def shape(p):
            r, th = p
            ratio = ive(no, lo * r) / ive(no, lo) * np.exp(lo * r - lo)
            return (jv(no, lo * r) - jv(no, lo) * ratio) * np.cos(no * th)
        return Modes(f, lab, shape, self.material.eta)
