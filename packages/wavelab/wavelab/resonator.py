# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Resonant macrosonic synthesis in a modal model: does detuning the overtones postpone the saturation ceiling?

A one-dimensional resonator driven at its first mode, written in modes u(theta, t) = sum_n q_n(t) cos(n theta):
    q_n'' + 2 g_n q_n' + w_n^2 q_n = eps w_n^2 N_n(q) + F cos(W t) [n = 1],
with thermoviscous damping g_n = g_1 n^2 and the quadratic interaction of u^2 projected on cos(n theta):
    N_n = 1/2 sum_{m + k = n} q_m q_k + sum_{m - k = n, k >= 1} q_m q_k.
Harmonic resonators have w_n = n w_1, so every overtone the nonlinearity makes is itself resonant and the energy
cascades upward (the wave steepens toward a shock and the fundamental saturates). Detuned resonators shift the
overtones, w_n = n w_1 (1 + d) for n >= 2, so the cascade is driven off resonance.
Known answers: the linear steady amplitude F / (2 g_1 W) at W = w_1, and at weak drive the second-mode amplitude
eps w_2^2 A^2 / 4 / |w_2^2 - 4 W^2 + 4i g_2 W|. Dimensionless throughout (w_1 = 1); no physical device is specified.
"""
import numpy as np


def frequencies(n_modes, detune=0.0, w1=1.0):
    n = np.arange(1, n_modes + 1, dtype=float)
    w = n * w1
    w[1:] *= 1 + detune
    return w


def _interaction(q):
    """N_n for n = 1..N from the mode amplitudes q (length N)."""
    N = len(q)
    full = np.concatenate([[0.0], q])  # index = mode number
    conv = np.convolve(full, full)[: N + 1]  # sum_{m + k = n} q_m q_k (m, k >= 0; q_0 = 0)
    corr = np.correlate(full, full, mode="full")[N:]  # sum_m q_{m + n} q_m for n = 0..N
    return 0.5 * conv[1:] + corr[1: N + 1]


def simulate(F, detune=0.0, n_modes=16, g1=0.01, eps=1.0, W=1.0, periods=120, dt=0.01, keep=4, nonlinear=True):
    """RK4 from rest; returns the last `keep` periods of q (time, modes) and their times."""
    w = frequencies(n_modes, detune)
    g = g1 * np.arange(1, n_modes + 1, dtype=float) ** 2
    T = 2 * np.pi / W
    steps = int(round(periods * T / dt))
    rec_from = steps - int(round(keep * T / dt))
    q, v = np.zeros(n_modes), np.zeros(n_modes)
    out_t, out_q = [], []

    def acc(t, q, v):
        a = -2 * g * v - w * w * q
        if nonlinear:
            a += eps * w * w * _interaction(q)
        a[0] += F * np.cos(W * t)
        return a
    t = 0.0
    for s in range(steps):
        k1q, k1v = v, acc(t, q, v)
        k2q, k2v = v + 0.5 * dt * k1v, acc(t + 0.5 * dt, q + 0.5 * dt * k1q, v + 0.5 * dt * k1v)
        k3q, k3v = v + 0.5 * dt * k2v, acc(t + 0.5 * dt, q + 0.5 * dt * k2q, v + 0.5 * dt * k2v)
        k4q, k4v = v + dt * k3v, acc(t + dt, q + dt * k3q, v + dt * k3v)
        q = q + dt / 6 * (k1q + 2 * k2q + 2 * k3q + k4q)
        v = v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v)
        t += dt
        if not np.all(np.isfinite(q)):
            raise FloatingPointError(f"diverged at t = {t:.1f} (F = {F}, detune = {detune})")
        if s >= rec_from:
            out_t.append(t)
            out_q.append(q.copy())
    return np.array(out_t), np.array(out_q)


def harmonic_amplitude(t, x, h, W=1.0):
    """Amplitude of the h-th harmonic of W in the record x(t) (an integer number of periods)."""
    return float(2 * np.abs(np.mean(x * np.exp(-1j * h * W * t))))


def measures(F, detune=0.0, **kw):
    """Fundamental of mode 1, the peak and peak-to-peak of u at theta = 0, the energy share above mode 1,
    and the steepness max |du/dt| relative to a sine of the same peak-to-peak."""
    t, q = simulate(F, detune, **kw)
    u = q.sum(axis=1)
    W = kw.get("W", 1.0)
    A1 = harmonic_amplitude(t, q[:, 0], 1, W)
    e = (q ** 2).mean(axis=0)
    du = np.abs(np.gradient(u, t)).max()
    pp = u.max() - u.min()
    return {"F": F, "detune": detune, "A1": A1, "peak": float(np.abs(u).max()), "pp": float(pp),
            "overtone_share": float(e[1:].sum() / e.sum()), "steepness": float(du / (W * pp / 2)) if pp > 0 else 0.0,
            "modes_rms": np.sqrt(e).tolist()}


def linear_amplitude(F, g1=0.01, W=1.0):
    return F / (2 * g1 * W)


def second_mode_weak(A, detune=0.0, g1=0.01, eps=1.0, W=1.0):
    w2 = frequencies(2, detune)[1]
    g2 = 4 * g1
    return eps * w2 * w2 * A * A / 4 / abs(w2 * w2 - 4 * W * W + 4j * g2 * W)


def ceiling_drive(rows, frac=0.7):
    """Smallest drive at which the fundamental falls below frac of the linear answer (inf if never)."""
    for r in sorted(rows, key=lambda r: r["F"]):
        if r["A1"] < frac * linear_amplitude(r["F"]):
            return r["F"]
    return float("inf")
