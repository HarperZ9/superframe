# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Reference spectra read from data/: the Mira-Titan IV Cosmic Emu and CAMB, for scoring a box's P(k).

cosmicemu(k, z)        the emulator's nonlinear P(k), (Mpc/h)^3, k in h/Mpc, z in {0, 0.5, 1}
cosmicemu_boost(k, z)  the emulator's P(k) over CAMB's linear P(k) for the same cosmology (z in {0, 1});
                       multiply by a box's own linear input to compare when that input is a fit
bands(k, ratio, w)     mode-weighted mean, min and max of a ratio in the standard k bands
Both tables are written for the default Cosmology only (study/make_*_reference.py).
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

DATA = Path(__file__).resolve().parents[1] / "data"
BANDS = ((0.0, 0.1), (0.1, 0.3), (0.3, 0.5), (0.5, 1.0), (1.0, 2.0))


@lru_cache(maxsize=None)
def _table(name):
    return json.loads((DATA / name).read_text())


def _loglog(k, kt, pt):
    return np.exp(np.interp(np.log(k), np.log(kt), np.log(pt)))


def cosmicemu(k, z):
    t = _table("cosmicemu_reference.json")
    return _loglog(np.asarray(k, dtype=float), np.array(t["k"]), np.array(t["pk"][f"{z:g}"]))


def camb_linear(k, z):
    t = _table("camb_reference.json")
    return _loglog(np.asarray(k, dtype=float), np.array(t["k"]), np.array(t["linear"][f"{z:g}"]))


def cosmicemu_boost(k, z):
    return cosmicemu(k, z) / camb_linear(k, z)


def bands(k, ratio, weights, edges=BANDS):
    out = {}
    for lo, hi in edges:
        s = (k >= lo) & (k < hi)
        if s.any():
            out[f"{lo}-{hi}"] = {"mean_ratio": float(np.average(ratio[s], weights=weights[s])),
                                 "min": float(ratio[s].min()), "max": float(ratio[s].max()), "bins": int(s.sum())}
    return out
