# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Finesse: timing instead of amplitude. Parametric pumping, phased focusing and time reversal.

Known answers. Mathieu x'' + (a - 2 q cos 2t) x = 0: the first instability tongue is bounded by
a = 1 - q - q^2/8 + q^3/64 - q^4/1536 and a = 1 + q - q^2/8 - q^3/64 - q^4/1536. With damping,
x'' + 2 lam x' + w0^2 (1 + h cos 2 w0 t) x = 0 grows only above h = 4 lam / w0 (Landau and Lifshitz), and a
pumped (Faraday) response oscillates at half the pump frequency. N phase-aligned unit sources give amplitude N
at the focus and intensity N^2; random phases give mean intensity N. Everything is in units of wavelength and
period; nothing here specifies a physical source.
"""
import numpy as np
from scipy.integrate import solve_ivp


def mathieu_monodromy(a, q, damping=0.0):
    """Floquet multipliers of x'' + 2 damping x' + (a - 2 q cos 2t) x = 0 over one period pi."""
    def f(t, y):
        return [y[1], -2 * damping * y[1] - (a - 2 * q * np.cos(2 * t)) * y[0]]
    M = np.column_stack([solve_ivp(f, [0, np.pi], y0, rtol=1e-12, atol=1e-14, method="DOP853").y[:, -1]
                         for y0 in ([1.0, 0.0], [0.0, 1.0])])
    return np.linalg.eigvals(M)


def unstable(a, q, damping=0.0):
    return bool(np.abs(mathieu_monodromy(a, q, damping)).max() > 1 + 1e-9)


def tongue_edges(q, lo=0.4, hi=1.6, tol=1e-10):
    """Numerical edges of the first instability tongue at q, by bisection from its centre a = 1."""
    from scipy.optimize import brentq
    g = (lambda a: np.abs(mathieu_monodromy(a, q)).max() - 1 - 1e-12)
    return brentq(g, lo, 1.0 - 1e-9, xtol=tol), brentq(g, 1.0 + 1e-9 if q else 1.0, hi, xtol=tol)


def tongue_series(q):
    return (1 - q - q * q / 8 + q ** 3 / 64 - q ** 4 / 1536, 1 + q - q * q / 8 - q ** 3 / 64 - q ** 4 / 1536)


def pumped_growth(h, lam, w0=1.0, pump_ratio=2.0, periods=200):
    """Exponential growth rate of x'' + 2 lam x' + w0^2 (1 + h cos(pump_ratio w0 t)) x = 0 from the largest
    Floquet multiplier over one pump period."""
    W = pump_ratio * w0
    T = 2 * np.pi / W

    def f(t, y):
        return [y[1], -2 * lam * y[1] - w0 ** 2 * (1 + h * np.cos(W * t)) * y[0]]
    M = np.column_stack([solve_ivp(f, [0, T], y0, rtol=1e-12, atol=1e-14, method="DOP853").y[:, -1]
                         for y0 in ([1.0, 0.0], [0.0, 1.0])])
    return float(np.log(np.abs(np.linalg.eigvals(M)).max()) / T)


def threshold(lam, w0=1.0, pump_ratio=2.0, hmax=2.0):
    from scipy.optimize import brentq
    g = (lambda h: pumped_growth(h, lam, w0, pump_ratio))
    if g(hmax) < 0:
        return float("inf")
    return float(brentq(g, 0.0, hmax, xtol=1e-10))


def faraday_response(h, lam, w0=1.0, t_end=400.0, nonlin=0.05):
    """Pumped oscillator with a cubic saturation; returns the dominant response frequency over the pump frequency."""
    W = 2 * w0

    def f(t, y):
        return [y[1], -2 * lam * y[1] - w0 ** 2 * (1 + h * np.cos(W * t)) * y[0] - nonlin * y[0] ** 3]
    t = np.linspace(t_end / 2, t_end, 8192)
    x = solve_ivp(f, [0, t_end], [1e-3, 0.0], t_eval=t, rtol=1e-10, atol=1e-12).y[0]
    spec = np.abs(np.fft.rfft(x * np.hanning(len(x))))
    freqs = np.fft.rfftfreq(len(x), t[1] - t[0]) * 2 * np.pi
    return float(freqs[np.argmax(spec[1:]) + 1] / W), float(np.abs(x).max())


def array_field(src, phases, pts, k=2 * np.pi):
    """Monochromatic field of unit point sources (3D Green's function e^{ikr}/r, times the source distance to
    the origin so each source has unit amplitude at the origin)."""
    d = np.linalg.norm(pts[:, None, :] - src[None, :, :], axis=2)
    d0 = np.linalg.norm(src, axis=1)
    return (np.exp(1j * (k * d + phases[None, :])) * d0[None, :] / d).sum(axis=1)


def ring_sources(n, radius=20.0, seed=0, jitter=0.0):
    rng = np.random.default_rng(seed)
    ang = np.linspace(0, 2 * np.pi, n, endpoint=False) + jitter * rng.standard_normal(n)
    z = rng.uniform(-5, 5, n)
    return np.column_stack([radius * np.cos(ang), radius * np.sin(ang), z])


def focus_gain(n, mode="focused", seed=0, k=2 * np.pi):
    """|p|^2 at the origin for n sources: focused (phase = -k d), random phases, or sign-flipped (a planted error)."""
    src = ring_sources(n, seed=seed)
    d0 = np.linalg.norm(src, axis=1)
    rng = np.random.default_rng(seed + 1)
    ph = {"focused": -k * d0, "random": rng.uniform(0, 2 * np.pi, n), "flipped": +k * d0}[mode]
    return float(np.abs(array_field(src, ph, np.zeros((1, 3)), k)[0]) ** 2)


def focal_width(n=64, k=2 * np.pi, span=2.0, pts=401):
    """Full width at half intensity along x through the focus, in wavelengths (k = 2 pi)."""
    src = ring_sources(n)
    ph = -k * np.linalg.norm(src, axis=1)
    x = np.linspace(-span, span, pts)
    I = np.abs(array_field(src, ph, np.column_stack([x, 0 * x, 0 * x]), k)) ** 2
    above = x[I >= I.max() / 2]
    return float(above[-1] - above[0])
