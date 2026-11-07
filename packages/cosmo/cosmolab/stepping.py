# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Block time steps for P3M: the mesh force on global steps, the pair force on power-of-two sub-steps.

Time is the drift time tau, d tau = da / (a^3 E), in which dx/d tau = p and dp/d tau = a g. Each global step
[A0, A1] is cut into 2^L sub-steps of equal tau. A particle on level l takes steps of 2^(L - l) sub-steps,
so level 0 is the global step and level L the finest. Its level follows the softening-length criterion of
Gadget (Springel 2005, MNRAS 364, 1105, eq. 34) written in tau:

    d tau_i = sqrt(2 eta eps / (a |g_short,i|)),   l_i = ceil(log2(d tau_global / d tau_i)), clamped to [0, L]

The long-range (mesh) kick runs once per global step boundary and the pair kick at each particle's own step
boundaries, both kick-drift-kick (multiple time stepping, Tuckerman, Berne and Martyna 1992; the TreePM
scheme of Gadget-2). Every particle drifts on every sub-step, so positions are synchronised at every
sub-step boundary; momenta are half a kick apart except at the end. Back-to-back half kicks at one boundary
are merged into one: closing kick of the old step plus opening kick of the new.

A particle may shorten its step at any of its boundaries and lengthen it only where the longer step starts
on the same boundary (the level is then at least L - v2(j) at sub-step j, v2 the power of two dividing j).
An engine supplies the forces; NumpyEngine below is the CPU one, lean.CudaEngine the GPU one.
"""
import numpy as np

from . import pm, shortrange


def _v2(j):
    """Largest power of two dividing j, as an exponent; j = 0 counts as divisible by everything."""
    return 64 if j == 0 else (j & -j).bit_length() - 1


class BlockStepper:
    """eta: accuracy parameter of the step criterion; eps: softening (Mpc/h); max_level: L."""

    def __init__(self, cosmo, eps, eta=0.025, max_level=4, linear_exact=True):
        self.cosmo, self.eps, self.eta, self.L = cosmo, float(eps), float(eta), int(max_level)
        self.linear_exact = linear_exact
        self.stats = []

    def _long_factors(self, a_global, mids):
        """Mesh kick weights at each global boundary and a drift scale per global step.

        linear_exact: the weights and scales of FastPM (Feng et al. 2016, MNRAS 463, 2273) moved to the
        global step: in the linear regime p = G_p Psi with G_p = a^3 E dD/da and the mesh force is
        1.5 Omega_m D Psi, so a kick (G_p(m_n) - G_p(m_n-1)) / (1.5 Omega_m D(A_n)) and a total drift
        (D(A_n+1) - D(A_n)) / G_p(m_n) reproduce linear growth for any step count. The sub-step drifts of
        a global step are all scaled by one factor so that they add up to that total; the pair kicks keep
        their plain factors. Otherwise: plain integrals and no scaling."""
        c = self.cosmo
        a_global = np.asarray(a_global, dtype=float)
        if not self.linear_exact:
            pts = np.concatenate([[a_global[0]], np.ravel(np.column_stack([mids, a_global[1:]]))])
            ks = [c.kick_factor(u, v) for u, v in zip(pts[:-1], pts[1:])]
            kick = [ks[0]] + [ks[2 * i + 1] + ks[2 * i + 2] for i in range(len(mids) - 1)] + [ks[-1]]
            return np.array(kick), np.ones(len(mids))
        gp = lambda a: np.asarray(a) ** 2 * c.E(a) * c.growth_rate(a) * c.growth(a)
        d = c.growth(a_global)
        g_mid = gp(np.asarray(mids))
        g_end = gp(a_global[[0, -1]])
        edges = np.concatenate([[g_end[0]], g_mid, [g_end[1]]])
        kick = np.diff(edges) / (1.5 * c.omega_m * d)
        drift = np.diff(d) / g_mid / np.array([c.drift_factor(u, v) for u, v in zip(a_global[:-1], a_global[1:])])
        return kick, drift

    def _points(self, a0, a1):
        """2^(L+1) + 1 scale factors between a0 and a1 evenly spaced in drift time (half sub-steps)."""
        m = 2 ** (self.L + 1)
        fine = np.linspace(a0, a1, 8 * m + 1)
        tau = np.concatenate([[0.0], np.cumsum([self.cosmo.drift_factor(u, v) for u, v in zip(fine[:-1], fine[1:])])])
        pts = np.interp(np.linspace(0, tau[-1], m + 1), tau, fine)
        pts[0], pts[-1] = a0, a1
        return pts, tau[-1]

    def run(self, engine, a_global, callback=None):
        """Advance engine from a_global[0] to a_global[-1]. callback(a, engine) at each global boundary."""
        cosmo, L = self.cosmo, self.L
        m = 2 ** (L + 1)
        pts, dtau_g = [], []
        for a0, a1 in zip(a_global[:-1], a_global[1:]):
            p, t = self._points(a0, a1)
            pts.append(p if not pts else p[1:])
            dtau_g.append(t)
        a = np.concatenate(pts)
        kc = np.concatenate([[0.0], np.cumsum([cosmo.kick_factor(u, v) for u, v in zip(a[:-1], a[1:])])])
        last = len(a) - 1
        klong, dscale = self._long_factors(a_global, [a[n * m + m // 2] for n in range(len(a_global) - 1)])
        span = [2 ** (L - lv) for lv in range(L + 1)]          # half of a level-l step, in half sub-steps
        two_eta_eps = 2 * self.eta * self.eps
        for n in range(len(a_global) - 1):
            base = n * m
            engine.long_kick(klong[n])
            for j in range(2 ** L):
                t = base + 2 * j
                thr = max(0, L - _v2(j))
                kclose = np.array([kc[t] - kc[t - s] if t - s >= 0 else 0.0 for s in span])
                kopen = np.array([kc[t + s] - kc[t] if lv >= thr else 0.0 for lv, s in enumerate(span)])
                crit = dtau_g[n] ** 2 * a[t] / two_eta_eps
                self.stats.append(engine.short_kick(thr, kclose, kopen, crit, L))
                engine.drift(dscale[n] * cosmo.drift_factor(a[t], a[t + 2]))
            if callback is not None:
                callback(a_global[n + 1], engine)
        # close every particle's last step and the last mesh step
        kclose = np.array([kc[last] - kc[last - s] for s in span])
        self.stats.append(engine.short_kick(0, kclose, np.zeros(L + 1), 0.0, L))
        engine.long_kick(klong[-1])
        return engine


def level_rule(gmag, crit, thr, lmax):
    """Level from |g|: smallest l with 4^l >= crit |g| (so 2^l >= d tau_global / d tau_i), in [thr, lmax].
    Returns the levels and how many particles wanted a level deeper than lmax."""
    r = crit * gmag
    lv = np.zeros(len(r), dtype=np.int64)
    for _ in range(lmax):
        lv += (4.0 ** lv) < r
    clamped = int(np.count_nonzero(4.0 ** lv < r))
    return np.maximum(lv, thr), clamped


class NumpyEngine:
    """CPU engine around a numpy P3MSolver: positions and momenta (N, 3) float64, pair sums by k-d tree."""

    def __init__(self, solver, pos, mom):
        self.s = solver
        self.pos, self.mom = np.array(pos, dtype=np.float64), np.array(mom, dtype=np.float64)
        self.level = np.zeros(len(self.pos), dtype=np.int64)
        self.pair_evals = 0

    def long_kick(self, k):
        if k:
            self.mom += k * np.asarray(pm.PMSolver.accel(self.s, self.pos))

    def short_kick(self, thr, kclose, kopen, crit, lmax):
        act = np.nonzero(self.level >= thr)[0]
        s = self.s
        g = shortrange.short_range_subset(self.pos, act, s.box, s.gm, s.short_rs, s.rcut, s.eps)
        lv, clamped = level_rule(np.linalg.norm(g, axis=1), crit, thr, lmax)
        self.mom[act] += g * (kclose[self.level[act]] + kopen[lv])[:, None]
        self.level[act] = lv
        self.pair_evals += len(act)
        return len(act), clamped

    def drift(self, d):
        self.pos = np.mod(self.pos + self.mom * d, self.s.box)

    def positions(self):
        return self.pos
