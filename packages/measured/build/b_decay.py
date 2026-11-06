# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Loss factors measured from the decay of recorded bars (University of Iowa Musical Instrument Samples).

The MIS recordings (Lawrence Fritts, University of Iowa; "may be downloaded and used for any projects,
without restrictions") hold each bar struck once and left to ring. For every note the strongest partials
below 5 kHz are tracked in a short-time Fourier transform, and a straight line is fitted to their level in dB
from 3 dB below the peak down to 40 dB below it (or 10 dB above the noise floor). The slope gives the decay
rate alpha (1/s) and the loss factor eta = alpha / (pi f). A mounted bar also loses energy to its cords,
its resonator and the air, so eta here is an upper bound on the material's own loss.
Vibraphone bars are aluminium; orchestral bells are steel bars (both from general knowledge of the
instruments, moderate confidence; the MIS pages name the instrument, not the alloy).

    MEASURED_REFS=<root> python -I packages/measured/build/b_decay.py
"""
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from scipy.signal import find_peaks, stft

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

RECORDINGS = [("aluminium", "Vibraphone.sustain.mf.C4B4.aif"), ("steel_mild", "bells.plastic.mf.C6B6.aif")]
WIN, HOP = 8192, 2048


def onsets(x, fs):
    """Note starts: a jump of more than 15 dB between 50 ms frames, at least 3 s after the last start."""
    step = fs // 20
    e = np.sqrt(np.convolve(x ** 2, np.ones(step) / step, "same"))[::step]
    db = 20 * np.log10(e + 1e-12)
    idx = (np.flatnonzero(db[1:] - db[:-1] > 15) + 1) * step
    out = []
    for i in idx:
        if not out or i - out[-1] > 3 * fs:
            out.append(int(i))
    return out


def track(level, t, floor):
    """Decay slope in dB/s over the clean part of one partial's level track, with its point count."""
    i0, top = int(np.argmax(level)), level.max()
    sel = (np.arange(len(level)) > i0 + 2) & (level < top - 3) & (level > max(floor, top - 40))
    if sel.sum() < 30:
        return None, 0
    return float(np.polyfit(t[sel], level[sel], 1)[0]), int(sel.sum())


def note_rows(seg, fs, material, k):
    f, t, Z = stft(seg, fs, nperseg=WIN, noverlap=WIN - HOP)
    A = 20 * np.log10(np.abs(Z) + 1e-12)
    ref = A[:, 2:6].max(1)
    peaks, _ = find_peaks(ref, distance=20, prominence=20)
    peaks = [p for p in peaks if f[p] < 5000][:4]
    floor = np.median(A[:, -5:]) + 10
    rows = []
    for p in peaks:
        slope, n = track(A[p], t, floor)
        if slope is None or slope >= -0.4:          # rising or flat tracks are noise lines, not decays
            continue
        alpha = -slope * np.log(10) / 20
        rows.append({"material": material, "note": k, "f_hz": round(float(f[p]), 1), "alpha": round(alpha, 4),
                     "eta": float(f"{alpha / (np.pi * f[p]):.3e}"), "points": n})
    return rows


def measure(material, name):
    x, fs = sf.read(str(prov.RAW / "iowa-mis" / name))
    x = x.mean(1) if x.ndim > 1 else x
    starts = onsets(x, fs)
    rows = []
    for k, i in enumerate(starts):
        end = starts[k + 1] if k + 1 < len(starts) else len(x)
        rows += note_rows(x[i:end], fs, material, k)
    return rows


def summary(rows, material, name):
    eta = np.array([r["eta"] for r in rows if r["material"] == material])
    q1, med, q3 = np.percentile(eta, [25, 50, 75])
    return {"id": f"{material}.eta_measured", "value": float(f"{med:.3e}"), "unit": "1", "source": "iowa-mis",
            "file": name, "sha256": prov.verify("iowa-mis", name), "status": "measured",
            "iqr": [float(f"{q1:.3e}"), float(f"{q3:.3e}")], "n": int(len(eta)),
            "note": "median loss factor of decaying partials below 5 kHz; mounted bars, so an upper bound on material loss"}


def main():
    tracks, rows = [], []
    for material, name in RECORDINGS:
        t = measure(material, name)
        tracks += t
        rows.append(summary(t, material, name))
    write("decay_iowa", {"provenance": {
        "method": "STFT partial tracks, linear fit of dB against time, eta = alpha / (pi f)",
        "citation": prov.SOURCES["iowa-mis"][0], "licence": prov.SOURCES["iowa-mis"][1],
        "files": {n: prov.verify("iowa-mis", n) for _, n in RECORDINGS}}, "rows": rows, "tracks": tracks})


if __name__ == "__main__":
    main()
