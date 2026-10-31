# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Sampling on the sphere: lat-long grids, icosahedral geodesic grids, spherical-harmonic fields.

Fields are real spherical-harmonic sums with angular power C_l per degree; every m in a degree
gets the same expected power, so the field is statistically isotropic. A 'zonal' field puts the
power on m = 0 only (aligned with the lat-long axis). Rebuild: least squares on the samples for
coefficients up to a fit degree; error is measured exactly in coefficient space (Parseval).
"""
import math

import numpy as np
from scipy.special import sph_harm_y


def latlong(n_theta):
    """Cell-centred equiangular grid, n_theta rings by 2 n_theta meridians."""
    th = (np.arange(n_theta) + 0.5) * math.pi / n_theta
    ph = (np.arange(2 * n_theta) + 0.5) * math.pi / n_theta
    T, P = np.meshgrid(th, ph, indexing="ij")
    return np.stack([T.ravel(), P.ravel()], 1)


def _ico():
    t = (1 + 5 ** 0.5) / 2
    v = np.array([[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
                  [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]], float)
    f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6),
         (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10),
         (8, 6, 7), (9, 8, 1)]
    return v / np.linalg.norm(v, axis=1, keepdims=True), f


def geodesic(freq):
    """Class I icosahedral geodesic vertices, 10 freq^2 + 2 points (dual cells are hexagons + 12 pentagons)."""
    v, faces = _ico()
    pts = {}
    for a, b, c in faces:
        A, B, C = v[a], v[b], v[c]
        for i in range(freq + 1):
            for j in range(freq + 1 - i):
                k = freq - i - j
                p = (i * A + j * B + k * C) / freq
                p = p / np.linalg.norm(p)
                pts[tuple(np.round(p, 9))] = p
    P = np.array(list(pts.values()))
    return xyz_to_tp(P)


def fibonacci(n):
    i = np.arange(n) + 0.5
    th = np.arccos(1 - 2 * i / n)
    ph = (math.pi * (1 + 5 ** 0.5) * i) % (2 * math.pi)
    return np.stack([th, ph], 1)


def xyz_to_tp(P):
    return np.stack([np.arccos(np.clip(P[:, 2], -1, 1)), np.arctan2(P[:, 1], P[:, 0]) % (2 * math.pi)], 1)


def tp_to_xyz(tp):
    th, ph = tp[:, 0], tp[:, 1]
    return np.stack([np.sin(th) * np.cos(ph), np.sin(th) * np.sin(ph), np.cos(th)], 1)


def jitter(tp, sd, rng):
    X = tp_to_xyz(tp) + rng.normal(0, sd, (len(tp), 3))
    return xyz_to_tp(X / np.linalg.norm(X, axis=1, keepdims=True))


def real_basis(tp, lmax):
    """Real orthonormal spherical harmonics, columns ordered (l, m) for l <= lmax, m = -l..l."""
    lm = np.array(lm_index(lmax))
    l, m = lm[:, 0], lm[:, 1]
    Y = sph_harm_y(l[None, :], np.abs(m)[None, :], tp[:, 0:1], tp[:, 1:2])
    sign = np.where(m % 2 == 0, 1.0, -1.0)[None, :]
    return np.where(m[None, :] < 0, math.sqrt(2) * sign * Y.imag,
                    np.where(m[None, :] == 0, Y.real, math.sqrt(2) * sign * Y.real))


def lm_index(lmax):
    return [(l, m) for l in range(lmax + 1) for m in range(-l, l + 1)]


def draw(lmax, power, rng, zonal=False):
    """Coefficients: per-degree power C_l spread over 2l+1 orders (or all on m = 0 when zonal)."""
    out = []
    for l, m in lm_index(lmax):
        if zonal:
            var = power(l) if m == 0 else 0.0
        else:
            var = power(l) / (2 * l + 1)
        out.append(rng.normal() * math.sqrt(var))
    return np.array(out)


def ls_rebuild_error(tp, coef, lmax_true, lfit, Y=None):
    """Relative coefficient error of a least-squares fit to degree lfit from exact samples."""
    Y = real_basis(tp, lmax_true) if Y is None else Y
    y = Y @ coef
    nfit = (lfit + 1) ** 2
    A = Y[:, :nfit]
    est, *_ = np.linalg.lstsq(A, y, rcond=None)
    err = np.sum((est - coef[:nfit]) ** 2) + np.sum(coef[nfit:] ** 2)
    return float(err / np.sum(coef ** 2)), float(np.linalg.cond(A))
