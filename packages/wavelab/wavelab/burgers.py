# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Brute force in sound: a plane wave steepening to a shock, and the ceiling it then meets.

Dimensionless Burgers equation (Blackstock's form): dV/dsigma - V dV/dtheta = (1/Gamma) d2V/dtheta2, V(0) = sin theta.
sigma = x / xbar with the shock-formation distance xbar = rho c^3 / (beta omega p0); Gamma = 1 / (alpha xbar).
Known answers: the Fubini series B_n = 2 J_n(n sigma) / (n sigma) before the shock (sigma < 1), steepness
1 / (1 - sigma) at theta = 0, and the Fay solution B_n = (2/Gamma) / sinh(n (1 + sigma) / Gamma) long after it,
whose fundamental no longer depends on the source amplitude (acoustic saturation).
"""
import numpy as np
from scipy.special import jv


def shock_distance(p0, f, rho, c, beta):
    """Plane-wave shock-formation distance xbar = rho c^3 / (beta omega p0), metres."""
    return rho * c ** 3 / (beta * 2 * np.pi * f * p0)


def fubini(sigma, nmax=50):
    """Harmonic amplitudes B_1..B_nmax of the lossless pre-shock solution."""
    n = np.arange(1, nmax + 1)
    return 2 * jv(n, n * sigma) / (n * sigma)


def fay(sigma, gamma, nmax=50):
    """Harmonic amplitudes of the old-age (sawtooth with thermoviscous loss) solution, sigma >= 3."""
    n = np.arange(1, nmax + 1)
    return (2 / gamma) / np.sinh(n * (1 + sigma) / gamma)


def saturation_level(alpha_x, amp):
    """Received fundamental in units of the amplitude whose shock distance equals the range, for a source of
    relative amplitude amp at alpha*x = alpha_x: amp * B1 with sigma = amp and Gamma = amp / alpha_x."""
    return amp * fay(amp, amp / alpha_x, 1)[0]


def _rhs_hat(vh, k):
    v = np.fft.irfft(vh)
    return 0.5j * k * np.fft.rfft(v * v)  # d/dtheta of V^2 / 2


def solve(gamma, sigma_end, n=4096, nharm=8, record=None, cfl=0.4, wrong_beta=1.0):
    """Integrate from V = sin theta to sigma_end with an integrating-factor RK4 pseudo-spectral scheme.

    record: sigmas at which to keep (|B_1..B_nharm|, max |dV/dtheta|). wrong_beta scales the nonlinear term
    (a planted error: 1.0 is the equation; 1/1.2 is the 'forgot B/2A' mistake that moves the shock by 20 percent).
    """
    theta = np.linspace(-np.pi, np.pi, n, endpoint=False)
    k = np.arange(n // 2 + 1).astype(float)
    vh = np.fft.rfft(np.sin(theta))
    h = cfl * (2 * np.pi / n)
    record = sorted(record or [sigma_end])
    out, s, i = [], 0.0, 0
    lin = -(k ** 2) / gamma
    while i < len(record):
        step = min(h, record[i] - s)
        e2, e1 = np.exp(lin * step / 2), np.exp(lin * step)
        a = wrong_beta * _rhs_hat(vh, k)
        b = wrong_beta * _rhs_hat(e2 * (vh + step / 2 * a), k)
        c = wrong_beta * _rhs_hat(e2 * vh + step / 2 * b, k)
        d = wrong_beta * _rhs_hat(e1 * vh + step * e2 * c, k)
        vh = e1 * vh + step / 6 * (e1 * a + 2 * e2 * (b + c) + d)
        s += step
        if s >= record[i] - 1e-12:
            harm = 2 * np.abs(vh[1:nharm + 1]) / n
            slope = np.abs(np.fft.irfft(1j * k * vh)).max()
            out.append({"sigma": record[i], "harmonics": harm.tolist(), "steepness": float(slope)})
            i += 1
    return out


def shock_sigma_numeric(gamma=4000.0, n=8192, wrong_beta=1.0):
    """Shock formation read from the steepness: fit 1/steepness = a (sigma0 - sigma) on sigma in [0.5, 0.85]."""
    sig = np.linspace(0.5, 0.85, 8)
    rec = solve(gamma, 0.85, n=n, record=list(sig), wrong_beta=wrong_beta)
    inv = np.array([1 / r["steepness"] for r in rec])
    a, b = np.polyfit(sig, inv, 1)
    return float(-b / a)


def saturation_curve(alpha_x, amps, n=8192):
    """Received fundamental (units of the amplitude whose xbar equals the range) against source amplitude,
    numerically, and the two limits: linear amp * exp(-alpha x) and the Fay ceiling."""
    rows = []
    for amp in amps:
        rec = solve(amp / alpha_x, amp, n=n, nharm=4)[0]
        rows.append({"amp": float(amp), "p1": amp * rec["harmonics"][0], "linear": amp * np.exp(-alpha_x),
                     "fay": float(saturation_level(alpha_x, amp)), "harm": rec["harmonics"]})
    return rows
