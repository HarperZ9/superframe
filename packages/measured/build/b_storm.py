# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Spectra of three storm field recordings (ocean storm, howling wind in spruce, rain and thunder).

Each 180 s recording is decoded to 16 kHz mono with the ffmpeg that imageio-ffmpeg ships, and its power
spectral density estimated by Welch's method (8192-sample Hann segments, half overlap). The slope beta is
minus the least-squares slope of log10 PSD against log10 f over 100 Hz to 4 kHz, so PSD ~ f^-beta there. Band
fractions are the share of power in five bands, and the peaks are the strongest local maxima above 50 Hz.
These statistics are facts about the recordings; the recordings themselves are local research copies with no
stated licence and are never redistributed.

    MEASURED_REFS=<root> python -I packages/measured/build/b_storm.py
"""
import subprocess
import sys
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.signal import find_peaks, welch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

FS = 16000
CLIPS = [("ocean_storm", "hwsEjtlr9yw.audio-0-180.m4a"), ("howling_wind_spruce", "sT5f1jBJHng.audio-15-195.m4a"),
         ("rain_thunder", "y4h_4NIOxuY.audio-0-180.m4a")]
BANDS = [(0, 100), (100, 500), (500, 2000), (2000, 8000)]


def decode(path):
    cmd = [imageio_ffmpeg.get_ffmpeg_exe(), "-v", "error", "-i", str(path), "-ac", "1", "-ar", str(FS), "-f", "f32le", "-"]
    return np.frombuffer(subprocess.run(cmd, capture_output=True, check=True).stdout, "<f4").astype(float)


def spectrum_stats(x, fs=FS):
    """Slope beta over 100 Hz to 4 kHz, band fractions and the five strongest peaks above 50 Hz."""
    f, p = welch(x, fs, nperseg=8192)
    fit = (f >= 100) & (f <= 4000)
    beta = -float(np.polyfit(np.log10(f[fit]), np.log10(p[fit]), 1)[0])
    total = np.trapezoid(p, f)
    bands = {f"{lo}-{hi}": round(float(np.trapezoid(p[(f >= lo) & (f < hi)], f[(f >= lo) & (f < hi)]) / total), 4)
             for lo, hi in BANDS}
    pk, _ = find_peaks(np.log10(p + 1e-30), prominence=0.3)
    pk = [i for i in pk if f[i] > 50]
    top = sorted(pk, key=lambda i: -p[i])[:5]
    return {"beta": round(beta, 3), "band_fraction": bands, "peaks_hz": [round(float(f[i]), 1) for i in top]}


def main():
    rows = []
    for name, clip in CLIPS:
        sha = prov.verify("storm-saves", clip)
        stats = spectrum_stats(decode(prov.RAW / "storm-saves" / clip))
        rows.append({"id": f"storm.{name}", "file": clip, "sha256": sha, "source": "storm-saves", "status": "measured",
                     "seconds": 180, **stats})
        print(name, stats["beta"], stats["peaks_hz"], flush=True)
    write("storm_spectra", {"provenance": {
        "method": "ffmpeg decode to 16 kHz mono; Welch PSD, 8192-sample Hann, half overlap; slope fit 100 Hz to 4 kHz",
        "citation": prov.SOURCES["storm-saves"][0], "licence": prov.SOURCES["storm-saves"][1],
        "files": {c: prov.verify("storm-saves", c) for _, c in CLIPS}}, "rows": rows})


if __name__ == "__main__":
    main()
