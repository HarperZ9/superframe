# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The vocal tract with its losses: lip radiation and yielding walls, as complex chain matrices.

Each section is a transmission line of area A and length l, followed by a shunt admittance for its wall:
Y = (perimeter x l) / Z_w, perimeter 2 sqrt(pi A), with the wall impedance per unit area
Z_w = R_w + j omega M_w. A nasal tract joins as a side branch at the velum: its input impedance (open at the
nostrils) shunts the oral tract there, and where that impedance falls to zero, at c / 2L_n for a uniform branch
of length L_n, the oral output has an antiresonance (Fant 1960). The wall values are those of Sondhi and Schroeter 1987, R_w = 16,000 kg m^-2 s^-1
and M_w = 15 kg m^-2 (from memory, moderate confidence). The lips radiate as a piston in a baffle; for small
ka the load is Z_r = (rho c / A)((ka)^2 / 2 + j 8 ka / (3 pi)), a = sqrt(A / pi) (Morse 1948), which adds
an end correction of 8 a / (3 pi), about 0.85 a, and the radiation loss. With the glottis a volume-velocity
source, U_lips / U_glottis = 1 / (C Z_r + D) for the chain [[A, B], [C, D]]. Formants are the peaks of
that transfer and bandwidths their -3 dB widths.
"""
import math

import numpy as np

WALL_R, WALL_M = 16000.0, 15.0


def branch_impedance(f, areas, lengths, c, rho=1.14):
    """Input impedance of a side branch (the nasal tract) open at its far end: B / D of its chain."""
    k = 2 * math.pi * f / c
    K = np.eye(2, dtype=complex)
    for A, l in zip(areas, lengths):
        z = rho * c / A
        K = K @ np.array([[math.cos(k * l), 1j * z * math.sin(k * l)], [1j * math.sin(k * l) / z, math.cos(k * l)]])
    return K[0, 1] / K[1, 1]


def transfer(freqs, areas, lengths, c, rho=1.14, lips=True, walls=False, nasal=None):
    """Complex U_lips / U_glottis at each frequency. nasal = (section index of the velum, branch areas, branch
    lengths) couples a nasal tract as a side branch after that section; the oral flow is returned."""
    out = np.empty(len(freqs), complex)
    for i, f in enumerate(freqs):
        w = 2 * math.pi * f
        k = w / c
        K = np.eye(2, dtype=complex)
        for j, (A, l) in enumerate(zip(areas, lengths)):
            if nasal is not None and j == nasal[0]:
                K = K @ np.array([[1, 0], [1 / branch_impedance(f, nasal[1], nasal[2], c, rho), 1]])
            z = rho * c / A
            K = K @ np.array([[math.cos(k * l), 1j * z * math.sin(k * l)], [1j * math.sin(k * l) / z, math.cos(k * l)]])
            if walls:
                y = 2 * math.sqrt(math.pi * A) * l / (WALL_R + 1j * w * WALL_M)
                K = K @ np.array([[1, 0], [y, 1]])
        a_lip = math.sqrt(areas[-1] / math.pi)
        zr = rho * c / areas[-1] * ((k * a_lip) ** 2 / 2 + 1j * 8 * k * a_lip / (3 * math.pi)) if lips else 0.0
        out[i] = 1.0 / (K[1, 0] * zr + K[1, 1])
    return out


def formants_and_bandwidths(areas, lengths, c, fmax=4000.0, step=2.0, **kw):
    """Peaks of |transfer| with their -3 dB bandwidths, from a fine grid with parabolic refinement."""
    f = np.arange(step, fmax, step)
    m = 20 * np.log10(np.abs(transfer(f, areas, lengths, c, **kw)))
    k = np.flatnonzero((m[1:-1] > m[:-2]) & (m[1:-1] > m[2:])) + 1
    res = []
    for i in k:
        a, b, cc = m[i - 1:i + 2]
        p = 0.5 * (a - cc) / (a - 2 * b + cc)
        lo = i
        while lo > 0 and m[lo] > b - 3:
            lo -= 1
        hi = i
        while hi < len(m) - 1 and m[hi] > b - 3:
            hi += 1
        res.append((f[i] + p * step, (hi - lo) * step))
    return res


def trim_lip_cap(areas):
    """Drop the last shells of an area function measured from a closed surface mesh while each is under half
    the median of the seven before it: they are slivers of the cap that closes the mesh at the lips, and left
    in they turn the open mouth into a near-closed end."""
    a = list(areas)
    while len(a) > 5 and a[-1] < 0.5 * float(np.median(a[-8:-1])):
        a.pop()
    return np.asarray(a, float)
