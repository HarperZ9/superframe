# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""High-resolution modal estimation: the door past the peak-picking resolution wall.

Wall audited: Fourier peak picking cannot split two modes closer than about one modal bandwidth
B = 2.2 / T60 (the Rayleigh-type limit of the periodogram). Assumption it rests on: no model of the
signal. A linear room's impulse response is exactly a sum of damped complex exponentials, so a
parametric estimator with that model can resolve closer modes, paid for in signal-to-noise ratio.

Method: the matrix pencil (Hua and Sarkar 1990), a descendant of Prony (1795) and a sibling of ESPRIT
(Roy and Kailath 1989). The band is cut into overlapping sub-bands; each sub-band is heterodyned to
zero, filtered by a Gaussian window in frequency and decimated. A decaying exponential convolved with a
Gaussian is the same exponential once the Gaussian's transient has passed (exponentials are eigenfunctions
of convolution), so the first four filter time constants are skipped and the pencil runs on the next
`span` x T60 seconds. Model order is set
by the singular values that stand above the noise floor of the Hankel matrix. Poles are kept only in
the sub-band's central part (so each mode is counted once) and only with a plausible decay rate.
"""
import numpy as np


def _subband(h, fs, fc, half_bw, fs_sub):
    n = len(h)
    H = np.fft.fft(h)
    f = np.fft.fftfreq(n, 1 / fs)
    sig_f = half_bw / 2
    x = np.fft.ifft(H * np.exp(-0.5 * ((f - fc) / sig_f) ** 2))
    t = np.arange(n) / fs
    x = x * np.exp(-2j * np.pi * fc * t)
    step = max(1, int(round(fs / fs_sub)))
    return x[::step], fs / step


def matrix_pencil(y, ts, sv_rel=1e-3, max_order=40, amp_rel=0.03):
    N = len(y)
    L = N // 3
    Y = np.array([y[i:i + L + 1] for i in range(N - L)])
    U, s, Vh = np.linalg.svd(Y, full_matrices=False)
    M = int(min(max_order, np.sum(s > sv_rel * s[0])))
    if M == 0:
        return np.array([]), np.array([]), s
    V = Vh[:M].T            # columns of Y^T span the Vandermonde basis z^j (no conjugate)
    V1, V2 = V[:-1], V[1:]
    z = np.linalg.eigvals(np.linalg.pinv(V1) @ V2)
    k = np.arange(N)[:, None]
    Z = z[None, :] ** k
    amp, *_ = np.linalg.lstsq(Z, y, rcond=None)
    big = np.abs(amp) >= amp_rel * np.abs(amp).max()
    z = z[big]
    freq = np.angle(z) / (2 * np.pi * ts)
    damp = -np.log(np.abs(z) + 1e-300) / ts
    return freq, damp, s


def modes_in_band(h, fs, f_lo, f_hi, t60, width=16.0, span_t60=1.0, sv_rel=1e-3):
    """Return the estimated modal frequencies in [f_lo, f_hi] and their decay rates."""
    half = width / 2
    centres = np.arange(f_lo + half / 2, f_hi + half, half)
    fs_sub = 4 * width
    d_nom = 6.91 / t60
    out_f, out_d = [], []
    for fc in centres:
        y, fsub = _subband(h, fs, fc, half, fs_sub)
        skip = int(np.ceil(4 * fsub / (2 * np.pi * half / 2)))
        n = int(span_t60 * t60 * fsub) + 8
        y = y[skip:skip + max(n, 24)]
        fr, dp, _ = matrix_pencil(y, 1 / fsub, sv_rel=sv_rel)
        for a, d in zip(fr, dp):
            if abs(a) <= half / 2 and d_nom / 4 <= d <= 4 * d_nom:
                g = fc + a
                if f_lo <= g <= f_hi:
                    out_f.append(g)
                    out_d.append(d)
    o = np.argsort(out_f)
    return np.array(out_f)[o], np.array(out_d)[o]
