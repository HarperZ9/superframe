# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Measured resonances of 3D-printed vocal tracts made from MRI (the Dresden Vocal Tract Dataset).

Birkholz et al. 2020 printed the vocal tracts of 22 German speech sounds of two speakers from MRI and
measured each model's volume-velocity transfer function with a sweep (files *-vvtf-measured.txt), and also
computed it by finite elements (*-vvtf-calculated.txt). The first four peaks of each curve below 5 kHz are
read here, after a 15-bin running mean, with 6 dB prominence. These are resonances of rigid-walled printed
models in air at 22 C, not of the speakers themselves.

    MEASURED_REFS=<root> python -I packages/measured/build/b_dresden.py
"""
import re
import sys
import zipfile
from pathlib import Path

import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import find_peaks

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

ZIP = "dvtd.zip"


def peaks(z, member):
    d = np.loadtxt(z.open(member), comments=("#", "freq"))
    f, m = d[:, 0], 20 * np.log10(d[:, 1] + 1e-12)
    m = np.where((f > 100) & (f < 5000), uniform_filter1d(m, 15), -200.0)
    p, _ = find_peaks(m, prominence=6, distance=100)
    return [round(float(x), 1) for x in f[p][:4]]


def main():
    sha = prov.verify("dresden-vtd", ZIP)
    z = zipfile.ZipFile(prov.RAW / "dresden-vtd" / ZIP)
    names = sorted(n[:-len("-vvtf-measured.txt")] for n in z.namelist() if n.endswith("-vvtf-measured.txt"))
    rows = []
    for n in names:
        model = n.rsplit("/", 1)[-1]
        m = re.match(r"s(\d)-(\d+)-(\w+?)-(.*)$", model)
        rows.append({"id": f"dvtd.{model}", "speaker": int(m.group(1)), "sound": m.group(4),
                     "measured_hz": peaks(z, n + "-vvtf-measured.txt"),
                     "calculated_hz": peaks(z, n + "-vvtf-calculated.txt"),
                     "source": "dresden-vtd", "file": f"{ZIP}:{n}-vvtf-measured.txt", "sha256": sha, "status": "measured"})
    write("vocal_tracts_dvtd", {"provenance": {
        "method": "first four peaks of the measured and FEM-calculated volume-velocity transfer functions",
        "citation": prov.SOURCES["dresden-vtd"][0], "licence": prov.SOURCES["dresden-vtd"][1],
        "files": {ZIP: sha}, "conditions": "rigid 3D-printed models, air at 22 C"}, "rows": rows})


if __name__ == "__main__":
    main()
