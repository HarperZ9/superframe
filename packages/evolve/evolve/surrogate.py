# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The forecaster: a ridge-regression surrogate fitted to past real evaluations.

Features are the genome's sites in +-1 coding plus an intercept: an additive model. It is right on
an additive landscape, partly right where epistasis is weak, and wrong on a deceptive trap, whose
additive trend points away from the optimum. That mismatch is the sim-to-real gap in small form.

Measured (F101 H3, 2026-10-29): this additive screen saved evaluations on the smooth landscape only
(edge +0.44) and cost them on every landscape with interactions (nk2 -0.57, nk4 -1.52, nk8 -0.57,
trap -0.49; hit rate nk4 0.97 to 0.55). Use it only on additive landscapes. A surrogate for epistatic
search needs interaction terms or a diversity-keeping screen (untested here). Under drift, forecast only a
drift whose calendar is known (H5c).

Memory: the most recent `window` evaluations; with `phase` set, only evaluations from the same
season (the forecaster knows the calendar of a predictable drift).
"""
import numpy as np


class Surrogate:
    def __init__(self, L, window=1000, lam=1.0, phase=False):
        self.L, self.window, self.lam, self.use_phase = L, int(window), float(lam), bool(phase)
        self.X, self.y, self.ph = [], [], []

    def add(self, genomes, f, phase=0):
        self.X.append(np.asarray(genomes, float))
        self.y.append(np.asarray(f, float))
        self.ph.append(np.full(len(f), phase))

    def _data(self, phase):
        X, y, ph = np.concatenate(self.X), np.concatenate(self.y), np.concatenate(self.ph)
        if self.use_phase:
            keep = ph == phase
            X, y = X[keep], y[keep]
        return X[-self.window:], y[-self.window:]

    def fit_predict(self, cand, phase=0):
        """Predicted fitness of candidate genomes; None if no data for this phase yet."""
        X, y = self._data(phase)
        if len(y) < self.L + 2:
            return None
        A = np.column_stack([np.ones(len(y)), 2 * X - 1])
        reg = self.lam * np.eye(A.shape[1])
        reg[0, 0] = 0.0
        beta = np.linalg.solve(A.T @ A + reg, A.T @ (y - y.mean()))
        C = np.column_stack([np.ones(len(cand)), 2 * np.asarray(cand, float) - 1])
        return C @ beta
