# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Audio features (spectrum, onsets, tempo, loudness) and a band-energy fingerprint.

Features follow textbook definitions: spectral centroid, bandwidth, 85% rolloff and flatness per
frame; spectral flux as onset strength with a median-threshold peak picker; tempo as the strongest
autocorrelation lag of the onset envelope between 60 and 200 BPM; loudness as RMS in dBFS (not
LUFS, no K-weighting). The fingerprint follows Haitsma and Kalker (2002, from memory, moderate
confidence on the venue): 33 log-spaced bands, 32 bits per frame from the signs of the time and
band differences of band energy.
"""
import numpy as np

N_FFT, HOP = 2048, 512
FP_SR, FP_N, FP_HOP, FP_BANDS = 5512, 2048, 64, 33


def stft_mag(x, n=N_FFT, hop=HOP):
    if len(x) < n:
        x = np.pad(x, (0, n - len(x)))
    k = 1 + (len(x) - n) // hop
    idx = np.arange(n)[None, :] + hop * np.arange(k)[:, None]
    return np.abs(np.fft.rfft(x[idx] * np.hanning(n), axis=1))


def features(x, sr):
    if len(x) < sr * 0.5:
        return {"has_audio": False, "seconds": round(len(x) / sr, 3)}
    S = stft_mag(x)
    f = np.fft.rfftfreq(N_FFT, 1 / sr)
    P = S ** 2
    tot = P.sum(1) + 1e-12
    cen = (P * f).sum(1) / tot
    bw = np.sqrt((P * (f[None] - cen[:, None]) ** 2).sum(1) / tot)
    roll = f[np.argmax(np.cumsum(P, 1) >= 0.85 * tot[:, None], axis=1)]
    flat = np.exp(np.log(S + 1e-10).mean(1)) / (S.mean(1) + 1e-10)
    rms = np.sqrt((x ** 2).mean())
    frms = np.sqrt(P.mean(1) / N_FFT)
    flux = np.maximum(0, np.diff(np.log1p(S), axis=0)).sum(1)
    thr = np.convolve(flux, np.ones(17) / 17, "same") + 0.5 * flux.std()
    peaks = np.where((flux[1:-1] > flux[:-2]) & (flux[1:-1] >= flux[2:]) & (flux[1:-1] > thr[1:-1]))[0] + 1
    fps = sr / HOP
    tempo, strength = _tempo(flux, fps)
    chroma = _chroma(P, f)
    bands = np.array_split(np.log1p(S.mean(0)), 16)
    return {
        "has_audio": True, "seconds": round(len(x) / sr, 3), "sample_rate": sr,
        "loudness_rms_dbfs": round(20 * np.log10(rms + 1e-12), 2),
        "loudness_range_db": round(float(np.subtract(*np.percentile(20 * np.log10(frms + 1e-12), [95, 10]))), 2),
        "spectral_centroid_hz": round(float(np.median(cen)), 1),
        "spectral_bandwidth_hz": round(float(np.median(bw)), 1),
        "spectral_rolloff85_hz": round(float(np.median(roll)), 1),
        "spectral_flatness": round(float(np.median(flat)), 4),
        "onsets": int(len(peaks)), "onset_rate_per_s": round(len(peaks) / (len(x) / sr), 3),
        "tempo_bpm": tempo, "tempo_strength": strength,
        "pitch_class_profile": [round(float(v), 4) for v in chroma],
        "spectrum_16_bands_log": [round(float(b.mean()), 4) for b in bands],
    }


def _tempo(env, fps):
    e = env - env.mean()
    if len(e) < 8 or not e.any():
        return None, 0.0
    ac = np.correlate(e, e, "full")[len(e) - 1:]
    ac = ac / (ac[0] + 1e-12)
    lo, hi = int(fps * 60 / 200), int(fps * 60 / 60)
    if hi >= len(ac) or lo < 1:
        return None, 0.0
    lag = lo + int(np.argmax(ac[lo:hi]))
    return round(60 * fps / lag, 1), round(float(ac[lag]), 3)


def _chroma(P, f):
    ok = (f > 55) & (f < 4000)
    pc = np.round(12 * np.log2(f[ok] / 440.0)).astype(int) % 12
    c = np.bincount(pc, weights=P[:, ok].sum(0), minlength=12)
    return c / (c.sum() + 1e-12)


# -- fingerprint -----------------------------------------------------------------
def resample(x, sr, to=FP_SR):
    if sr == to or len(x) == 0:
        return x
    n = int(len(x) * to / sr)
    return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)


def fingerprint(x, sr):
    """uint32 per frame at FP_SR / FP_HOP frames per second (about 86 per second)."""
    y = resample(x, sr)
    if len(y) < FP_N * 2:
        return np.zeros(0, np.uint32)
    S = stft_mag(y, FP_N, FP_HOP) ** 2
    f = np.fft.rfftfreq(FP_N, 1 / FP_SR)
    edges = np.geomspace(300, 2000, FP_BANDS + 1)
    E = np.stack([S[:, (f >= a) & (f < b)].sum(1) for a, b in zip(edges[:-1], edges[1:])], 1)
    d = np.diff(E, axis=1)
    bits = (d[1:] - d[:-1]) > 0
    w = (1 << np.arange(32, dtype=np.uint64)).astype(np.uint64)
    return (bits.astype(np.uint64) * w).sum(1).astype(np.uint32)


def _popcount(a):
    a = a.astype(np.uint64)
    c = np.zeros(a.shape, np.uint64)
    while a.any():
        c += a & np.uint64(1)
        a >>= np.uint64(1)
    return c


def longest_match_seconds(fa, fb, block=32, ber_max=0.35):
    """Longest run, in seconds of fa, that matches some aligned stretch of fb.

    Candidate offsets come from exact sub-fingerprint hits (the Haitsma-Kalker lookup). At each
    candidate the bit error rate is computed over a sliding block; a frame counts as matched when
    its block's error rate is below ber_max.
    """
    if len(fa) < block or len(fb) < block:
        return 0.0
    pos = {}
    for j, v in enumerate(fb.tolist()):
        if v:
            pos.setdefault(v, []).append(j)
    votes = {}
    for i, v in enumerate(fa.tolist()):
        for j in pos.get(v, ())[:50]:
            votes[j - i] = votes.get(j - i, 0) + 1
    best = 0
    for off, _ in sorted(votes.items(), key=lambda t: -t[1])[:40]:
        i0, i1 = max(0, -off), min(len(fa), len(fb) - off)
        if i1 - i0 < block:
            continue
        err = _popcount(fa[i0:i1] ^ fb[i0 + off:i1 + off]).astype(float)
        ber = np.convolve(err, np.ones(block) / (32 * block), "valid")
        ok = np.concatenate([[False], ber < ber_max, [False]])
        if ok.any():
            edges = np.flatnonzero(np.diff(ok.astype(int)))
            best = max(best, int((edges[1::2] - edges[::2]).max()) + block - 1)
    return round(best * FP_HOP / FP_SR, 3)
