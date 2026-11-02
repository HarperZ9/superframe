# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Stage 2 and 7 twin, the signal chain: digital sweep -> DAC -> speaker -> air (the room) -> mic -> ADC.

Every element is an explicit, seeded model so the round trip can be scored against truth:

  sweep     exponential sine sweep and its inverse filter (Farina, AES 108th Convention, 2000)
  DAC       16-bit quantisation at a chosen peak level
  speaker   2nd-order Butterworth high-pass at fc (the small-driver low-frequency roll-off), then a mild
            memoryless polynomial (2nd and 3rd harmonic distortion); Farina's method pushes harmonics
            to negative time, where the deconvolution discards them
  air       the room's modal impulse response (modes.py), scaled so the band level at the mic is
            `spl_db`
  mic       background room noise (red spectrum, HVAC-like) at `noise_dba` plus mic self-noise at
            `ein_db`, both as equivalent SPL over the band
  ADC       MEMS-class sensitivity (-26 dBFS at 94 dB SPL), 16-bit quantisation, clip detection

The twin runs at fs = 4000 Hz. The physical chain would run at 48 kHz; the quantisation-noise density of
a 16-bit converter at 48 kHz is lower than at 4 kHz by 10 log10(12) = 10.8 dB, and that offset is applied,
so the in-band noise matches the faster converter after ideal decimation.
"""
import numpy as np

FS = 4000
P_REF = 20e-6
FS_48K_GAIN = 10 ** (-10.8 / 20)


def sweep(f1, f2, T, fs=FS, level=0.5):
    t = np.arange(int(T * fs)) / fs
    R = np.log(f2 / f1)
    x = level * np.sin(2 * np.pi * f1 * T / R * (np.exp(t * R / T) - 1))
    fade = int(0.05 * fs)
    w = np.ones_like(x)
    w[:fade] = 0.5 - 0.5 * np.cos(np.pi * np.arange(fade) / fade)
    w[-fade:] = w[:fade][::-1]
    x *= w
    inv = x[::-1] * np.exp(-t * R / T)
    return x, inv


def quantise(x, bits=16, gain=1.0):
    q = 2.0 ** (1 - bits) * gain
    y = np.round(x / q) * q
    return np.clip(y, -1, 1 - q), bool(np.any(np.abs(x) >= 1))


def biquad_highpass(x, fc, fs=FS, q=0.7071):
    """RBJ cookbook high-pass (Bristow-Johnson), direct form I, numpy loop-free via lfilter-like recursion."""
    w0 = 2 * np.pi * fc / fs
    al = np.sin(w0) / (2 * q)
    cw = np.cos(w0)
    b = np.array([(1 + cw) / 2, -(1 + cw), (1 + cw) / 2])
    a = np.array([1 + al, -2 * cw, 1 - al])
    b, a = b / a[0], a / a[0]
    return _iir(b, a, x)


def _iir(b, a, x):
    y = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, xi in enumerate(x):
        yi = b[0] * xi + b[1] * x1 + b[2] * x2 - a[1] * y1 - a[2] * y2
        x2, x1, y2, y1 = x1, xi, y1, yi
        y[i] = yi
    return y


def speaker(x, fc, h2=0.03, h3=0.02):
    lin = biquad_highpass(x, fc) if fc > 0 else x
    return lin + h2 * lin ** 2 + h3 * lin ** 3, lin


def red_noise(n, rng, fs=FS, f_lo=20.0, f_hi=1000.0):
    """Unit-rms noise whose power falls as 1/f between f_lo and f_hi (room rumble)."""
    X = np.fft.rfft(rng.normal(size=n))
    f = np.fft.rfftfreq(n, 1 / fs)
    shape = np.where((f >= f_lo) & (f <= f_hi), 1 / np.sqrt(np.maximum(f, f_lo)), 0.0)
    y = np.fft.irfft(X * shape, n)
    return y / np.sqrt(np.mean(y ** 2))


def fftconv(a, b):
    n = len(a) + len(b) - 1
    m = 1 << int(np.ceil(np.log2(n)))
    return np.fft.irfft(np.fft.rfft(a, m) * np.fft.rfft(b, m), m)[:n]


def loopback(x_digital, rng, level_dbfs=-20.0, ein_dbfs=-100.0):
    """Electrical loopback: DAC output wired to ADC input, no speaker, no air. The self-test path."""
    xq, _ = quantise(x_digital)
    g = 10 ** (level_dbfs / 20) / np.max(np.abs(xq))
    v = xq * g + 10 ** (ein_dbfs / 20) * rng.normal(size=len(xq))
    adc, clipped = quantise(v, gain=FS_48K_GAIN)
    return adc, clipped, g


def record(x_digital, h_room, fc, rng, spl_db=80.0, noise_dba=30.0, ein_db=29.0, through_air=True):
    """The physical round trip. Returns the pressure-referred ADC samples, the clip flag and the scale
    (pascals per unit of the linear chain) that maps the twin's true chain IR onto the recording."""
    xq, _ = quantise(x_digital)
    drive, lin = speaker(xq, fc)
    if through_air:
        p = fftconv(drive, h_room)
        p_lin = fftconv(lin, h_room)
    else:
        p, p_lin = drive.copy(), lin.copy()
    scale = (P_REF * 10 ** (spl_db / 20)) / np.sqrt(np.mean(p_lin ** 2) + 1e-30)
    p *= scale
    n = len(p)
    noise = (P_REF * 10 ** (noise_dba / 20)) * red_noise(n, rng) + (P_REF * 10 ** (ein_db / 20)) * rng.normal(size=n)
    sens = 10 ** (-26 / 20)                 # full scale per pascal
    v = (p + noise) * sens
    adc, clipped = quantise(v, gain=FS_48K_GAIN)
    return adc / sens, clipped, scale


def deconvolve(y, x, inv, f1, f2, fs=FS, length=None, eps=1e-6):
    """Farina deconvolution, y * inv, divided by x * inv so the in-band response is exact (a Kirkeby and
    Nelson 1998 style regularised division; the plain normalisation leaves about 1 dB of ripple).
    Dividing by x * inv removes the sweep's delay, so the response starts at sample 0; harmonic distortion
    lands at negative time, which wraps to the far end of the padded buffer and is cut away."""
    n = len(y) + len(inv) - 1
    m = 1 << int(np.ceil(np.log2(n)))
    K = np.fft.rfft(x, m) * np.fft.rfft(inv, m)
    G = np.fft.rfft(inv, m) * np.conj(K) / (np.abs(K) ** 2 + eps * np.max(np.abs(K)) ** 2)
    h = np.fft.irfft(np.fft.rfft(y, m) * G, m)
    L = length or (len(y) - len(x) + 1)
    return h[:L]
