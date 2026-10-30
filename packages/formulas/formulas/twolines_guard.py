# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Two-lines U test (Simonsohn 2018) with a variance-floor guard.

The base test is the goldilocks unit used by F49, vendored verbatim in formulas/units/twolines.py and
hash-checked by the tests. The guard fixes one false U: when y has no variance on one side of the
breakpoint (a fall to an exact floor), that side's slope is rounding noise with a standard error of 0,
the base code gives z = +-1e9, and an opposite-sign "significant" line appears. A guarded side counts as
significant only if its standard error is positive and sd(y on that side) > tau * sd(y).

Source: formula round 1 (2026-10-29), candidate C3. tau was chosen on development datasets; see README.
"""
import numpy as np

from .units import twolines as TL

TAU = 0.0  # round 1 chose tau 0 on development data: the zero-SE fix alone removed every floor false U


def two_lines_guarded(x, y, tau=None, alpha=0.05, covars=None):
    """The base two_lines result with the guard applied to its Robin Hood regression.

    Returns the base dict with u, robin_hood (z1, p1, z2, p2 after the guard) and guard={tau, guarded_sides}.
    """
    tau = TAU if tau is None else float(tau)
    out = TL.two_lines(x, y, covars=covars, alpha=alpha)
    if not out.get("testable"):
        return out
    r = dict(out["robin_hood"])
    x, y = np.asarray(x, float), np.asarray(y, float)
    sd = float(np.std(y))
    guarded = []
    for side, mask, key in (("1", x <= r["xc"], "z1"), ("2", x >= r["xc"], "z2")):
        sd_side = float(np.std(y[mask])) if mask.sum() > 1 else 0.0
        if abs(r[key]) >= 1e9 or sd_side <= tau * sd:
            r[key], r["p" + side] = 0.0, 1.0
            guarded.append(int(side))
    opposite = (r["b1"] > 0 > r["b2"]) or (r["b1"] < 0 < r["b2"])
    return dict(out, robin_hood=r, u=bool(opposite and r["p1"] < alpha and r["p2"] < alpha),
                guard={"tau": tau, "guarded_sides": guarded})
