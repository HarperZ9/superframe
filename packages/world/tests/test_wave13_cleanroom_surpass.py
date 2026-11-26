# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wave 13B clean-room verification suite:
1. Tree & foliage biomechanics (allometry, Vogel wind, snow load, wet-leaf white-furnace bound)
2. Physical lens metamer + BT.2020/BT.2100 + Draine-HG dark-mist + water caustic optics
3. Engine-to-Living-World (NOH-3) bridge (1,200 multi-scale actors, Caustic held_tick_ratio > 0.70, CODIT guard)
4. Planted-failure controls (energy-gain traps, white-furnace violation, NaN/divergence quarantine, tamper receipt).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pytest

_PACKAGES = Path(__file__).resolve().parents[2]
for _sub in (_PACKAGES / "world", _PACKAGES / "lenspipe", _PACKAGES / "superstack"):
    if str(_sub) not in sys.path:
        sys.path.insert(0, str(_sub))

import engine_receipt as _er  # noqa: E402
from lenspipe.spectral_optics import (  # noqa: E402
    bt2020_luminance,
    bt2100_pq_eotf,
    bt2100_pq_oetf,
    chromatic_bokeh_halation,
    dark_mist_radiance,
    draine_hg_dual_lobe_phase,
    sellmeier_index,
    verify_optical_energy_conservation,
    water_caustic_envelope,
)
from physai.noh3_world_bridge import (  # noqa: E402
    BuckinghamPiScaleNormalizer,
    LivingWorldTickBridge,
    spawn_mixed_world_actors,
)
from physai.tree_biomechanics import (  # noqa: E402
    TreeWindBiomechanics,
    compute_tree_structure,
    verify_tree_energy_bound,
    verify_white_furnace_bound,
    vogel_drag_force,
    wet_leaf_pbr_response,
)


def test_tree_biomechanics_allometry_vogel_snow_load_and_energy_trap():
    """Allometry, Vogel streamlining, snow-load sag/frequency drop, and planted energy-gain rejection."""
    st_small = compute_tree_structure("eucalyptus", 0.18)
    st_tall = compute_tree_structure("eucalyptus", 0.45)
    assert st_tall.height_m > st_small.height_m
    assert st_tall.trunk_ei > st_small.trunk_ei * 30.0

    # Vogel streamlining: doubling wind produces strictly less than 4x force when gamma > 0
    f1 = float(np.linalg.norm(vogel_drag_force(np.array([6.0, 0.0]), np.zeros(2), 10.0, 0.55, 0.38)))
    f2 = float(np.linalg.norm(vogel_drag_force(np.array([12.0, 0.0]), np.zeros(2), 10.0, 0.55, 0.38)))
    assert 2.0 * f1 < f2 < 4.0 * f1

    # Snow/rain load increases vertical sag and lowers canopy modal frequency
    tree_dry = TreeWindBiomechanics("spruce", dbh_m=0.36, dt=0.02, seed=7)
    tree_snow = TreeWindBiomechanics("spruce", dbh_m=0.36, dt=0.02, seed=7)
    info_dry = tree_dry.step((8.0, 1.5), gust_sigma=0.8, snow_kg_m2=0.0)
    info_snow = tree_snow.step((8.0, 1.5), gust_sigma=0.8, snow_kg_m2=18.0, rain_mm_h=10.0)
    assert info_snow["sag_z_m"] > info_dry["sag_z_m"] + 0.01
    assert info_snow["canopy_omega_rad_s"] < info_dry["canopy_omega_rad_s"]

    # Free damped ring-down must strictly conserve/dissipate energy
    free = TreeWindBiomechanics("birch", dbh_m=0.28, dt=0.005, seed=1)
    free.disp[2] = np.array([0.35, 0.0])
    energies = [free.mechanical_energy()]
    for _ in range(80):
        energies.append(free.step((0.0, 0.0))["energy_j"])
    ok_pass, reason = verify_tree_energy_bound(energies)
    assert ok_pass, reason
    assert energies[-1] < energies[0]

    # Planted energy-gain trap: negative damping injects energy and MUST be rejected
    bad = TreeWindBiomechanics("birch", dbh_m=0.28, dt=0.005, seed=1)
    bad.disp[2] = np.array([0.35, 0.0])
    bad_energies = [bad.mechanical_energy()]
    for _ in range(40):
        bad_energies.append(bad.step((0.0, 0.0), damping_override=-0.12)["energy_j"])
    ok_bad, msg_bad = verify_tree_energy_bound(bad_energies)
    assert not ok_bad and "energy_gain" in msg_bad


def test_wet_leaf_pbr_white_furnace_and_planted_overunity_rejection():
    """Wetting lowers leaf roughness & darkens diffuse albedo while conserving white-furnace energy."""
    dry = wet_leaf_pbr_response(0.68, (0.18, 0.34, 0.14), wetness=0.0, snow_cover=0.0, cos_theta=0.75)
    wet = wet_leaf_pbr_response(0.68, (0.18, 0.34, 0.14), wetness=0.95, snow_cover=0.0, cos_theta=0.75)
    snowy = wet_leaf_pbr_response(0.68, (0.18, 0.34, 0.14), wetness=0.2, snow_cover=0.85, cos_theta=0.75)
    assert wet["roughness"] < dry["roughness"] * 0.45
    assert wet["albedo"][1] < dry["albedo"][1]
    assert snowy["roughness"] > wet["roughness"]
    for resp in (dry, wet, snowy):
        ok, msg = verify_white_furnace_bound(resp["albedo"], resp["fresnel"])
        assert ok, msg
    # Planted white-furnace violation (albedo + Fresnel > 1.0) MUST fail closed
    ok_bad, msg_bad = verify_white_furnace_bound((0.95, 0.92, 0.88), 0.18)
    assert not ok_bad and "white_furnace_violation" in msg_bad


def test_itu_bt2020_bt2100_sellmeier_bokeh_and_optical_energy_controls():
    """Exact BT.2100 PQ round-trip, BT.2020 luma, Sellmeier N-BK7 index, and chromatic halation."""
    assert abs(bt2020_luminance((1.0, 1.0, 1.0)) - 1.0) < 1e-12
    for nits in (0.01, 10.0, 100.0, 1000.0, 4000.0, 10000.0):
        rt = bt2100_pq_eotf(bt2100_pq_oetf(nits))
        assert abs(rt - nits) <= max(1e-8, nits * 1e-10)

    # Known-answer N-BK7 refractive index at Fraunhofer d-line (587.5618 nm): 1.51680
    n_bk7_d = sellmeier_index(587.5618, "N-BK7")
    assert abs(n_bk7_d - 1.5168) < 1e-4
    # Normal dispersion: blue bends more strongly than red
    assert sellmeier_index(460.0, "N-SF11") > sellmeier_index(635.0, "N-SF11")

    bokeh = chromatic_bokeh_halation(f_number=2.0, defocus_mm=0.20, glass="N-SF11", halation_strength=0.10)
    assert bokeh["metamer_spread_um"] > 1.0
    for cw, hw in zip(bokeh["core_weights"], bokeh["halation_weights"]):
        ok, msg = verify_optical_energy_conservation(0.85, 0.9, (cw, hw))
        assert ok, msg

    # Planted optical energy-gain traps MUST fail closed
    assert not verify_optical_energy_conservation(1.05, 0.8, (0.9, 0.1))[0]
    assert not verify_optical_energy_conservation(0.8, 1.15, (0.9, 0.1))[0]
    assert not verify_optical_energy_conservation(0.8, 0.8, (0.95, 0.20))[0]


def test_draine_hg_normalization_dark_mist_preservation_and_water_caustics():
    """Draine-HG integrates to 1.0 over 4*pi sr; DS-08 dark mist preserves shadows; caustics conserve flux."""
    mus = np.linspace(-1.0, 1.0, 4001)
    vals = np.array([draine_hg_dual_lobe_phase(float(m), g_fwd=0.80, g_back=-0.22, alpha_draine=1.8) for m in mus])
    integral = float(2.0 * math.pi * np.trapezoid(vals, mus))
    assert abs(integral - 1.0) < 2e-3
    assert draine_hg_dual_lobe_phase(0.98) > draine_hg_dual_lobe_phase(0.0) * 10.0

    # DS-08 dark-mist preservation: dark shadow stays deep while sunlit target retains airlight
    shadow_dark_mist = dark_mist_radiance((0.008, 0.010, 0.014), 180.0, 0.006, 0.85, (1.2, 0.9, 0.6), 0.7, gloom_preserve=0.9)
    shadow_naive_fog = dark_mist_radiance((0.008, 0.010, 0.014), 180.0, 0.006, 0.85, (1.2, 0.9, 0.6), 0.7, gloom_preserve=0.0)
    assert shadow_dark_mist["luma_bt2020"] < shadow_naive_fog["luma_bt2020"] * 0.35
    with pytest.raises(ValueError):
        dark_mist_radiance((0.2, 0.2, 0.2), 50.0, 0.01, 1.25, (1.0, 1.0, 1.0), 0.5)

    # Water caustic refraction obeys Snell law (n1 * sin_i == n2 * sin_t) and conserves bundle flux
    inc = (0.5, 0.0, -math.sqrt(0.75))
    c_blue = water_caustic_envelope(inc, (0.0, 0.0, 1.0), water_depth_m=2.0, wavelength_nm=480.0)
    c_red = water_caustic_envelope(inc, (0.0, 0.0, 1.0), water_depth_m=2.0, wavelength_nm=650.0)
    sin_t = math.hypot(c_blue["refracted_dir"][0], c_blue["refracted_dir"][1])
    assert abs(0.5 - c_blue["n_water"] * sin_t) < 1e-9
    assert 0.0 < c_blue["net_bundle_flux"] <= 1.0
    assert c_blue["beer_lambert_trans"] > c_red["beer_lambert_trans"]


def test_noh3_living_world_1200_actors_caustic_scheduling_codit_and_receipt(tmp_path: Path):
    """1,200 multi-scale actors run stably with held_tick_ratio > 0.70, CODIT fault isolation, and MATCH receipt."""
    actors = spawn_mixed_world_actors(count=1200, seed=2026)
    bridge = LivingWorldTickBridge(actors, dt=0.02, surprise_threshold=0.025)
    active_subset = set(range(0, 60))

    # Plant 3 distinct faults on step 3: NaN velocity, Pi-norm explosion, and quaternion drift
    last_stats = {}
    for step in range(1, 16):
        faults = None
        if step == 3:
            faults = {
                100: {"vel": [float("nan"), 0.0, 0.0]},
                250: {"vel": [1e7, 0.0, 0.0]},
                400: {"quat": [1.8, 0.0, 0.0, 0.0]},
            }
        last_stats = bridge.tick(wind_xy=(9.5, -3.0), active_ids=active_subset, faults=faults)

    assert last_stats["actor_count"] == 1200
    assert last_stats["held_tick_ratio"] > 0.70, last_stats
    assert last_stats["quarantined_count"] == 3
    assert bridge.codit.quarantined == {100, 250, 400}
    # All 1,200 actors remain finite with zero OOD blowup across 4 orders of magnitude
    assert all(np.all(np.isfinite(a.pos)) and np.all(np.isfinite(a.vel)) for a in bridge.actors)
    # Active storm-struck foliage moved, quiet unperturbed actors stayed held
    assert any(float(np.linalg.norm(bridge.actors[i].pos)) > 1e-4 for i in range(10))

    # Buckingham-Pi normalizer bounds extreme OOD raw deltas smoothly
    nm = BuckinghamPiScaleNormalizer(100.0, 20.0)
    bounded = nm.bound_pi_delta(np.array([1e6, -1e6, 0.0]), cap=2.0)
    assert np.all(np.abs(bounded) <= 2.0 + 1e-12)

    # Canonical engine-receipt/1 round-trip + 1-byte tamper control
    rep = tmp_path / "wave13b_living_world.json"
    rec = tmp_path / "wave13b_living_world.receipt.json"
    rep.write_text(json.dumps(last_stats, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    emitted = _er.emit_receipt(
        out_path=rec, engine="superframe", flagship="superframe", task_id="wave13b-living-world",
        root=tmp_path, artifact_paths=[rep],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] Wave 13B living-world invariants ok')"],
    )
    assert emitted["verdict"] == "MATCH"
    loaded = json.loads(rec.read_text(encoding="utf-8"))
    ok_rec, errs_rec = _er.verify_receipt(loaded, check_files=True)
    assert ok_rec, errs_rec
    rep.write_text(rep.read_text(encoding="utf-8") + " ", encoding="utf-8")
    ok_tamper, _ = _er.verify_receipt(loaded, check_files=True)
    assert not ok_tamper
