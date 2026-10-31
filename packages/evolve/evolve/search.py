# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Random search control: the same number of real evaluations, no inheritance, no selection."""
import numpy as np

from . import info


def random_search(land, n_evals, target, rng, batch=50):
    best, best_g, E = -np.inf, None, None
    done = 0
    while done < n_evals:
        g = rng.integers(0, 2, (min(batch, n_evals - done), land.L)).astype(np.int8)
        f = land.lookup(g)
        i = int(np.argmax(f))
        if f[i] > best:
            best, best_g = float(f[i]), g[i]
        if E is None and best >= target:
            E = done + i + 1
        done += len(g)
    return {"hit": E is not None, "E": E if E is not None else n_evals, "best_phi": float(land.phi(best)),
            "global": land.is_global(best_g), "local": land.is_local_opt(best_g),
            "signal": {1: info.signal(best_g[None, :], land.opt)}}
