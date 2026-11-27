# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Physical lens metamer, ITU-R BT.2020/BT.2100 transfer, Draine-HG atmosphere & water caustics.

Clean-room synthesis from:
  - FORMULAS.tsv: OPT-001 (Snell), OPT-002 (Fresnel), OPT-008 (Airy), OPT-014 (Sellmeier),
    OPT-032 (Henyey-Greenstein), OPT-033 (Beer-Lambert)
  - ITU-R BT.2020 luminance weights and BT.2100 ST-2084 PQ exact OETF/EOTF
  - DS-08 dark-mist shadow preservation (preserving low-luminance contrast without grey washout).
"""
from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

# ITU-R BT.2100 ST-2084 Perceptual Quantizer constants (exact rational definitions)
PQ_M1 = 2610.0 / 16384.0
PQ_M2 = (2523.0 / 4096.0) * 128.0
PQ_C1 = 3424.0 / 4096.0
PQ_C2 = (2413.0 / 4096.0) * 32.0
PQ_C3 = (2392.0 / 4096.0) * 32.0
PQ_PEAK_NITS = 10000.0

# ITU-R BT.2020 luminance coefficients
BT2020_LUMA = (0.2627, 0.6780, 0.0593)

# Standard 3-term Sellmeier coefficients (wavelength in micrometres)
SELLMEIER_MEDIA: dict[str, tuple[tuple[float, float, float], tuple[float, float, float]]] = {
    "N-BK7": ((1.03961212, 0.231792344, 1.01046945), (0.00600069867, 0.0200179144, 103.560653)),
    "N-SF11": ((1.73759695, 0.313747346, 1.89878101), (0.013188707, 0.0623068142, 155.23629)),
    "water": ((0.5684027565, 0.1726177391, 0.02086189578), (0.005101829712, 0.01821153936, 0.02620722293)),
}


def bt2020_luminance(rgb: tuple[float, float, float]) -> float:
    """ITU-R BT.2020 linear luminance Y = 0.2627 R + 0.6780 G + 0.0593 B."""
    return BT2020_LUMA[0] * float(rgb[0]) + BT2020_LUMA[1] * float(rgb[1]) + BT2020_LUMA[2] * float(rgb[2])


def bt2100_pq_oetf(linear_nits: float) -> float:
    """ITU-R BT.2100 PQ inverse EOTF mapping absolute luminance [0, 10000] cd/m^2 to [0, 1]."""
    y = max(0.0, min(1.0, float(linear_nits) / PQ_PEAK_NITS))
    ym1 = y ** PQ_M1
    return float(((PQ_C1 + PQ_C2 * ym1) / (1.0 + PQ_C3 * ym1)) ** PQ_M2)


def bt2100_pq_eotf(pq_signal: float) -> float:
    """ITU-R BT.2100 PQ EOTF mapping normalized code value [0, 1] to absolute cd/m^2."""
    e = max(0.0, min(1.0, float(pq_signal)))
    ep = e ** (1.0 / PQ_M2)
    num = max(0.0, ep - PQ_C1)
    den = max(1e-15, PQ_C2 - PQ_C3 * ep)
    return float(PQ_PEAK_NITS * ((num / den) ** (1.0 / PQ_M1)))


def sellmeier_index(wavelength_nm: float, medium: str = "N-BK7") -> float:
    """3-term Sellmeier refractive index n(lambda) (OPT-014); wavelength in nanometres."""
    if medium not in SELLMEIER_MEDIA:
        raise ValueError(f"unknown optical medium: {medium}")
    b, c = SELLMEIER_MEDIA[medium]
    lam_um = float(wavelength_nm) * 1e-3
    l2 = lam_um * lam_um
    n2 = 1.0 + sum((bi * l2) / (l2 - ci) for bi, ci in zip(b, c))
    if n2 <= 0.0:
        raise ValueError(f"wavelength {wavelength_nm} nm outside valid Sellmeier domain")
    return math.sqrt(n2)


def fresnel_dielectric_unpolarized(cos_i: float, n1: float, n2: float) -> tuple[float, float, bool]:
    """Exact unpolarized dielectric Fresnel reflectance R, cos_t, and TIR flag (OPT-002)."""
    ci = max(0.0, min(1.0, float(cos_i)))
    eta = float(n1) / float(n2)
    sin2_t = (eta * eta) * max(0.0, 1.0 - ci * ci)
    if sin2_t >= 1.0:
        return 1.0, 0.0, True
    ct = math.sqrt(max(0.0, 1.0 - sin2_t))
    rs = ((n1 * ci - n2 * ct) / (n1 * ci + n2 * ct)) ** 2
    rp = ((n1 * ct - n2 * ci) / (n1 * ct + n2 * ci)) ** 2
    return 0.5 * (rs + rp), ct, False


def chromatic_bokeh_halation(
    wavelengths_nm: tuple[float, ...] = (460.0, 546.1, 635.0),
    *,
    f_number: float = 2.0,
    focal_mm: float = 50.0,
    defocus_mm: float = 0.25,
    glass: str = "N-BK7",
    halation_strength: float = 0.08,
) -> dict[str, object]:
    """Wavelength-dispersive Airy diffraction + longitudinal chromatic bokeh + normalized halation."""
    if f_number <= 0.0 or focal_mm <= 0.0:
        raise ValueError("f_number and focal_mm must be positive")
    h_frac = max(0.0, min(0.35, float(halation_strength)))
    n_ref = sellmeier_index(587.5618, glass)
    radii_um: list[float] = []
    indices: list[float] = []
    for wl in wavelengths_nm:
        n_wl = sellmeier_index(wl, glass)
        indices.append(n_wl)
        airy_um = 1.22 * (wl * 1e-3) * f_number
        # Longitudinal chromatic focus shift delta_f / f = -(n_wl - n_ref) / (n_ref - 1)
        df_mm = -focal_mm * (n_wl - n_ref) / max(n_ref - 1.0, 1e-6)
        coc_um = (abs(defocus_mm + df_mm) / f_number) * 1000.0
        radii_um.append(math.hypot(airy_um, 0.5 * coc_um))

    # Unit-sum core + halation kernel weights per wavelength (red scatters wider, zero energy gain)
    core_w = [1.0 - h_frac * (wl / 635.0) for wl in wavelengths_nm]
    halo_w = [1.0 - cw for cw in core_w]
    metamer_spread_um = max(radii_um) - min(radii_um)
    return {
        "glass": glass,
        "wavelengths_nm": list(wavelengths_nm),
        "indices": indices,
        "bokeh_radii_um": radii_um,
        "core_weights": core_w,
        "halation_weights": halo_w,
        "metamer_spread_um": float(metamer_spread_um),
    }


def _hg_phase(cos_t: float, g: float) -> float:
    denom = max(1e-12, 1.0 + g * g - 2.0 * g * cos_t)
    return (1.0 - g * g) / (4.0 * math.pi * (denom ** 1.5))


def _draine_phase(cos_t: float, g: float, alpha: float) -> float:
    denom = max(1e-12, 1.0 + g * g - 2.0 * g * cos_t)
    norm = 1.0 + alpha * (1.0 + 2.0 * g * g) / 3.0
    return ((1.0 - g * g) / (4.0 * math.pi * (denom ** 1.5))) * ((1.0 + alpha * cos_t * cos_t) / norm)


def draine_hg_dual_lobe_phase(
    cos_theta: float,
    g_fwd: float = 0.78,
    g_back: float = -0.25,
    alpha_draine: float = 1.6,
    mix_fwd: float = 0.85,
) -> float:
    """Normalized dual-lobe Mie-Draine forward + HG backscatter phase function (sr^-1)."""
    if not (-1.0 < g_fwd < 1.0 and -1.0 < g_back < 1.0):
        raise ValueError("asymmetry parameters g_fwd and g_back must lie strictly inside (-1, 1)")
    if alpha_draine < 0.0:
        raise ValueError("alpha_draine must be non-negative")
    w = max(0.0, min(1.0, float(mix_fwd)))
    mu = max(-1.0, min(1.0, float(cos_theta)))
    return float(w * _draine_phase(mu, g_fwd, alpha_draine) + (1.0 - w) * _hg_phase(mu, g_back))


def dark_mist_radiance(
    scene_rgb: tuple[float, float, float],
    distance_m: float,
    sigma_t: float,
    albedo_scat: float,
    sun_rgb: tuple[float, float, float],
    cos_theta: float,
    *,
    gloom_preserve: float = 0.75,
    g_fwd: float = 0.78,
) -> dict[str, object]:
    """Volumetric Beer-Lambert + dual-lobe airlight preserving DS-08 dark-mist shadow depth."""
    if sigma_t < 0.0 or distance_m < 0.0:
        raise ValueError("sigma_t and distance_m must be non-negative")
    if albedo_scat < 0.0 or albedo_scat > 1.0:
        raise ValueError(f"unphysical single-scattering albedo: {albedo_scat}")
    t_beam = math.exp(-sigma_t * distance_m)
    phase = draine_hg_dual_lobe_phase(cos_theta, g_fwd=g_fwd)
    # Shadow-depth preservation: in dark regions, suppress flat ambient lift while retaining real sun shafts
    luma_scene = bt2020_luminance(scene_rgb)
    luma_sun = bt2020_luminance(sun_rgb)
    gloom = max(0.0, min(1.0, float(gloom_preserve)))
    shadow_gate = (1.0 - gloom) + gloom * (luma_scene / (luma_scene + 0.08 + 0.25 * luma_sun))
    inscatter_gain = albedo_scat * (1.0 - t_beam) * min(1.0, phase * 4.0 * math.pi * 0.25) * shadow_gate
    out_rgb = tuple(float(scene_rgb[i]) * t_beam + float(sun_rgb[i]) * inscatter_gain for i in range(3))
    return {
        "transmittance": float(t_beam),
        "phase_sr_inv": float(phase),
        "shadow_gate": float(shadow_gate),
        "rgb": out_rgb,
        "luma_bt2020": bt2020_luminance(out_rgb),
    }


def water_caustic_envelope(
    incident_dir: tuple[float, float, float],
    surface_normal: tuple[float, float, float],
    water_depth_m: float,
    wavelength_nm: float = 532.0,
    surface_curvature_m_inv: float = 0.12,
) -> dict[str, object]:
    """Exact vector Snell refraction + Fresnel transmission + water caustic focusing envelope."""
    d = np.asarray(incident_dir, dtype=np.float64)
    n = np.asarray(surface_normal, dtype=np.float64)
    d = d / max(float(np.linalg.norm(d)), 1e-12)
    n = n / max(float(np.linalg.norm(n)), 1e-12)
    cos_i = max(0.0, float(-np.dot(d, n)))
    n_water = sellmeier_index(wavelength_nm, "water")
    refl, cos_t, tir = fresnel_dielectric_unpolarized(cos_i, 1.0, n_water)
    eta = 1.0 / n_water
    refracted = eta * d + (eta * cos_i - cos_t) * n
    refracted = refracted / max(float(np.linalg.norm(refracted)), 1e-12)

    # Underwater path length and spectral Beer-Lambert attenuation (blue-green penetrates deepest)
    path_m = max(0.0, float(water_depth_m)) / max(cos_t, 0.15)
    alpha_abs = 0.03 + 0.35 * max(0.0, (wavelength_nm - 490.0) / 210.0) ** 2
    trans_water = math.exp(-alpha_abs * path_m)
    # Bounded caustic Jacobian focusing factor (energy redistributes laterally, mean flux <= (1 - R)*T)
    focal_term = abs(1.0 - float(surface_curvature_m_inv) * path_m * (1.0 - eta))
    caustic_gain = min(3.5, 1.0 / max(0.28, focal_term))
    return {
        "n_water": float(n_water),
        "fresnel_reflectance": float(refl),
        "fresnel_transmittance": float(1.0 - refl),
        "tir": bool(tir),
        "refracted_dir": refracted.tolist(),
        "beer_lambert_trans": float(trans_water),
        "caustic_focus_gain": float(caustic_gain),
        "net_bundle_flux": float((1.0 - refl) * trans_water),
    }


def verify_optical_energy_conservation(
    transmittance: float,
    albedo_scat: float,
    kernel_weights: tuple[float, float] = (0.92, 0.08),
) -> tuple[bool, str]:
    """Fail-closed optical conservation check: T in [0,1], albedo in [0,1], kernel sum <= 1."""
    if not (math.isfinite(transmittance) and 0.0 <= transmittance <= 1.0):
        return False, f"unphysical_transmittance:{transmittance}"
    if not (math.isfinite(albedo_scat) and 0.0 <= albedo_scat <= 1.0):
        return False, f"unphysical_scattering_albedo:{albedo_scat}"
    ksum = float(kernel_weights[0]) + float(kernel_weights[1])
    if not math.isfinite(ksum) or abs(ksum - 1.0) > 1e-6:
        return False, f"non_conserving_kernel_sum:{ksum:.6f}"
    return True, "optical_energy_conserved"
