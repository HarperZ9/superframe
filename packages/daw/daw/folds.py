# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two-mass vocal folds: a self-oscillating source whose pitch and voice quality come from fold physics.

Each fold is two masses on springs, coupled to each other (Ishizaka and Flanagan 1972), in the symmetric
form of Steinecke and Herzel 1995: the lower mass feels the Bernoulli pressure of the glottal flow,
P1 = Ps (1 - (a_min / a1)^2) while the glottis is open, and nothing when it is shut; the upper mass feels
none. Colliding folds meet an extra spring three times their own and heavier damping. Parameter values are
the Steinecke and Herzel set in SI units (from memory, moderate confidence): m1 = 0.125 g, m2 = 0.025 g,
k1 = 80 N/m, k2 = 8 N/m, kc = 25 N/m, fold length 14 mm, thickness 2.5 and 0.5 mm, rest areas 5 mm^2.
Controls with a voice-quality meaning: subglottal pressure Ps (loudness, threshold), the tension factor Q
(masses / Q, stiffnesses x Q: pitch), and the rest area a0 (adduction: small is pressed, large is breathy).
Flow U = a_min sqrt(2 Ps / rho_air) is the source fed to the tract (rho_air at 37 C supplied by the caller).
"""
import math

import numpy as np

BASE = dict(m1=0.125e-3, m2=0.025e-3, k1=80.0, k2=8.0, kc=25.0, l=0.014, d1=0.0025, a0=5e-6)


def _derivs(s, p, ps, rho):
    x1, v1, x2, v2 = s
    a1 = p["a0"] + 2 * p["l"] * x1
    a2 = p["a0"] + 2 * p["l"] * x2
    amin = min(a1, a2)
    force = ps * p["l"] * p["d1"] * (1 - (amin / a1) ** 2) if (a1 > 0 and a2 > 0) else 0.0
    f1 = -p["k1"] * x1 - p["kc"] * (x1 - x2) + force
    f2 = -p["k2"] * x2 - p["kc"] * (x2 - x1)
    z1 = 0.1 if a1 > 0 else 1.1
    z2 = 0.1 if a2 > 0 else 1.1
    if a1 <= 0:
        f1 -= 3 * p["k1"] * a1 / (2 * p["l"])
    if a2 <= 0:
        f2 -= 3 * p["k2"] * a2 / (2 * p["l"])
    f1 -= 2 * z1 * math.sqrt(p["m1"] * p["k1"]) * v1
    f2 -= 2 * z2 * math.sqrt(p["m2"] * p["k2"]) * v2
    return np.array([v1, f1 / p["m1"], v2, f2 / p["m2"]]), max(amin, 0.0)


def params(q=1.0, a0=None):
    p = dict(BASE)
    p.update(m1=BASE["m1"] / q, m2=BASE["m2"] / q, k1=BASE["k1"] * q, k2=BASE["k2"] * q, kc=BASE["kc"] * q)
    if a0 is not None:
        p["a0"] = a0
    return p


def simulate(ps, seconds, fs, q=1.0, a0=None, rho=1.14, sub=8):
    """Glottal area (m^2) and flow (m^3/s) at fs, integrated by RK4 at sub x fs."""
    p, dt = params(q, a0), 1.0 / (fs * sub)
    s = np.array([1e-5, 0.0, 0.0, 0.0])
    n = int(seconds * fs)
    area = np.zeros(n)
    for i in range(n):
        for _ in range(sub):
            k1, _ = _derivs(s, p, ps, rho)
            k2, _ = _derivs(s + 0.5 * dt * k1, p, ps, rho)
            k3, _ = _derivs(s + 0.5 * dt * k2, p, ps, rho)
            k4, _ = _derivs(s + dt * k3, p, ps, rho)
            s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        area[i] = _derivs(s, p, ps, rho)[1]
    return area, area * math.sqrt(2 * ps / rho)


def linear_frequencies(q=1.0):
    """Eigenfrequencies (Hz) of the two-mass system with the flow switched off."""
    p = params(q)
    K = np.array([[p["k1"] + p["kc"], -p["kc"]], [-p["kc"], p["k2"] + p["kc"]]])
    Mi = np.diag([1 / p["m1"], 1 / p["m2"]])
    return np.sort(np.sqrt(np.linalg.eigvals(Mi @ K).real)) / (2 * math.pi)


def pitch_and_open_quotient(area, fs):
    a = area[len(area) // 2:]
    if a.max() <= 1e-9 or np.std(a) < 1e-8:
        return 0.0, 1.0 if a.max() > 0 else 0.0
    x = a - a.mean()
    up = np.flatnonzero((x[:-1] < 0) & (x[1:] >= 0))
    f0 = fs / np.mean(np.diff(up)) if len(up) > 2 else 0.0
    return f0, float((a > 0.02 * a.max()).mean())
