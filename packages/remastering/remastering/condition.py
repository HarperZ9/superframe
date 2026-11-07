# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Source condition: what the file says about itself and what its audio shows about its history.

Measured from the audio (each an inference, stated with the evidence):
- lowpass cutoff: the highest frequency where the smoothed long-term spectrum is within 30 dB of its 1 to 4 kHz
  level, and how steep the fall above it is (dB over 500 Hz). A brick wall under 20 kHz marks a lossy encoder or a
  low-rate source; typical cutoffs: mp3 128 kb/s about 16 kHz, 192 kb/s about 19 kHz, aac 128 kb/s 15 to 17 kHz.
- clipping: share of samples at or above 99.5% of the peak in runs of 2 or more.
- resampling: content that stops at the Nyquist of a lower standard rate (11.025, 16, 22.05, 24 kHz) inside a
  higher-rate container.
- transcode chain: the container's codec next to a cutoff that belongs to another codec or bitrate (for example
  aac at 256 kb/s whose content stops at 16 kHz suggests an mp3 at 128 kb/s before it).
- holes: share of high-band (above 8 kHz) time-frequency bins more than 40 dB under their 9-frame median while the
  neighbours are active, the "swirly" signature of lossy quantisation.
- dropouts: runs of exact digital zeros longer than 5 ms inside the programme; clicks per minute (AR residual).
"""
import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import welch

from .kernels import medfilt
from .restore import ar
from .restore.repair import detect_clicks
from .stft import stft

STANDARD = [8000, 11025, 16000, 22050, 24000, 32000, 44100, 48000]


def cutoff(y, fs):
    m = np.atleast_2d(y).mean(0)
    f, p = welch(m, fs, nperseg=min(8192, len(m)))
    db = 10 * np.log10(np.maximum(p, 1e-30))
    db = uniform_filter1d(db, 9)
    ref = np.median(db[(f >= 1000) & (f <= 4000)])
    alive = np.flatnonzero(db > ref - 30)
    fc = float(f[alive[-1]]) if len(alive) else 0.0
    above = (f > fc) & (f <= fc + 500)
    steep = float(db[alive[-1]] - db[above].min()) if above.any() and len(alive) else 0.0
    return fc, steep


def clipping(y):
    y = np.atleast_2d(y)
    pk = np.abs(y).max()
    n = 0
    for ch in y:
        for s, e in ar.runs(np.abs(ch) >= 0.995 * pk):
            if e - s >= 2:
                n += e - s
    return n / y.size


def holes(y, fs):
    m = np.atleast_2d(y).mean(0)[: int(60 * fs)]
    S = np.abs(stft(m, 2048, 512))
    f = np.fft.rfftfreq(2048, 1 / fs)
    band = S[f > 8000]
    if band.size == 0:
        return 0.0
    med = medfilt(band, 9, 1)
    active = med > band.max() * 1e-4
    return float(((band < med * 0.01) & active).sum() / max(1, active.sum()))


def dropouts(y, fs, min_s=0.005):
    m = np.atleast_2d(y)
    z = (m == 0).all(0)
    out = []
    for s, e in ar.runs(z):
        if e - s >= min_s * fs and s > 0 and e < len(z):
            out.append((round(s / fs, 3), round(e / fs, 3)))
    return out


def report(y, fs, decode_report=None):
    fc, steep = cutoff(y, fs)
    probe = (decode_report or {}).get("probe", {})
    codec, kbps = probe.get("codec"), probe.get("bitrate_kbps")
    notes = []
    lossy = steep > 25 and fc < 0.95 * fs / 2 and fc < 20500
    if lossy:
        notes.append(f"brick-wall cutoff at {fc:.0f} Hz ({steep:.0f} dB in 500 Hz): lossy encoding or a low-rate source")
    resampled_from = None
    for r in STANDARD:
        if r < fs and abs(fc - r / 2) < 0.03 * r / 2 and steep > 25:
            resampled_from = r
            notes.append(f"content stops at {r / 2:.0f} Hz: likely resampled up from {r} Hz")
            break
    transcode = None
    if codec and lossy and kbps:
        expect = {"mp3": 16000 if kbps <= 128 else 19000, "aac": 15500 if kbps <= 128 else 18500}
        base = next((k for k in expect if codec.startswith(k)), None)
        if base and fc < expect[base] - 1500:
            transcode = f"{codec} at {kbps} kb/s carries a {fc:.0f} Hz cutoff, lower than that codec and rate leave: an earlier lower-rate encode is likely"
            notes.append(transcode)
    ch = detect_clicks(np.atleast_2d(y).mean(0)[: int(120 * fs)], k=8.0)
    clicks = len(ar.runs(ch)) / (min(len(ch), 120 * fs) / fs / 60)
    rec = {"probe": probe, "decode_errors": (decode_report or {}).get("errors"),
           "decoded_share": (decode_report or {}).get("decoded_share"), "rate": fs, "seconds": round(y.shape[1] / fs, 3),
           "cutoff_hz": round(fc, 1), "cutoff_steepness_db": round(steep, 1), "lossy_signature": bool(lossy),
           "resampled_from_hz": resampled_from, "transcode_note": transcode, "clipped_share": round(clipping(y), 6),
           "hole_share": round(holes(y, fs), 5), "dropouts": dropouts(y, fs), "clicks_per_min": round(clicks, 1),
           "notes": notes, "basis": "measured from the decoded audio; the history it names is inferred"}
    return rec
