# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Piano string inharmonicity B per note, measured from recordings of a Steinway model B.

Source: the University of Iowa Musical Instrument Samples, piano mf set (Steinway & Sons model B, recorded
2001; "may be downloaded and used for any projects, without restrictions"). One file per note.

Method (the partial-frequency fit used by Galembo and Askenfelt and by Rauhala and Valimaki): a stiff string's
partials sit at f_n = n f0 sqrt(1 + B n^2), so (f_n / n)^2 = f0^2 + f0^2 B n^2 is a straight line in n^2,
and B is its slope over its intercept. For each note:

1. Find the attack (the largest jump in 20 ms energy), skip 50 ms of hammer noise, and take a window of up to
   1.5 s (shorter in the treble, where notes die fast), Hann-weighted, zero-padded to 2^20 points.
2. Walk up the partials: predict f_n from the fit so far (starting from the nominal equal-tempered f0 and
   B = 1e-4), take the strongest peak within a quarter of a partial spacing, refine it by a parabola on the
   log magnitude, and keep it if it stands 20 dB over the local median floor. After every 4 kept partials
   the line is refitted.
3. Fit the line by least squares on all kept partials; report B, f0, the partial count and the RMS residual
   in cents. A note with fewer than 3 kept partials, or a residual over 3 cents, is flagged quality "poor" and kept
   in the table with the flag, not dropped (status "missing" where no B could be fitted).

Unison strings, two polarisations and soundboard coupling split each partial into a cluster; the strongest
peak of the cluster is taken. B is therefore the B of the dominant string of the unison.

    MEASURED_REFS=<root> python -I packages/measured/build/b_piano_b.py
"""
import math
import re
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

SOURCE = "iowa-mis-piano"
NAMES = {"C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5, "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11}
NFFT = 1 << 20


def midi_of(name):
    m = re.match(r"Piano\.mf\.([A-G]b?)(\d)\.aiff$", name)
    return 12 * (int(m.group(2)) + 1) + NAMES[m.group(1)]


def segment(x, fs, midi):
    step = int(0.02 * fs)
    e = np.sqrt(np.convolve(x ** 2, np.ones(step) / step, "same"))[::step]
    db = 20 * np.log10(e + 1e-12)
    start = (int(np.argmax(db[1:] - db[:-1])) + 1) * step + int(0.05 * fs)
    seconds = 1.5 if midi < 72 else max(0.25, 1.5 - (midi - 72) * 0.05)
    return x[start:start + int(seconds * fs)]


def fit(ns, fs_):
    n2 = np.asarray(ns, float) ** 2
    y = (np.asarray(fs_) / np.asarray(ns)) ** 2
    slope, icept = np.polyfit(n2, y, 1)
    f0 = math.sqrt(icept)
    b = slope / icept
    pred = np.asarray(ns) * f0 * np.sqrt(1 + b * n2)
    resid = 1200 * np.log2(np.asarray(fs_) / pred)
    return f0, b, float(np.sqrt(np.mean(resid ** 2)))


def measure(x, fs, midi, fmax=None):
    seg = segment(x, fs, midi)
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)), NFFT))
    mag = 20 * np.log10(spec + 1e-12)
    df = fs / NFFT
    fmax = fmax or min(0.45 * fs, 9000.0 if midi < 60 else 16000.0)
    f0, b = 440.0 * 2 ** ((midi - 69) / 12), 1e-4
    ns, fk = [], []
    n = 1
    while True:
        f_pred = n * f0 * math.sqrt(1 + b * n * n)
        if f_pred > fmax or n > 60:
            break
        half = 0.25 * f0
        lo, hi = int((f_pred - half) / df), int((f_pred + half) / df)
        k = lo + int(np.argmax(spec[lo:hi]))
        floor = np.median(mag[max(0, k - int(2 * f0 / df)):k + int(2 * f0 / df)])
        if mag[k] - floor > 20 and 0 < k < len(mag) - 1:
            a, c, d = mag[k - 1], mag[k], mag[k + 1]
            off = 0.5 * (a - d) / (a - 2 * c + d) if (a - 2 * c + d) != 0 else 0.0
            ns.append(n)
            fk.append((k + off) * df)
            if len(ns) >= 4 and len(ns) % 4 == 0:
                f0, b, _ = fit(ns, fk)
                b = max(b, 1e-6)
        n += 1
    if len(ns) < 3:
        return {"id": f"piano_b.{midi}", "midi": midi, "status": "missing", "quality": "poor", "partials": len(ns),
                "B": None, "f0": None, "rms_cents": None}
    f0, b, rms = fit(ns, fk)
    return {"id": f"piano_b.{midi}", "midi": midi, "status": "measured", "quality": "poor" if rms > 3.0 else "good",
            "partials": len(ns),
            "B": float(f"{b:.4g}"), "f0": round(f0, 4), "rms_cents": round(rms, 3), "max_partial": int(max(ns))}


def main():
    root = prov.RAW / SOURCE
    names = sorted(p.name for p in root.glob("Piano.mf.*.aiff"))
    excluded = {n: "above the keyboard (C8 is MIDI 108); content not identified" for n in names if midi_of(n) > 108}
    names = [n for n in names if n not in excluded]
    rows, files = [], {}
    for name in sorted(names, key=midi_of):
        files[name] = prov.verify(SOURCE, name)
        x, fs = sf.read(str(root / name), always_2d=True)
        row = measure(x.mean(axis=1), fs, midi_of(name))
        row.update({"file": name, "sha256": files[name]})
        rows.append(row)
        print(name, row["quality"], row["B"], row["partials"], row["rms_cents"])
    write("piano_b_iowa", {"provenance": {
        "method": "partial-frequency fit (f_n / n)^2 = f0^2 (1 + B n^2), least squares over the kept partials",
        "instrument": "Steinway & Sons model B, University of Iowa MIS piano, mf, recorded 2001",
        "citation": prov.SOURCES[SOURCE][0], "licence": prov.SOURCES[SOURCE][1], "files": files,
        "excluded": excluded}, "rows": rows})


if __name__ == "__main__":
    main()
