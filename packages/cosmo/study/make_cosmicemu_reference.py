# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Write data/cosmicemu_reference.json: the Mira-Titan IV Cosmic Emu P(k) for the default cosmology.

The Cosmic Emu (Moran et al. 2023, MNRAS 520, 3443; github.com/lanl/CosmicEmu, 2022-Mira-Titan-IV/P_tot)
is a Gaussian-process emulator trained on 111 simulations of (2.1 Gpc)^3 with 3200^3 particles. Its
authors quote two to three percent accuracy. This script is a numpy transcription of the emulator's
emu.c (emuInit and emu): it reads the published params.h as data and runs nothing from the download.
The emulator's copyright notice and licence travel with this file in COSMICEMU-LICENSE.txt.

    python packages/cosmo/study/make_cosmicemu_reference.py <path to 2022-Mira-Titan-IV P_tot params.h>

Inputs follow the emulator: omega_m h^2, omega_b h^2, sigma8, h, n_s, w0, wa, omega_nu h^2, z.
The output is converted to k in h/Mpc and P in (Mpc/h)^3.
"""
import json
import re
import sys
from pathlib import Path

import numpy as np
from scipy.interpolate import CubicSpline

HERE = Path(__file__).resolve()
sys.path.insert(0, str(HERE.parents[1]))
from cosmolab.background import Cosmology  # noqa: E402

ARRAYS = ("x", "xmin", "xrange", "xmax", "z", "z_asc", "mode", "K", "w", "mean", "beta", "lamws", "lamz")


def read_params(path):
    """Every `static double name[..] = {...};` array in params.h, as float arrays, plus sd."""
    text = Path(path).read_text()
    out = {}
    for m in re.finditer(r"static double (\w+)((?:\[\d+\])*)\s*=\s*(\{[^;]*\}|[-+0-9.eE]+);", text):
        name, dims, body = m.group(1), m.group(2), m.group(3)
        vals = np.array([float(v) for v in re.findall(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", body)])
        shape = tuple(int(d) for d in re.findall(r"\d+", dims))
        out[name] = vals.reshape(shape) if shape else float(vals[0])
    missing = [a for a in ARRAYS + ("sd",) if a not in out]
    if missing:
        raise ValueError(f"params.h lacks {missing}")
    return out


class CosmicEmu:
    """Transcription of emu.c: kriging basis per principal component, then a natural cubic spline in z."""

    def __init__(self, params):
        self.p = params
        x, beta, lamz, lamws, w = (params[k] for k in ("x", "beta", "lamz", "lamws", "w"))
        d2 = (x[:, None, :] - x[None, :, :]) ** 2                     # (m, m, p)
        self.krig = np.empty_like(w)
        for i in range(len(lamz)):
            sig = np.exp(-(d2 @ beta[i])) / lamz[i]
            np.fill_diagonal(sig, 1.0 / lamz[i] + 1.0 / lamws[i])
            self.krig[i] = np.linalg.solve(sig, w[i])           # Cholesky in emu.c; same solution, SPD

    def __call__(self, omega_m, omega_b, sigma8, h, n_s, w0, wa, omega_nu, zz):
        p = self.p
        xs = np.array([omega_m, omega_b, sigma8, h, n_s, w0, (-w0 - wa) ** 0.25, omega_nu])
        if np.any(xs < p["xmin"]) or np.any(xs > p["xmax"]):
            raise ValueError(f"parameters outside the emulator's range: {xs} not in [{p['xmin']}, {p['xmax']}]")
        if not p["z"][-1] <= zz <= p["z"][0]:
            raise ValueError("z outside the emulator's range")
        xstd = (xs - p["xmin"]) / p["xrange"]
        sig_star = np.exp(-(((p["x"] - xstd) ** 2) @ p["beta"].T).T) / p["lamz"][:, None]   # (peta, m)
        wstar = np.sum(sig_star * self.krig, axis=1)
        y = (p["K"] @ wstar) * p["sd"] + p["mean"]
        nmode, rs = len(p["mode"]), len(p["z"])
        y = y.reshape(rs, nmode)                                  # rows follow z in descending order
        match = np.nonzero(p["z"] == zz)[0]
        if len(match):
            ys = y[match[0]]
        else:
            ys = CubicSpline(p["z_asc"], y[::-1], axis=0, bc_type="natural")(zz)
        logp = ys - 1.5 * np.log10(p["mode"]) + np.log10(2.0) + 2 * np.log10(np.pi)
        return p["mode"].copy(), 10.0 ** logp                     # k in 1/Mpc, P in Mpc^3


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    c = Cosmology()
    emu = CosmicEmu(read_params(sys.argv[1]))
    h2 = c.h ** 2
    out = {"generator": "Mira-Titan IV Cosmic Emu (P_tot), numpy transcription of emu.c, massless neutrinos",
           "cosmology": c.__dict__, "quoted_accuracy": "two to three percent (Moran et al. 2023)",
           "k": None, "pk": {}}
    for zz in (0.0, 0.5, 1.0):
        k, pk = emu(c.omega_m * h2, c.omega_b * h2, c.sigma8, c.h, c.n_s, -1.0, 0.0, 0.0, zz)
        out["k"] = [float(v) for v in k / c.h]
        out["pk"][f"{zz:g}"] = [float(v) for v in pk * c.h ** 3]
    dest = HERE.parents[1] / "data" / "cosmicemu_reference.json"
    dest.write_text(json.dumps(out, indent=1))
    print("wrote", dest.name, len(out["k"]), "k values")


if __name__ == "__main__":
    main()
