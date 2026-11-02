# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The room-shape meter's estimator: impulse response in, room volume, surface and decay out.

Steps (each names its lineage):
  1. T60 by Schroeder backward integration (Schroeder 1965), fit from -5 to -25 dB (T20 x 3, ISO 3382),
     after truncating at the noise floor (a reduced Lundeby 1995 step).
  2. The transfer spectrum, zero-padded to 0.05 Hz, and the noise spectrum from the IR's tail.
  3. Modal peaks: local maxima at least 3 dB above both neighbouring minima inside three modal
     bandwidths (B = 2.2 / T60) and 10 dB above the noise.
  4. Band: from f_lo (the lowest frequency 15 dB above the noise) to a fixed 150 Hz.
     S1, naive count of Fourier peaks against Weyl's N(f), fitted for V and kappa = S / V^(2/3).
     S2, the same peaks, Poisson-corrected: a box's modes follow Poisson spacing (Berry and Tabor 1977), so a
     mode is resolved with probability exp(-rho delta); fit V and S / V^(2/3) to the corrected count.
     S3, matrix-pencil modes (pencil.py), Poisson-corrected with a narrower resolving width.
  5. S4, shoebox fit on the pencil modes. Find (Lx >= Ly >= Lz) whose eigenfrequencies best explain the peak list below
     f_hi (coarse grid then refine). Pays in a prior: the room must be a box.
  6. Sabine cross-check (Sabine 1900): mean absorption alpha = 0.161 V / (S T60) from the fitted V, S.
"""
import numpy as np

import modes

C = modes.C


def schroeder_t60(h, fs, band=(40.0, 800.0)):
    n = len(h)
    H = np.fft.rfft(h, 2 * n)               # zero-padded: the band filter's pre-ringing of the onset
    f = np.fft.rfftfreq(2 * n, 1 / fs)      # wraps into the pad, not into the decay tail
    H[(f < band[0]) | (f > band[1])] = 0
    x = np.fft.irfft(H, 2 * n)[:n]
    e = x ** 2
    win = max(1, int(0.02 * fs))
    env = np.convolve(e, np.ones(win) / win, mode="same")
    tail = env[int(0.8 * n):]
    floor = float(np.mean(tail)) if len(tail) else 0.0
    above = np.nonzero(env > 3 * floor)[0]
    cut = int(above[-1]) if len(above) else n
    cut = max(cut, int(0.2 * fs))
    edc = np.cumsum(e[:cut][::-1])[::-1]
    edc_db = 10 * np.log10(edc / edc[0] + 1e-30)
    t = np.arange(cut) / fs
    sel = (edc_db <= -5) & (edc_db >= -25)
    if sel.sum() < 10:
        sel = (edc_db <= -5) & (edc_db >= -15)
    if sel.sum() < 10:
        return float("nan"), {"cut_s": cut / fs, "range": "too short"}
    slope = np.polyfit(t[sel], edc_db[sel], 1)[0]
    return float(-60.0 / slope), {"cut_s": cut / fs, "floor": floor}


def spectrum(h, fs, cut_s, res_hz=0.05):
    n_sig = int(cut_s * fs)
    sig = h[:n_sig] * np.hanning(2 * n_sig)[n_sig:]
    tail = h[-n_sig:] if len(h) >= 2 * n_sig else h[n_sig:]
    m = int(fs / res_hz)
    f = np.fft.rfftfreq(m, 1 / fs)
    S = np.abs(np.fft.rfft(sig, m)) ** 2
    N = np.abs(np.fft.rfft(tail * np.hanning(len(tail)), m)) ** 2 * (n_sig / max(len(tail), 1))
    k = max(1, int(5 / res_hz))
    N = np.convolve(N, np.ones(k) / k, mode="same")
    return f, 10 * np.log10(S + 1e-30), 10 * np.log10(N + 1e-30)


def pick_peaks(f, s_db, n_db, f_lo, f_hi, bw, prom=3.0, snr=10.0):
    df = f[1] - f[0]
    w = max(2, int(3 * bw / df))
    i0, i1 = np.searchsorted(f, f_lo), np.searchsorted(f, f_hi)
    out = []
    for i in range(max(i0, 1), min(i1, len(f) - 1)):
        if not (s_db[i] >= s_db[i - 1] and s_db[i] > s_db[i + 1]):
            continue
        if s_db[i] - n_db[i] < snr:
            continue
        left = s_db[max(0, i - w):i].min()
        right = s_db[i + 1:i + 1 + w].min()
        if s_db[i] - max(left, right) >= prom:
            out.append(f[i])
    return np.array(out)


def f_low(f, s_db, n_db, floor_hz=20.0, need=15.0):
    k = max(1, int(5 / (f[1] - f[0])))
    snr = np.convolve(s_db - n_db, np.ones(k) / k, mode="same")
    ok = np.nonzero((f >= floor_hz) & (snr > need))[0]
    return float(f[ok[0]]) if len(ok) else float("nan")


def density(f, V, S, L):
    """dN/df from Weyl's law with the rigid-wall surface and edge terms."""
    return 4 * np.pi * V * f ** 2 / C ** 3 + np.pi * S * f / (2 * C ** 2) + L / (8 * C)


V_GRID = np.exp(np.linspace(np.log(5.0), np.log(600.0), 400))
KAPPA_GRID = np.linspace(6.0, 9.0, 13)


def poisson_fit(peaks, f_lo, f_hi, delta):
    """S2, the corrected count. A box is an integrable system, so its levels follow Poisson spacing
    statistics (Berry and Tabor 1977). A mode is resolved only when no neighbour lies within delta,
    so the counted density is rho(f) exp(-rho(f) delta). Fit V and the shape factor kappa = S / V^(2/3)
    (6 for a cube, larger for elongated boxes) by least squares on the cumulative count."""
    p = np.sort(peaks[(peaks >= f_lo) & (peaks <= f_hi)])
    if len(p) < 4:
        return None
    k = np.arange(1, len(p) + 1, dtype=float)
    fg = np.linspace(f_lo, f_hi, 400)
    best = (np.inf, None)
    for kap in KAPPA_GRID:
        S = kap * V_GRID ** (2 / 3)
        L = 12 * V_GRID ** (1 / 3)
        rho = density(fg[None, :], V_GRID[:, None], S[:, None], L[:, None])
        n = rho * np.exp(-rho * delta)
        cum = np.concatenate([np.zeros((len(V_GRID), 1)),
                              np.cumsum(0.5 * (n[:, 1:] + n[:, :-1]) * np.diff(fg)[None, :], 1)], 1)
        pred = np.array([np.interp(p, fg, c) for c in cum])
        sse = ((pred - k[None, :]) ** 2).sum(1)
        i = int(np.argmin(sse))
        if sse[i] < best[0]:
            best = (float(sse[i]), (float(V_GRID[i]), float(S[i]), float(kap)))
    V, S, kap = best[1]
    return {"V": V, "S": S, "kappa": kap, "sse": best[0], "n_peaks": int(len(p))}


COUNT_W = 0.5   # weight of the mode-count mismatch in the shoebox score; set on pilot seeds 1 and 2


def _box_score(peaks, dims, f_hi, tol):
    f, _ = modes.eigenfrequencies(dims, f_hi)
    if len(f) == 0:
        return 1e9
    d_meas = np.min(np.abs(peaks[:, None] - f[None, :]), 1)
    d_pred = np.min(np.abs(f[:, None] - peaks[None, :]), 1)
    count = abs(len(f) - len(peaks)) / len(peaks)
    return float(np.mean(np.minimum(d_meas, tol)) + 0.5 * np.mean(np.minimum(d_pred, tol)) + COUNT_W * tol * count)


def box_fit(peaks, f_hi, bw):
    p = np.sort(peaks[peaks <= f_hi])
    if len(p) < 4:
        return None
    tol = max(0.5 * bw, 0.5)
    grid = np.arange(2.0, 9.01, 0.25)
    best = (1e9, None)
    for lx in grid:
        for ly in grid[grid <= lx]:
            for lz in grid[(grid <= ly) & (grid <= 4.0)]:
                s = _box_score(p, (lx, ly, lz), f_hi, tol)
                if s < best[0]:
                    best = (s, (lx, ly, lz))
    step = 0.125
    d = np.array(best[1])
    for _ in range(4):
        for i in range(3):
            for sgn in (-1, 1):
                t = d.copy()
                t[i] += sgn * step
                if t[i] < 1.5:
                    continue
                s = _box_score(p, tuple(t), f_hi, tol)
                if s < best[0]:
                    best, d = (s, tuple(t)), t
        step /= 2
    g = modes.geometry(tuple(d))
    return {"V": g["V"], "S": g["S"], "dims": [float(x) for x in d], "score": best[0]}


# Frozen after pilot 2 (seeds 1 and 2, 36 rooms, 30 settings; pilot2.py). The best of 30 settings on 36
# rooms is an optimistic pick, so the preregistered run on fresh seeds is what counts.
F_HI = 150.0                 # fixed band top, Hz
S2_DELTA_PER_BW = 2.0        # resolving width of Fourier peak picking, in modal bandwidths
S3_DELTA_PER_BW = 0.3        # resolving width of the matrix pencil, in modal bandwidths


def analyse(h, fs, method="all"):
    """method 'all' runs S1 to S4; 'fast' skips the shoebox search (S4)."""
    import pencil
    t60, tinfo = schroeder_t60(h, fs)
    if not np.isfinite(t60):
        return {"ok": False, "why": "no decay range", "t60": t60}
    f, s_db, n_db = spectrum(h, fs, tinfo["cut_s"])
    bw = 2.2 / t60
    flo = f_low(f, s_db, n_db)
    if not np.isfinite(flo) or flo > F_HI - 30:
        return {"ok": False, "why": "no band above the noise", "t60": t60}
    fhi = F_HI
    pm, pd = pencil.modes_in_band(h, fs, flo, fhi, t60, sv_rel=1e-2)
    peaks = pick_peaks(f, s_db, n_db, flo, fhi, bw)
    out = {"ok": False, "t60": t60, "f_lo": flo, "f_hi": fhi, "bandwidth": bw,
           "peaks": [float(x) for x in peaks], "pencil_modes": [float(x) for x in pm],
           "pencil_decay": [float(x) for x in pd],
           "S1": poisson_fit(peaks, flo, fhi, 0.0), "S2": poisson_fit(peaks, flo, fhi, S2_DELTA_PER_BW * bw),
           "S3": poisson_fit(pm, flo, fhi, S3_DELTA_PER_BW * bw)}
    if out["S3"] is None:
        out["why"] = "fewer than 4 modes in band"
        return out
    out["ok"] = True
    out["alpha_sabine"] = 0.161 * out["S3"]["V"] / (out["S3"]["S"] * t60)
    if method == "all":
        out["S4"] = box_fit(pm, fhi, bw)
    return out
