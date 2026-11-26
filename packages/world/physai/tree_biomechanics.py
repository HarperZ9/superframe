# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Biomechanics-grounded tree & foliage wind/growth-stress dynamics kernel.

Clean-room synthesis from catalogued arboriculture allometry, reaction-wood growth-stress
mechanics, modal cantilever damping, and microfacet wet-foliage optics:
  - Height-diameter allometry H = a * (ln D)^b and tapered flexural rigidity EI
  - Coupled trunk / primary-branch / canopy cantilever dynamics with Vogel wind streamlining
  - Snow/rain interception mass loading (sag + downward frequency shift) and growth-stress prestress
  - Wet-leaf PBR specular/roughness response with strict white-furnace energy conservation.
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

CANTILEVER_BETA1 = 1.87510407
GRAVITY_SI = 9.80665
WATER_IOR = 1.333
WATER_F0 = ((WATER_IOR - 1.0) / (WATER_IOR + 1.0)) ** 2


@dataclass(frozen=True)
class SpeciesBiomech:
    """SI wood elasticity, allometry H = a*(ln D_cm)^b, growth stress, and Vogel drag."""
    name: str
    allom_a: float
    allom_b: float
    youngs_modulus_pa: float
    wood_density_kg_m3: float
    damping_zeta: float
    vogel_gamma: float
    growth_stress_pa: float
    crown_drag_cd: float


SPECIES_PRESETS: dict[str, SpeciesBiomech] = {
    "birch": SpeciesBiomech("birch", 3.10, 1.42, 1.15e10, 650.0, 0.065, 0.38, 1.4e7, 0.52),
    "spruce": SpeciesBiomech("spruce", 3.45, 1.46, 1.05e10, 470.0, 0.075, 0.34, 1.8e7, 0.58),
    "oak": SpeciesBiomech("oak", 2.75, 1.38, 1.25e10, 740.0, 0.080, 0.28, 1.2e7, 0.62),
    "eucalyptus": SpeciesBiomech("eucalyptus", 3.80, 1.48, 1.45e10, 680.0, 0.060, 0.42, 2.2e7, 0.48),
}


@dataclass(frozen=True)
class TreeStructure:
    """Derived cantilever structural properties for trunk, branch, and canopy modes."""
    species: str
    dbh_m: float
    height_m: float
    trunk_ei: float
    modal_mass_kg: tuple[float, float, float]
    modal_stiff_n_m: tuple[float, float, float]
    modal_omega_rad_s: tuple[float, float, float]
    growth_prestress_n: float
    canopy_area_m2: float


def compute_tree_structure(species: str, dbh_m: float) -> TreeStructure:
    """Derive 3-mode cantilever trunk/branch/canopy properties from species and DBH (metres)."""
    if species not in SPECIES_PRESETS:
        raise ValueError(f"unknown tree species: {species}")
    if dbh_m <= 0.02:
        raise ValueError("dbh_m must exceed 0.02 m")
    sp = SPECIES_PRESETS[species]
    dbh_cm = dbh_m * 100.0
    height_m = max(1.5, sp.allom_a * (math.log(max(dbh_cm, 2.0)) ** sp.allom_b))
    radius = 0.5 * dbh_m
    area = math.pi * radius * radius
    inertia_i = 0.25 * math.pi * (radius ** 4)
    trunk_ei = sp.youngs_modulus_pa * inertia_i

    m_trunk = 0.24 * sp.wood_density_kg_m3 * area * height_m
    m_branch = 0.16 * m_trunk
    m_canopy = 0.07 * m_trunk
    k_trunk = (3.0 * trunk_ei) / (height_m ** 3)
    k_branch = 0.55 * k_trunk
    k_canopy = 0.35 * k_trunk
    w0 = math.sqrt(k_trunk / max(m_trunk, 1e-6))
    w1 = math.sqrt(k_branch / max(m_branch, 1e-6))
    w2 = math.sqrt(k_canopy / max(m_canopy, 1e-6))

    # Eccentric reaction-wood growth-stress restoring force scaling with M_gs / H
    prestress_n = 0.015 * sp.growth_stress_pa * inertia_i / max(radius * height_m, 1e-6)
    canopy_area = 0.18 * height_m * height_m
    return TreeStructure(
        species=species, dbh_m=dbh_m, height_m=height_m, trunk_ei=trunk_ei,
        modal_mass_kg=(m_trunk, m_branch, m_canopy),
        modal_stiff_n_m=(k_trunk, k_branch, k_canopy),
        modal_omega_rad_s=(w0, w1, w2),
        growth_prestress_n=prestress_n, canopy_area_m2=canopy_area,
    )


def vogel_drag_force(wind_vec: np.ndarray, vel_vec: np.ndarray, area_m2: float, cd: float, gamma: float, rho_air: float = 1.225) -> np.ndarray:
    """Quadratic aerodynamic drag with Vogel flexible-crown streamlining (F ~ v^(2 - gamma))."""
    v_rel = np.asarray(wind_vec, dtype=np.float64) - np.asarray(vel_vec, dtype=np.float64)
    speed = float(np.linalg.norm(v_rel))
    if speed < 1e-12:
        return np.zeros(2, dtype=np.float64)
    a_eff = area_m2 * ((1.0 + speed / 6.0) ** (-gamma))
    return 0.5 * rho_air * cd * a_eff * speed * v_rel


class TreeWindBiomechanics:
    """Coupled 3-tier cantilever (trunk, branch, canopy) with gusts, snow/rain load, and reaction wood."""

    def __init__(self, species: str = "spruce", dbh_m: float = 0.36, dt: float = 0.02, seed: int = 0) -> None:
        self.spec = SPECIES_PRESETS[species]
        self.struct = compute_tree_structure(species, dbh_m)
        self.dt = float(dt)
        self._rng = np.random.default_rng(seed)
        self.disp = np.zeros((3, 2), dtype=np.float64)
        self.vel = np.zeros((3, 2), dtype=np.float64)
        self.sag_z = 0.0
        self.gust = np.zeros(2, dtype=np.float64)

    def mechanical_energy(self, precip_load_kg: float = 0.0) -> float:
        """Total kinetic + elastic potential energy (J) of the 3 coupled cantilever tiers."""
        m = list(self.struct.modal_mass_kg)
        m[2] += max(0.0, float(precip_load_kg))
        k = self.struct.modal_stiff_n_m
        ke = 0.5 * sum(m[i] * float(np.dot(self.vel[i], self.vel[i])) for i in range(3))
        pe = 0.5 * k[0] * float(np.dot(self.disp[0], self.disp[0]))
        pe += 0.5 * k[1] * float(np.dot(self.disp[1] - self.disp[0], self.disp[1] - self.disp[0]))
        pe += 0.5 * k[2] * float(np.dot(self.disp[2] - self.disp[1], self.disp[2] - self.disp[1]))
        l_ref = 0.15 * self.struct.height_m
        pe += self.struct.growth_prestress_n * l_ref * sum(math.log(math.cosh(float(x) / l_ref)) for x in self.disp[0])
        return float(ke + pe)

    def _step_gust(self, wind_mean: np.ndarray, gust_sigma: float) -> np.ndarray:
        alpha = math.exp(-self.dt / 0.9)
        noise = self._rng.normal(0.0, max(0.0, gust_sigma), size=2)
        self.gust = alpha * self.gust + math.sqrt(max(0.0, 1.0 - alpha * alpha)) * noise
        return wind_mean + self.gust

    def step(
        self,
        wind_xy: tuple[float, float] = (0.0, 0.0),
        *,
        gust_sigma: float = 0.0,
        snow_kg_m2: float = 0.0,
        rain_mm_h: float = 0.0,
        damping_override: float | None = None,
    ) -> dict[str, float]:
        """Advance coupled trunk/branch/canopy biomechanics by dt using symplectic semi-implicit Euler."""
        zeta = self.spec.damping_zeta if damping_override is None else float(damping_override)
        wind = self._step_gust(np.asarray(wind_xy, dtype=np.float64), gust_sigma)
        precip_kg = (max(0.0, snow_kg_m2) + 0.04 * max(0.0, rain_mm_h)) * self.struct.canopy_area_m2 * 0.35
        masses = [self.struct.modal_mass_kg[0], self.struct.modal_mass_kg[1], self.struct.modal_mass_kg[2] + precip_kg]
        k0, k1, k2 = self.struct.modal_stiff_n_m
        c = [2.0 * zeta * math.sqrt(ki * mi) for ki, mi in zip((k0, k1, k2), masses)]

        f_aero = vogel_drag_force(wind, self.vel[2], self.struct.canopy_area_m2, self.spec.crown_drag_cd, self.spec.vogel_gamma)
        # Reaction-wood prestress resists excessive lean smoothly without adding free energy
        prestress_restore = -self.struct.growth_prestress_n * np.tanh(self.disp[0] / (0.15 * self.struct.height_m))
        f0 = -k0 * self.disp[0] + k1 * (self.disp[1] - self.disp[0]) - c[0] * self.vel[0] + prestress_restore
        f1 = -k1 * (self.disp[1] - self.disp[0]) + k2 * (self.disp[2] - self.disp[1]) - c[1] * self.vel[1] + 0.25 * f_aero
        f2 = -k2 * (self.disp[2] - self.disp[1]) - c[2] * self.vel[2] + 0.75 * f_aero

        for i, fi in enumerate((f0, f1, f2)):
            self.vel[i] = self.vel[i] + (fi / max(masses[i], 1e-6)) * self.dt
            self.disp[i] = self.disp[i] + self.vel[i] * self.dt

        # Snow/rain vertical sag scales with canopy gravity load over branch flexural stiffness
        self.sag_z = (precip_kg * GRAVITY_SI) / max(k1 + k2, 1e-6)
        omega_eff = math.sqrt(k2 / max(masses[2], 1e-6))
        return {
            "trunk_disp_m": float(np.linalg.norm(self.disp[0])),
            "branch_disp_m": float(np.linalg.norm(self.disp[1])),
            "canopy_disp_m": float(np.linalg.norm(self.disp[2])),
            "sag_z_m": float(self.sag_z),
            "precip_load_kg": float(precip_kg),
            "canopy_omega_rad_s": float(omega_eff),
            "energy_j": self.mechanical_energy(precip_kg),
        }


def verify_tree_energy_bound(energies: list[float], tol: float = 1e-6) -> tuple[bool, str]:
    """Fail-closed check: unforced tree oscillation mechanical energy must never increase."""
    if len(energies) < 2:
        return False, "need at least 2 energy samples"
    if any(not math.isfinite(e) or e < 0.0 for e in energies):
        return False, "non_finite_or_negative_energy"
    for i in range(1, len(energies)):
        if energies[i] > energies[i - 1] + tol:
            return False, f"energy_gain_detected_at_step_{i}:{energies[i - 1]:.6f}->{energies[i]:.6f}"
    return True, "passive_dissipation_verified"


def wet_leaf_pbr_response(
    base_roughness: float,
    base_albedo: tuple[float, float, float],
    wetness: float,
    snow_cover: float = 0.0,
    cos_theta: float = 0.7,
) -> dict[str, float | tuple[float, float, float]]:
    """Physical wet/snowy leaf microfacet roughness + Schlick Fresnel response (white-furnace safe)."""
    w = max(0.0, min(1.0, float(wetness)))
    s = max(0.0, min(1.0, float(snow_cover)))
    mu = max(0.0, min(1.0, float(cos_theta)))
    r0 = max(0.04, min(1.0, float(base_roughness)))

    # Water film smooths microfacets toward specular film (0.08); snow roughens toward 0.88
    rough_wet = r0 * (1.0 - 0.78 * w) + 0.08 * (0.78 * w)
    rough_eff = rough_wet * (1.0 - s) + 0.88 * s

    f0_leaf = 0.04 * (1.0 - w) + WATER_F0 * w
    f0_eff = f0_leaf * (1.0 - s) + 0.025 * s
    fresnel = f0_eff + (1.0 - f0_eff) * ((1.0 - mu) ** 5)

    # Porous cuticle wetting increases internal light trapping (darkens diffuse albedo cleanly)
    darken = 1.0 - 0.38 * w
    snow_rgb = (0.86, 0.89, 0.93)
    albedo_eff = tuple(
        max(0.0, min(1.0 - fresnel, (float(c) * darken) * (1.0 - s) + snow_rgb[i] * s))
        for i, c in enumerate(base_albedo)
    )
    return {
        "roughness": float(rough_eff),
        "fresnel": float(fresnel),
        "albedo": albedo_eff,
        "max_total_reflectance": float(max(albedo_eff) + fresnel),
    }


def verify_white_furnace_bound(albedo: tuple[float, float, float], fresnel: float) -> tuple[bool, str]:
    """Fail-closed white-furnace energy conservation check: diffuse + specular <= 1.0 per channel."""
    if not math.isfinite(fresnel) or fresnel < 0.0 or fresnel > 1.0:
        return False, f"unphysical_fresnel:{fresnel}"
    for i, c in enumerate(albedo):
        if not math.isfinite(c) or c < 0.0 or (c + fresnel) > 1.0 + 1e-9:
            return False, f"white_furnace_violation_ch{i}:{c + fresnel:.6f}"
    return True, "white_furnace_conserved"
