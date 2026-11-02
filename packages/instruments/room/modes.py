# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Stage 2 twin, the room: a rigid-walled shoebox as a sum of damped normal modes.

Model (Morse and Ingard 1968; Kuttruff, Room Acoustics, ch. 3): the pressure response at r_mic to a
volume-acceleration impulse at r_src is

    h(t) = (c^2 / V) * sum_n  psi_n(r_src) psi_n(r_mic) / Lambda_n * cos(omega_n t) * exp(-delta_n t)

with psi_n = cos(nx pi x / Lx) cos(ny pi y / Ly) cos(nz pi z / Lz), Lambda_n = prod(1 if n_i = 0 else 1/2)
and omega_n = c pi sqrt((nx/Lx)^2 + (ny/Ly)^2 + (nz/Lz)^2). Each mode decays at delta = 6.91 / T60 times a
log-normal factor (sigma 0.3), because real modes do not share one decay rate. The (0, 0, 0) mode is left out:
it is a DC term no speaker can drive.

Weyl's law with the Neumann (rigid wall) corrections gives the expected count below f:
    N(f) = 4 pi V f^3 / (3 c^3) + pi S f^2 / (4 c^2) + L f / (8 c)
(Weyl 1911; the surface and edge terms for the rectangular room are in Morse and Bolt 1944).
"""
import numpy as np

C = 343.0


def weyl(f, V, S, L):
    f = np.asarray(f, float)
    return 4 * np.pi * V * f ** 3 / (3 * C ** 3) + np.pi * S * f ** 2 / (4 * C ** 2) + L * f / (8 * C)


def geometry(dims):
    lx, ly, lz = dims
    return {"V": lx * ly * lz, "S": 2 * (lx * ly + ly * lz + lx * lz), "L": 4 * (lx + ly + lz)}


def eigenfrequencies(dims, fmax):
    """All (nx, ny, nz) with f_n < fmax, as (freqs, n) sorted by frequency; (0,0,0) excluded."""
    lx, ly, lz = dims
    m = [int(np.floor(2 * fmax * d / C)) + 1 for d in dims]
    nx, ny, nz = np.meshgrid(np.arange(m[0]), np.arange(m[1]), np.arange(m[2]), indexing="ij")
    f = 0.5 * C * np.sqrt((nx / lx) ** 2 + (ny / ly) ** 2 + (nz / lz) ** 2)
    keep = (f < fmax) & (f > 0)
    n = np.stack([nx[keep], ny[keep], nz[keep]], 1)
    f = f[keep]
    o = np.argsort(f)
    return f[o], n[o]


def impulse_response(dims, src, mic, t60, fs, fmax, rng, seconds=None, chunk=512):
    """Room impulse response sampled at fs, band-limited by the mode cut at fmax."""
    f, n = eigenfrequencies(dims, fmax)
    d = np.asarray(dims, float)
    psi_s = np.prod(np.cos(np.pi * n * np.asarray(src) / d), 1)
    psi_m = np.prod(np.cos(np.pi * n * np.asarray(mic) / d), 1)
    lam = np.prod(np.where(n == 0, 1.0, 0.5), 1)
    w = psi_s * psi_m / lam
    delta = 6.91 / t60 * np.exp(rng.normal(0, 0.3, len(f)))
    T = seconds if seconds else 1.5 * t60
    t = np.arange(int(T * fs)) / fs
    h = np.zeros_like(t)
    for i in range(0, len(f), chunk):
        sl = slice(i, i + chunk)
        h += (w[sl, None] * np.cos(2 * np.pi * f[sl, None] * t) * np.exp(-delta[sl, None] * t)).sum(0)
    h *= C ** 2 / geometry(dims)["V"]
    return h, {"freqs": f, "n": n, "weight": w, "delta": delta}


def random_room(rng):
    """A furnished-room-sized shoebox: V from about 20 to 150 m^3, height 2.3 to 3.2 m."""
    lz = rng.uniform(2.3, 3.2)
    lx = rng.uniform(3.0, 8.0)
    ly = rng.uniform(2.5, min(lx, 6.0))
    return (lx, ly, lz)


def corner_positions(dims, rng):
    """Protocol: speaker near one floor corner, mic near the opposite top corner (all modes have |psi|
    near 1 at corners, so a corner pair hears every mode; Kuttruff's practice). Offsets 0.1 to 0.3 m."""
    d = np.asarray(dims)
    off_s = rng.uniform(0.1, 0.3, 3)
    off_m = rng.uniform(0.1, 0.3, 3)
    return off_s, d - off_m
