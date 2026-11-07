# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Flat LambdaCDM background: expansion rate, linear growth and the leapfrog factors.

Units: time in 1/H0, comoving length in Mpc/h, so H0 = 1 and a velocity unit is 100 km/s.
Radiation and massive neutrinos are left out; both change D(a) by well under a percent after z = 50.
"""
from dataclasses import dataclass, replace

import numpy as np
from scipy import integrate


@dataclass(frozen=True)
class Cosmology:
    """Defaults: Planck 2015 TT,TE,EE+lowP+lensing+ext (Planck Collaboration XIII 2016, table 4, last column)."""
    omega_m: float = 0.3089
    omega_b: float = 0.0486
    h: float = 0.6774
    n_s: float = 0.9667
    sigma8: float = 0.8159
    t_cmb: float = 2.7255

    @property
    def omega_l(self):
        return 1.0 - self.omega_m

    def with_(self, **kw):
        return replace(self, **kw)

    def E(self, a):
        """H(a) / H0."""
        a = np.asarray(a, dtype=float)
        return np.sqrt(self.omega_m * a ** -3 + self.omega_l)

    def dE_da(self, a):
        a = np.asarray(a, dtype=float)
        return -1.5 * self.omega_m * a ** -4 / self.E(a)

    def omega_m_a(self, a):
        """Matter fraction at scale factor a."""
        a = np.asarray(a, dtype=float)
        return self.omega_m * a ** -3 / self.E(a) ** 2

    # ---- linear growth -------------------------------------------------------------------------
    def _growth_integral(self, a):
        """I(a) = int_0^a da' / (a' E(a'))^3, the Heath (1977) integral, exact for flat LambdaCDM."""
        f = lambda x: 1.0 / (x * self.E(x)) ** 3 if x > 0 else 0.0
        a = np.atleast_1d(np.asarray(a, dtype=float))
        out = np.array([integrate.quad(f, 0.0, ai, epsabs=0, epsrel=1e-12, limit=200)[0] for ai in a])
        return out

    def growth(self, a):
        """D(a) from the Heath integral, normalised to D(1) = 1 (D -> a deep in matter domination before
        normalisation)."""
        a_arr = np.atleast_1d(np.asarray(a, dtype=float))
        raw = 2.5 * self.omega_m * self.E(a_arr) * self._growth_integral(a_arr)
        raw1 = 2.5 * self.omega_m * self.E(1.0) * self._growth_integral(1.0)[0]
        out = raw / raw1
        return out if np.ndim(a) else float(out[0])

    def growth_rate(self, a):
        """f = d ln D / d ln a, from the derivative of the Heath form."""
        a_arr = np.atleast_1d(np.asarray(a, dtype=float))
        integ = self._growth_integral(a_arr)
        e = self.E(a_arr)
        f = a_arr * self.dE_da(a_arr) / e + a_arr / ((a_arr * e) ** 3 * integ)
        return f if np.ndim(a) else float(f[0])

    def growth_ode(self, a_eval, a_start=1e-3):
        """D(a) by integrating D'' + (3/a + E'/E) D' - 1.5 Omega_m / (a^5 E^2) D = 0 from the matter-era
        growing mode D = a, normalised to D(1) = 1. Independent of the Heath integral."""
        def rhs(a, y):
            d, dp = y
            return [dp, -(3.0 / a + self.dE_da(a) / self.E(a)) * dp + 1.5 * self.omega_m / (a ** 5 * self.E(a) ** 2) * d]
        a_eval = np.atleast_1d(np.asarray(a_eval, dtype=float))
        # matter-era start: D = a exactly when Lambda is negligible; the first correction is O(a^3)
        grid = np.unique(np.concatenate([a_eval, [1.0]]))
        sol = integrate.solve_ivp(rhs, (a_start, 1.0 if grid.max() <= 1.0 else grid.max()), [a_start, 1.0],
                                  t_eval=grid, rtol=1e-11, atol=1e-14, method="DOP853")
        d = np.interp(a_eval, sol.t, sol.y[0])
        d1 = np.interp(1.0, sol.t, sol.y[0])
        return d / d1

    # ---- kick-drift-kick factors in the scale factor ---------------------------------------------
    def drift_factor(self, a0, a1):
        """int_{a0}^{a1} da / (a^3 E): x += p * drift, with p = a^2 dx/dt."""
        return integrate.quad(lambda a: 1.0 / (a ** 3 * self.E(a)), a0, a1, epsrel=1e-12)[0]

    def kick_factor(self, a0, a1):
        """int_{a0}^{a1} da / (a^2 E): p += g * kick, with g = -grad Phi and lap Phi = 1.5 Omega_m delta."""
        return integrate.quad(lambda a: 1.0 / (a ** 2 * self.E(a)), a0, a1, epsrel=1e-12)[0]
