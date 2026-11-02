# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""One call per text: every order parameter, and the phase reading the rule below gives.

Phase rule (fixed before the study ran; the same rule reads every carrier):
  gas       fewer than min_pts distances where I(d) clears the shuffle floor;
  crystal   periodicity peak >= 0.5, or the best decay model is flat;
  critical  best model is power;
  liquid    best model is exp (one scale). The choice is among flat, power and exp only (fits.py).
"""
import numpy as np

from . import entropy, fits, mi, periodicity


def read_phase(fit, per_peak, crystal_peak=0.5):
    if per_peak is not None and per_peak >= crystal_peak:
        return "crystal"
    if not fit.get("testable"):
        return "gas"
    return {"flat": "crystal", "power": "critical", "exp": "liquid"}[fit["best"]]


def decay(seq, ds, rng, k=None, n_shuffle=5, z=3.0):
    """I(d), its shuffle floor, the floor-subtracted points above it, and the model fits."""
    m = mi.mi_curve(seq, ds, k)
    fm, fs = mi.floor(seq, ds, rng, n_shuffle, k)
    keep = mi.above_floor(ds, m, fm, fs, z)
    idx = np.searchsorted(ds, keep)
    y = (m - fm)[idx]
    fit = fits.fit_all(keep, y)
    return {"ds": [int(d) for d in ds], "mi": m.tolist(), "floor": fm.tolist(), "floor_sd": fs.tolist(),
            "range": int(keep.max()) if len(keep) else 0, "fit": fit,
            "corr_length": fits.corr_length(keep, y) if len(keep) else 0.0}


def profile(seq, alphabet, rng, ds=None, ppm_order=4, win=1000, n_shuffle=5):
    """All order parameters of one symbol stream (character level by default)."""
    ds = mi.log_grid(1000) if ds is None else ds
    rate, cl = entropy.ppm_rate(seq, alphabet, ppm_order)
    dec = decay(seq, ds, rng, alphabet, n_shuffle)
    per = periodicity.periodicity(seq, 2000)
    return {"n": int(len(seq)), "h_ppm": rate, "h_lz": entropy.lz_rate(seq),
            "h_block": entropy.block_rate(seq)[0], "chi": entropy.susceptibility(cl[int(.2 * len(cl)):], win),
            "repeat_share": periodicity.repeat_share(seq, 20), "periodicity": per, "decay": dec,
            "phase": read_phase(dec["fit"], per["peak"])}
