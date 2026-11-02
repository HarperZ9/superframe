# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Law registry: every law as a knob with a continuous deformation epsilon; the true law sits at 0.

Each entry gives the knob, its true value, units, the anchor (with the grade of the source this
package was built from: FETCHED, SNIPPET or MEMORY), the expected qualitative behaviour, the knob value
as a function of epsilon, and, where one exists, a qualitative observable for the wall finder.
"""
from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np

from . import diffusion, lake, lenia, logistic, orbits, scaling, thermo


@dataclass
class Law:
    name: str
    family: str
    knob: str
    true_value: float
    units: str
    anchor: str
    grade: str
    expected: str
    value: Callable[[float], float] = None
    observe: Optional[Callable] = None  # observe(eps, rng) -> bool
    bracket: tuple = ()
    notes: str = ""
    extra: dict = field(default_factory=dict)

    def at(self, eps):
        return self.value(eps) if self.value else self.true_value + eps


def _lenia_alive(mu_of, sigma_of, seeds=32):
    def obs(eps, rng):
        mu, sg = mu_of(eps), sigma_of(eps)
        A0 = sparse_soups(seeds, rng)
        A, h = lenia.run(np.full(seeds, mu), np.full(seeds, sg), rng, steps=500, A0=A0)
        return any(lenia.persists(c["label"]) for c in lenia.classify(A, h))
    return obs


def sparse_soups(B, rng, n=128):
    """The preregistered seed protocol: a centred square of side 13 to 51, values density x U(0, 1),
    density U(0.2, 1), with each cell kept with probability U(0.2, 1)."""
    A0 = np.zeros((B, n, n), np.float32)
    for b in range(B):
        side = int(rng.integers(13, 52))
        den, keep = rng.uniform(0.2, 1.0), rng.uniform(0.2, 1.0)
        o = n // 2 - side // 2
        A0[b, o:o + side, o:o + side] = den * rng.random((side, side)) * (rng.random((side, side)) < keep)
    return A0


def _energy_drift(leak):
    xy, es = orbits.leapfrog(2.0, e=0.3, steps=20000, dt=0.002, leak=leak)
    return abs(es[-1] - es[0]) / abs(es[0])


LAWS = [
    Law("force_exponent", "orbits", "n in F = -k r^-n", 2.0, "dimensionless (exponent of r)",
        "Bertrand (1873): only n = 2 and n = -1 close every bound orbit", "MEMORY",
        "closed orbits at eps = 0 (and at eps = -3); precession of 2 pi (1/sqrt(1 - eps) - 1) per radial "
        "period otherwise; circular orbits unstable for eps >= 1",
        observe=lambda e, r: orbits.closure_spread(2.0 + e) < 1e-4, bracket=(0.0, 0.3)),
    Law("dimension", "orbits", "d, with the Gauss-law force n = d - 1", 3.0, "spatial dimensions",
        "Ehrenfest (1917): stable orbits only for d < 4", "MEMORY",
        "circular orbits stable for eps < 1, unstable from eps = 1 (d = 4)",
        observe=lambda e, r: orbits.stays_bound(3.0 + e - 1.0), bracket=(0.5, 1.5)),
    Law("lenia_mu", "lenia", "growth centre mu", 0.15, "field units (kernel-weighted density)",
        "Chan (2019): Orbium at R 13, T 10, mu 0.15, sigma 0.015", "FETCHED",
        "moving creatures in a narrow band around eps = 0; death below, filling above",
        observe=_lenia_alive(lambda e: 0.15 + e, lambda e: 0.015), bracket=(0.0, 0.08)),
    Law("lenia_sigma", "lenia", "growth width sigma", 0.015, "field units",
        "Chan (2019), as above", "FETCHED", "creatures in a narrow band of sigma at fixed mu",
        observe=_lenia_alive(lambda e: 0.15, lambda e: 0.015 + e), bracket=(0.0, 0.02)),
    Law("density_anomaly", "lake", "temperature of maximum density, 4 (1 + eps) C", 4.0, "C",
        "water's density maximum near 3.98 C", "MEMORY",
        "ice lid with liquid below at eps = 0; eps = -1 removes the maximum (densest at 0 C)",
        observe=lambda e, r: lake.simulate(depth=4.0, years=2, anomaly=1.0 + e)["solid_day"] is not None,
        bracket=(-1.0, 0.0)),
    Law("ice_density", "lake", "ice density", 917.0, "kg m^-3",
        "ice floats (917 against about 1000 kg m^-3)", "MEMORY",
        "floating lid at eps = 0; sinking ice once ice is denser than the coldest water",
        observe=lambda e, r: lake.simulate(depth=4.0, years=2, ice_rho=917.0 + e)["solid_day"] is not None,
        bracket=(0.0, 200.0)),
    Law("diffusion_exponent", "diffusion", "alpha in MSD ~ t^alpha", 1.0, "dimensionless",
        "Fick / Einstein (1905): Brownian spread is Gaussian with MSD ~ t", "MEMORY",
        "Gaussian at eps = 0; cusped (CTRW) below, heavy-tailed (Levy walk) above",
        observe=lambda e, r: abs(diffusion.msd_exponent(1.0 + e, r, n=8000)[1] - 3.0) > 0.3, bracket=(0.0, 0.5)),
    Law("ising_coupling", "scaling", "K = J / kT", float(0.5 * np.log(1 + np.sqrt(2))), "dimensionless",
        "Onsager (1944): Kc = ln(1 + sqrt 2) / 2", "MEMORY",
        "block-spin flow toward order for eps > 0, toward disorder for eps < 0; fixed point at 0"),
    Law("body_size", "scaling", "length L (m), Bond number against 1", 2.71e-3, "m",
        "capillary length sqrt(gamma / (rho g)) for water", "MEMORY",
        "weight beats surface tension for eps > 0",
        observe=lambda e, r: scaling.bond_number(2.71e-3 + e) > 1.0, bracket=(-2e-3, 2e-3)),
    Law("kleiber_exponent", "scaling", "b in metabolic rate ~ M^b", 0.75, "dimensionless",
        "Kleiber (1932) 3/4; White and Seymour (2003) about 2/3 for mammal basal rates", "MEMORY",
        "no single exponent fits all taxa; recorded, no observable"),
    Law("energy_leak", "thermo", "velocity gain per step", 0.0, "fraction per step",
        "first law: a closed orbit conserves energy", "MEMORY",
        "drift at the integrator floor at eps = 0, growing with eps",
        observe=lambda e, r: _energy_drift(10 ** e) > 10 * max(_energy_drift(0.0), 1e-12), bracket=(-12.0, -4.0),
        notes="the knob is log10 of the leak"),
    Law("reversal_noise", "thermo", "log10 relative velocity noise at reversal", -16.0, "log10",
        "Loschmidt (1876): reversed microdynamics retrace; Boltzmann's reply", "MEMORY",
        "return succeeds below a noise wall that falls as e^(-lambda t)",
        observe=lambda e, r: thermo.loschmidt(64, 400, 10 ** (-16 + e), r)[0] > 0.05, bracket=(0.0, 15.0)),
    Law("demon_bias", "thermo", "share of door decisions that sort", 0.0, "probability",
        "Maxwell (1867); Szilard (1929); Landauer (1961); Bennett (1982)", "MEMORY",
        "gas entropy falls for eps > 0, paid for by the demon's record"),
    Law("ground_degeneracy", "thermo", "ground-state degeneracy g0", 1.0, "states",
        "third law (Nernst, Planck): S -> 0 as T -> 0 for a single ground state", "MEMORY",
        "residual entropy ln(1 + eps) at T = 0"),
    Law("logistic_r", "anchor", "r in x -> r x (1 - x)", 3.0, "dimensionless",
        "first period doubling at r = 3", "MEMORY", "fixed point for eps < 0, period 2 just above",
        observe=lambda e, r: logistic.period_above_one(3.0 + e), bracket=(-0.2, 0.2)),
]

BY_NAME = {law.name: law for law in LAWS}
