# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The vocal tract in time: a Kelly-Lochbaum waveguide that the vocal folds drive and that pushes back on them.

The tract is cut into N tube sections each c / fs long, so a wave crosses one section per sample (Kelly and
Lochbaum 1962); at 48 kHz a section is 7.3 mm, and the tract's length is rounded to whole sections. At each junction between areas A_i and A_{i+1} the
pressure waves scatter with k = (A_i - A_{i+1}) / (A_i + A_{i+1}). The lips reflect with -0.9 through a
two-point average (an open end that radiates its highs: from memory, moderate). The glottis injects the flow
from the folds and reflects as a near-closed end.
Coupling (source-tract interaction): the folds see the pressure just above the glottis, so the flow through the
narrowest gap is U = a_min sqrt(2 (Ps - P_in) / rho) and the Bernoulli force on the lower mass uses Ps - P_in.
A tract that resists the flow skews the glottal pulse: its peak comes later in the cycle than the peak of the
glottal area. The uncoupled source (P_in = 0) has the flow in phase with the area.
"""
import math

import numpy as np

from . import folds as G


def resample_area(areas, lengths, c, fs):
    """Section areas for sections of length c / fs, by sampling the area function along its length."""
    edges = np.concatenate([[0.0], np.cumsum(lengths)])
    n = max(2, int(round(edges[-1] / (c / fs))))
    centres = (np.arange(n) + 0.5) * edges[-1] / n
    idx = np.clip(np.searchsorted(edges, centres) - 1, 0, len(areas) - 1)
    return np.asarray(areas, float)[idx]


class Tract:
    """Forward and backward pressure waves in each section; step() advances one sample."""

    def __init__(self, areas, rho=1.14, c=352.0, glottal_reflection=0.97, lip_reflection=-0.9):
        a = np.asarray(areas, float)
        self.k = (a[:-1] - a[1:]) / (a[:-1] + a[1:])
        self.f = np.zeros(len(a))
        self.b = np.zeros(len(a))
        self.z0 = rho * c / a[0]
        self.rg, self.rl, self.lip_prev = glottal_reflection, lip_reflection, 0.0

    def step(self, u_glottis):
        """Inject the glottal flow, scatter, reflect; returns (pressure at the glottis end, lip output)."""
        f, b, k = self.f, self.b, self.k
        out_f = f[-1]
        nf = np.empty_like(f)
        nb = np.empty_like(b)
        nf[0] = self.rg * b[0] + self.z0 * u_glottis
        nf[1:] = (1 + k) * f[:-1] - k * b[1:]
        nb[:-1] = k * f[:-1] + (1 - k) * b[1:]
        lip = 0.5 * (out_f + self.lip_prev)
        self.lip_prev = out_f
        nb[-1] = self.rl * lip
        self.f, self.b = nf, nb
        return nf[0] + b[0], out_f - nb[-1]


def coupled(ps, seconds, fs, areas, lengths, q=1.0, a0=None, rho=1.14, c=352.0, coupled=True, sub=2):
    """Two-mass folds driving the tract; returns (glottal area, glottal flow, lip output) at fs."""
    p, dt = G.params(q, a0), 1.0 / (fs * sub)
    tract = Tract(resample_area(areas, lengths, c, fs), rho, c)
    s = np.array([1e-5, 0.0, 0.0, 0.0])
    n = int(seconds * fs)
    area, flow, out = np.zeros(n), np.zeros(n), np.zeros(n)
    p_in = 0.0
    for i in range(n):
        drive = max(ps - (p_in if coupled else 0.0), 0.0)
        for _ in range(sub):
            k1, _ = G._derivs(s, p, drive, rho)
            k2, _ = G._derivs(s + 0.5 * dt * k1, p, drive, rho)
            k3, _ = G._derivs(s + 0.5 * dt * k2, p, drive, rho)
            k4, _ = G._derivs(s + dt * k3, p, drive, rho)
            s = s + dt / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
        amin = G._derivs(s, p, drive, rho)[1]
        u = amin * math.sqrt(2 * drive / rho)
        p_in, lip = tract.step(u)
        area[i], flow[i], out[i] = amin, u, lip
    return area, flow, out


def flow_skew(area, flow, fs, f0):
    """Average delay of the flow peak after the area peak within each cycle, as a fraction of the period."""
    period = int(round(fs / f0))
    lags = []
    for s in range(len(area) // 2, len(area) - period, period):
        a, u = area[s:s + period], flow[s:s + period]
        lags.append(((np.argmax(u) - np.argmax(a)) % period) / period)
    return float(np.median(lags))
