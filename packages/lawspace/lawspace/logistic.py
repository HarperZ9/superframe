# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A known bifurcation for the wall finder's anchor: the logistic map x -> r x (1 - x).

The fixed point 1 - 1/r loses stability at r = 3, where the first period doubling occurs."""
import numpy as np


def period_above_one(r, transient=200000, tol=1e-5, x0=0.3):
    x = x0
    for _ in range(transient):
        x = r * x * (1 - x)
    return abs(r * x * (1 - x) - x) > tol
