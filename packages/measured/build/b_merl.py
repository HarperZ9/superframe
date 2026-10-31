# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""GGX roughness fitted to the MERL 100 measured isotropic BRDFs (CC BY-SA 4.0).

File layout (from the database's own reader, BRDFRead.cpp, read as a specification, not run): three
int32 dimensions (90, 90, 180) for theta_half, theta_diff, phi_diff, then 3 x 1,458,000 doubles (R, G,
B blocks), scaled by 1/1500, 1.15/1500 and 1.66/1500. theta_half is stored on a square-root index:
bin i spans ((i/90)^2, ((i+1)/90)^2) x 90 deg; we use the bin centre in index space.

Fit, per material, on the luminance (Rec. 709 weights) of the retro-reflection slice theta_diff = 0,
where the light and view coincide with the half vector, so theta_i = theta_o = theta_h and Fresnel is
at normal incidence:
    f(theta_h) = kd + ks * D_GGX(theta_h; alpha) / (4 cos^2 theta_h),   G taken as 1
D_GGX = alpha^2 / (pi cos^4 (alpha^2 + tan^2)^2). alpha is scanned on a log grid; kd, ks by
non-negative least squares on log-weighted residuals; report the roughness r = sqrt(alpha).
This is a fit to measurement, so status "fitted"; the share-alike licence reaches this table.
"""
import math
import struct
import sys
import zipfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import prov, write  # noqa: E402

ZIP = "BRDFDatabase.zip"
SCALE = (1 / 1500, 1.15 / 1500, 1.66 / 1500)


def slice_td0(raw):
    d = struct.unpack("<3i", raw[:12])
    assert d == (90, 90, 180), d
    n = d[0] * d[1] * d[2]
    arr = np.frombuffer(raw, dtype="<f8", count=3 * n, offset=12).reshape(3, 90, 90, 180)
    rgb = np.stack([arr[c, :, 0, :].mean(axis=1) * SCALE[c] for c in range(3)])  # theta_d = 0, mean over phi_d
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def fit(f):
    th = ((np.arange(90) + 0.5) / 90) ** 2 * (math.pi / 2)
    ok = (f > 0) & (th < math.radians(80))
    th, f = th[ok], f[ok]
    c2 = np.cos(th) ** 2
    t2 = np.tan(th) ** 2
    best = None
    for a in np.exp(np.linspace(math.log(1e-3), math.log(1.0), 400)):
        a2 = a * a
        D = a2 / (math.pi * c2 * c2 * (a2 + t2) ** 2)
        basis = np.stack([np.ones_like(th), D / (4 * c2)], axis=1) / f[:, None]  # relative residuals
        coef, *_ = np.linalg.lstsq(basis, np.ones_like(f), rcond=None)
        coef = np.maximum(coef, 0)
        pred = coef[0] + coef[1] * D / (4 * c2)
        err = float(np.sqrt(np.mean(np.log(np.maximum(pred, 1e-12) / f) ** 2)))
        if best is None or err < best[0]:
            best = (err, a, coef)
    err, a, (kd, ks) = best
    return {"alpha": round(float(a), 4), "roughness": round(math.sqrt(a), 4), "kd": float(f"{kd:.4g}"),
            "ks": float(f"{ks:.4g}"), "rms_log_err": round(err, 3)}


def main():
    z = zipfile.ZipFile(prov.RAW / "merl-brdf" / ZIP)
    rows = []
    for n in sorted(x for x in z.namelist() if x.endswith(".binary")):
        r = fit(slice_td0(z.read(n)))
        r.update(material=n.rsplit("/", 1)[1][:-7], status="fitted")
        rows.append(r)
        print(r["material"], r["roughness"], r["rms_log_err"], flush=True)
    meta = prov.stamp("merl-brdf", [ZIP], status="fitted", method="GGX + Lambert fit on the theta_d = 0 slice, luminance",
                      limits="one slice, G = 1, no Fresnel variation; isotropic; a fit quality rms_log_err above 0.3 means GGX does not describe that material well")
    write("merl_ggx_fit", {"provenance": meta, "rows": rows})


if __name__ == "__main__":
    main()
