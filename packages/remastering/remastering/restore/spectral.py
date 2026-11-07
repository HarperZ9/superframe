# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Frequency-domain restoration: hum, wow and flutter, bandwidth extension, codec artifacts.

- hum: the mains fundamental is searched within 2 Hz of 50 and 60 Hz on a 0.05 Hz-resolution spectrum (the frequency
  whose third-strongest of its first 8 harmonics has the highest narrowband excess over the local median); hum is then modelled per 0.5 s block as
  sinusoids at its harmonics, fitted by least squares per 2 s block (0.5 Hz resolution, so a musical partial more
  than about 1 Hz away is left alone) with Hann-weighted overlap, and subtracted. A candidate whose strongest
  harmonics vary by more than 35% (coefficient of variation) from block to block is a held note, not hum, and
  is left alone.
- wow and flutter: strong partials are tracked (parabolic peak interpolation, hop 5 ms); the median relative
  deviation of their frequency from each partial's own median is the speed error d(t); the signal is re-read at
  positions that undo it (cumulative 1 / (1 + d)), with a 32-tap windowed-sinc interpolator.
- bandwidth extension: above a cutoff fc, each frame gets a copy of the octave below fc, shifted up, given random
  phase, and scaled to the log-linear trend of the top octave below fc. Everything it adds is inferred.
- codec artifacts: in the band above 4 kHz, time-frequency bins that a lossy encoder zeroed between active
  neighbours ("swirly" holes) are filled from the 5-frame median magnitude with random phase; in the 25 ms before a
  sharp onset, high-band energy that exceeds the level of the frames before it (pre-echo) is pulled down to it.
"""
import numpy as np
from scipy.ndimage import median_filter

from ..kernels import medfilt
from ..stft import istft, stft


def _excess(m, fs):
    n = len(m)
    S = np.abs(np.fft.rfft(m * np.hanning(n)))
    base = median_filter(S, size=max(3, int(4.0 / (fs / n))) | 1)
    return S / (base + 1e-12), n


def _score(excess, n, fs, f0):
    ex = []
    for h in range(1, 9):
        k = int(round(h * f0 * n / fs))
        if k + 2 < len(excess):
            ex.append(excess[k - 2:k + 3].max())
    return float(sorted(ex)[-3]) if len(ex) >= 3 else 0.0   # at least three harmonics must stand out: hum is a comb


def hum_frequency(y, fs, quarters=4):
    """Mains frequency and its excess. The excess must hold in every quarter of the file (hum is stationary; a held
    bass note near 50 or 60 Hz is not), so the score is the minimum over quarters."""
    m = np.atleast_2d(y).mean(0)
    quarters = int(max(1, min(quarters, len(m) // int(5 * fs))))
    seg = len(m) // quarters
    seg = min(seg, int(20 * fs))
    parts = [_excess(m[q * (len(m) // quarters):q * (len(m) // quarters) + seg], fs) for q in range(quarters)]
    best = (None, 0.0)
    for f0 in np.concatenate([np.arange(48.0, 52.0, 0.02), np.arange(58.0, 62.0, 0.02)]):   # mains, with speed drift
        score = min(_score(ex, n, fs, f0) for ex, n in parts)
        if score > best[1]:
            best = (f0, score)
    if best[0] is None:
        return best
    # refine on one long spectrum: the harmonic-sum peak within 0.4 Hz, 0.005 Hz steps
    L = min(len(m), int(60 * fs))
    S = np.abs(np.fft.rfft(m[:L] * np.hanning(L)))
    grid = np.arange(best[0] - 0.4, best[0] + 0.4, 0.005)
    hs = [sum(np.interp(h * f * L / fs, np.arange(len(S)), S) for h in range(1, 6)) for f in grid]
    return float(grid[int(np.argmax(hs))]), best[1]


def dehum(y, fs, f0=None, harmonics=12, block_s=2.0, min_excess=4.0, max_cv=0.35):
    y = np.atleast_2d(np.asarray(y, np.float64)).copy()
    if f0 is None:
        f0, ex = hum_frequency(y, fs)
        if ex < min_excess:
            return y, [], {"hum_hz": None, "excess": round(ex, 2)}
    B = int(block_s * fs)
    hop = B // 2
    w = np.hanning(B + 1)[:-1]
    t = np.arange(B) / fs
    ks = [k for k in range(1, harmonics + 1) if k * f0 < 0.45 * fs]
    X = np.concatenate([np.stack([np.cos(2 * np.pi * k * f0 * t), np.sin(2 * np.pi * k * f0 * t)], 1) for k in ks], 1)
    pinv = np.linalg.pinv(X * w[:, None])                  # the same design every block: solve once
    mono = y.mean(0)
    amps = np.array([np.hypot(*(pinv @ (np.pad(mono[s:s + B], (0, max(0, B - len(mono[s:s + B])))) * w)).reshape(-1, 2).T)
                     for s in range(0, max(1, len(mono) - B), B)])
    top = np.argsort(amps.mean(0))[::-1][:3]
    cv = float(np.median(amps[:, top].std(0) / (amps[:, top].mean(0) + 1e-12))) if len(amps) > 2 else 0.0
    if cv > max_cv:                                          # hum holds steady; notes come and go
        return y, [], {"hum_hz": None, "rejected_hz": round(float(f0), 2), "amplitude_cv": round(cv, 3)}
    for c in range(y.shape[0]):
        x = y[c]
        est, norm = np.zeros(len(x) + B), np.zeros(len(x) + B)
        for s in range(0, len(x), hop):
            seg = np.zeros(B)
            part = x[s:s + B]
            seg[:len(part)] = part
            coef = pinv @ (seg * w)
            est[s:s + B] += (X @ coef) * w
            norm[s:s + B] += w
        y[c] = x - est[:len(x)] / np.maximum(norm[:len(x)], 1e-9)
    return y, [(0.0, round(y.shape[1] / fs, 3), "restored", 0.8)], {"hum_hz": round(float(f0), 2), "harmonics": len(ks),
                                                                  "amplitude_cv": round(cv, 3)}


def track_speed(y, fs, hop_s=0.005, n_fft=8192, peaks=12):
    """Relative speed error d(t) per hop from the frequency drift of the strongest partials."""
    m = np.atleast_2d(y).mean(0)
    hop = int(hop_s * fs)
    S = np.abs(stft(m, n_fft, hop))
    L = np.log(S + 1e-12)
    avg = S.mean(1)
    lo, hi = int(80 * n_fft / fs), int(4000 * n_fft / fs)
    seg = avg[lo:hi]
    is_peak = np.zeros(len(seg), bool)
    is_peak[1:-1] = (seg[1:-1] > seg[:-2]) & (seg[1:-1] >= seg[2:]) & (seg[1:-1] > seg.max() * 1e-2)
    cand = np.flatnonzero(is_peak)
    cand = cand[np.argsort(seg[cand])[::-1]] + lo
    picks = []
    for k in cand:
        if all(abs(k - p) > 6 for p in picks):
            picks.append(k)
        if len(picks) >= peaks:
            break
    devs = []
    for k in picks:
        win = L[k - 4:k + 5]
        j = win.argmax(0)
        jj = np.clip(j, 1, 7)
        a, b, c = win[jj - 1, np.arange(win.shape[1])], win[jj, np.arange(win.shape[1])], win[jj + 1, np.arange(win.shape[1])]
        frac = 0.5 * (a - c) / np.where(np.abs(a - 2 * b + c) > 1e-12, a - 2 * b + c, 1e-12)
        freq = (k - 4 + jj + np.clip(frac, -0.5, 0.5))
        rel = freq / np.median(freq) - 1
        rel[np.abs(rel) > 0.02] = np.nan
        devs.append(rel)
    d = np.nanmedian(np.array(devs), 0)
    d = np.nan_to_num(d)
    return median_filter(d, size=5), hop


def sinc_read(x, pos, taps=32):
    """x read at fractional positions with a Hann-windowed sinc."""
    i0 = np.floor(pos).astype(np.int64)
    frac = pos - i0
    out = np.zeros(len(pos))
    for j in range(-taps // 2 + 1, taps // 2 + 1):
        idx = np.clip(i0 + j, 0, len(x) - 1)
        d = j - frac
        w = np.sinc(d) * (0.5 + 0.5 * np.cos(np.pi * d / (taps / 2)))
        out += x[idx] * w
    return out


def dewow(y, fs):
    y = np.atleast_2d(np.asarray(y, np.float64))
    d, hop = track_speed(y, fs)
    n = y.shape[1]
    dd = np.interp(np.arange(n), np.arange(len(d)) * hop, d)
    pos = np.cumsum(1.0 / (1.0 + dd)) - 1.0 / (1.0 + dd[0])   # undo the warp: a sped-up stretch is read slower
    pos = np.clip(pos, 0, n - 1)
    out = np.stack([sinc_read(ch, pos) for ch in y])
    return out, [(0.0, round(n / fs, 3), "restored", 0.7)], {"speed_error_peak_pct": round(float(np.abs(d).max() * 100), 3)}


def extend_bandwidth(y, fs, fc, top=None, n_fft=2048, hop=512, seed=0):
    rng = np.random.default_rng(seed)
    y = np.atleast_2d(np.asarray(y, np.float64))
    top = top or 0.47 * fs
    f = np.fft.rfftfreq(n_fft, 1 / fs)
    kc = int(np.searchsorted(f, fc))
    width = kc - int(np.searchsorted(f, fc / 2))
    ref = (f >= fc / 2) & (f < fc)
    out = []
    ks = np.arange(kc, int(np.searchsorted(f, top)))
    src = ks - width * ((ks - kc) // width + 1)
    lf = np.log2(np.maximum(f[ref], 1.0))
    lfc = lf - lf.mean()
    for ch in y:
        S = stft(ch, n_fft, hop)
        lv = 20 * np.log10(np.abs(S[ref]) + 1e-12)                  # (ref bins, frames)
        slope = (lfc[:, None] * (lv - lv.mean(0))).sum(0) / (lfc ** 2).sum()
        icpt = lv.mean(0) - slope * lf.mean()
        target = 10 ** ((slope[None, :] * np.log2(f[ks])[:, None] + icpt[None, :]) / 20)
        target[:, lv.max(0) < -100] = 0.0
        phase = np.angle(S[src]) + rng.uniform(0, 2 * np.pi, (len(ks), S.shape[1]))
        new = S.copy()
        new[ks] = target * np.exp(1j * phase)
        out.append(istft(new, n_fft, hop, len(ch)))
    return np.stack(out), [(0.0, round(y.shape[1] / fs, 3), "inferred", 0.3)], {"fc_hz": fc}


def decodec(y, fs, lo_hz=4000.0, n_fft=2048, hop=256, seed=0, hole_db=-30.0):
    rng = np.random.default_rng(seed)
    y = np.atleast_2d(np.asarray(y, np.float64))
    f = np.fft.rfftfreq(n_fft, 1 / fs)
    band = f >= lo_hz
    out, filled = [], 0
    for ch in y:
        S = stft(ch, n_fft, hop)
        mag = np.abs(S)
        med = medfilt(mag, 5, 1).astype(np.float64)
        hole = band[:, None] & (mag < med * 10 ** (hole_db / 20)) & (med > 1e-6)
        filled += int(hole.sum())
        S = np.where(hole, med * np.exp(1j * rng.uniform(0, 2 * np.pi, S.shape)), S)
        hb = (np.abs(S[band]) ** 2).sum(0)
        lb = (np.abs(S[~band]) ** 2).sum(0)
        onset = np.flatnonzero(np.diff(np.log(lb + 1e-12)) > np.log(8.0)) + 1
        pre = int(round(0.025 * fs / hop))
        scale = np.ones(S.shape[1])
        for o in onset:                                  # onsets are few; each touches `pre` frames
            a = max(0, o - pre - 4)
            floor = np.median(hb[a:max(a + 1, o - pre)])
            t = np.arange(max(0, o - pre), o)
            over = hb[t] > 2 * floor
            scale[t[over]] = np.minimum(scale[t[over]], np.sqrt(floor / hb[t[over]]))
        S[band] *= scale[None, :]
        out.append(istft(S, n_fft, hop, len(ch)))
    return np.stack(out), [(0.0, round(y.shape[1] / fs, 3), "restored", 0.4)], {"holes_filled": filled}
