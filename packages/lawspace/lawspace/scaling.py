# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Family 5: scaling. Multifractal spectra (MFDFA), self-affine surfaces, dynamic scaling, and the
square-cube law with its small-scale mirror (Bond and Reynolds numbers).
"""
import numpy as np

Q_DEFAULT = np.arange(-4.0, 4.01, 0.5)


def fgn(n, H, rng):
    """Fractional Gaussian noise by circulant embedding (Davies-Harte)."""
    k = np.arange(n + 1)
    g = 0.5 * (np.abs(k + 1) ** (2 * H) - 2 * np.abs(k) ** (2 * H) + np.abs(k - 1) ** (2 * H))
    c = np.r_[g, g[-2:0:-1]]
    lam = np.clip(np.fft.fft(c).real, 0, None)
    m = len(c)
    z = rng.standard_normal(m) + 1j * rng.standard_normal(m)
    return np.fft.fft(np.sqrt(lam / m) * z).real[:n]


def binomial_cascade(levels, p, rng=None):
    """Deterministic binomial measure on 2^levels cells: each split gives share p to one half."""
    x = np.ones(1)
    for _ in range(levels):
        left = np.full(len(x), p)
        if rng is not None:
            flip = rng.random(len(x)) < 0.5
            left = np.where(flip, 1 - p, p)
        x = np.column_stack([x * left, x * (1 - left)]).ravel()
    return x


def cascade_spectrum(p, q=Q_DEFAULT):
    """Analytic tau(q) = -log2(p^q + (1-p)^q), alpha = tau'(q), f = q alpha - tau."""
    a, b = p ** q, (1 - p) ** q
    tau = -np.log2(a + b)
    alpha = -(a * np.log2(p) + b * np.log2(1 - p)) / (a + b)
    return alpha, q * alpha - tau


def _fluct(Y, s):
    """Squared detrended fluctuation (order 1) of each segment, from both ends of the profile."""
    n = len(Y) // s
    if n < 2:
        return None
    segs = np.r_[Y[:n * s].reshape(n, s), Y[len(Y) - n * s:].reshape(n, s)]
    t = np.arange(s) - (s - 1) / 2
    slope = segs @ t / (t @ t)
    resid = segs - segs.mean(axis=1, keepdims=True) - np.outer(slope, t)
    return (resid ** 2).mean(axis=1)


def mfdfa(x, q=Q_DEFAULT, scales=None, rng=None):
    """Generalized Hurst h(q), and the singularity spectrum alpha(q), f(alpha). rng given: resample the
    segments at each scale (a segment bootstrap) for confidence intervals."""
    x = np.asarray(x, float)
    Y = np.cumsum(x - x.mean())
    if scales is None:
        scales = np.unique(np.geomspace(10, len(x) // 5, 16).astype(int))
    logF = []
    for s in scales:
        F2 = _fluct(Y, s)
        F2 = F2[F2 > 0]
        if rng is not None:
            F2 = rng.choice(F2, len(F2))
        row = [np.exp(0.5 * np.mean(np.log(F2))) if abs(qq) < 1e-9 else np.mean(F2 ** (qq / 2)) ** (1 / qq)
               for qq in q]
        logF.append(np.log(row))
    logF = np.array(logF)
    h = np.polyfit(np.log(scales), logF, 1)[0]
    tau = q * h - 1
    alpha = np.gradient(tau, q)
    return {"q": q, "h": h, "alpha": alpha, "f": q * alpha - tau, "width": float(alpha.max() - alpha.min()),
            "scales": scales}


def self_affine(n, Hx, Hy, rng):
    """Gaussian surface whose x profiles have Hurst Hx and y profiles Hurst Hy.

    S(kx, ky) = (kx^2 + |ky|^r)^-c with r = 2 Hy / Hx and c = 1/2 + Hx + Hx / (2 Hy); integrating over
    one wavenumber gives profile spectra kx^-(1 + 2 Hx) and ky^-(1 + 2 Hy). On a square lattice the
    direction with the larger exponent reads high (about +0.07 at 0.4 against 0.6 on 1024^2) because
    the scaling range in that direction is only n^(Hx / Hy) cells long; past a ratio near 1.7 the
    estimate breaks down. That shrinking range is itself the self-affine property."""
    k = np.fft.fftfreq(n)
    kx, ky = np.meshgrid(k, k, indexing="xy")
    r, c = 2 * Hy / Hx, 0.5 + Hx + Hx / (2 * Hy)
    with np.errstate(divide="ignore"):
        S = (kx ** 2 + np.abs(ky) ** r) ** (-c)
    S[0, 0] = 0
    S[~np.isfinite(S)] = 0
    z = np.fft.ifft2(np.sqrt(S) * (rng.standard_normal((n, n)) + 1j * rng.standard_normal((n, n)))).real
    return (z - z.mean()) / z.std()


def profile_hurst(z, axis):
    """Hurst exponent from the mean profile power spectrum along one axis, P(k) ~ k^-(1 + 2H), fitted on
    wavenumbers 2 to n/8."""
    n = z.shape[axis]
    P = (np.abs(np.fft.rfft(z, axis=axis)) ** 2).mean(axis=1 - axis)
    k = np.arange(len(P))
    sel = slice(2, n // 8)
    beta = -np.polyfit(np.log(k[sel]), np.log(P[sel]), 1)[0]
    return float((beta - 1) / 2)


def dynamic_z(z_true, rng, n_modes=12, steps=60000, dt=0.05):
    """Linear relaxation field: mode k decays at rate k^z with white forcing (an Ornstein-Uhlenbeck mode
    per k). Rates span 0.005 to 0.5 per unit time. The e-folding lag of each mode's autocorrelation gives
    its measured rate, and the log-log slope against k gives z back (the anchor: diffusion, z = 2)."""
    rate = np.geomspace(0.005, 0.5, n_modes)
    k = rate ** (1.0 / z_true)
    a = np.zeros(n_modes)
    decay, kick = np.exp(-rate * dt), np.sqrt((1 - np.exp(-2 * rate * dt)) / (2 * rate))
    H = np.empty((steps, n_modes))
    for t in range(steps):
        a = a * decay + kick * rng.standard_normal(n_modes)
        H[t] = a
    H -= H.mean(axis=0)
    F = np.fft.rfft(H, n=2 * steps, axis=0)
    ac = np.fft.irfft(np.abs(F) ** 2, axis=0)[:steps]
    ac /= ac[0]
    lag = np.array([np.argmax(ac[:, j] < np.exp(-1)) for j in range(n_modes)]) * dt
    return float(np.polyfit(np.log(k), np.log(1.0 / lag), 1)[0])


def mfdfa_ensemble(series_list, q=Q_DEFAULT, scales=None, rng=None):
    """MFDFA pooled over many short series (fluctuations of every segment of every series at each
    scale). rng given: resample the series (a series bootstrap) for confidence intervals."""
    xs = [np.asarray(x, float) for x in series_list]
    if rng is not None:
        xs = [xs[i] for i in rng.integers(0, len(xs), len(xs))]
    n = min(len(x) for x in xs)
    if scales is None:
        scales = np.unique(np.geomspace(8, n // 4, 8).astype(int))
    Ys = [np.cumsum(x - x.mean()) for x in xs]
    logF = []
    for s in scales:
        F2 = np.concatenate([_fluct(Y, s) for Y in Ys])
        F2 = F2[F2 > 0]
        logF.append(np.log([np.exp(0.5 * np.mean(np.log(F2))) if abs(qq) < 1e-9 else
                            np.mean(F2 ** (qq / 2)) ** (1 / qq) for qq in q]))
    h = np.polyfit(np.log(scales), np.array(logF), 1)[0]
    tau = q * h - 1
    alpha = np.gradient(tau, q)
    return {"q": q, "h": h, "alpha": alpha, "f": q * alpha - tau, "width": float(alpha.max() - alpha.min()),
            "scales": scales}


def square_cube(L, L0=1.0):
    """Relative area, volume (weight) and strength-to-weight for a body scaled by L / L0."""
    s = np.asarray(L, float) / L0
    return {"area": s ** 2, "volume": s ** 3, "strength_to_weight": 1.0 / s}


def bond_number(L, rho=1000.0, g=9.81, gamma=0.072):
    """Weight against surface tension: Bo = rho g L^2 / gamma. Bo = 1 at the capillary length."""
    return rho * g * np.asarray(L, float) ** 2 / gamma


def reynolds(L, v, rho=1000.0, mu=1.0e-3):
    return rho * np.asarray(v, float) * np.asarray(L, float) / mu
