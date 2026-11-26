# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Known-answer and planted-failure tests for the procedural material, mesh, flora, and meshlet forge."""
from __future__ import annotations

import copy
import json
import struct
import sys
from pathlib import Path

import numpy as np

MATERIALS_ROOT = Path(__file__).resolve().parents[1]
if str(MATERIALS_ROOT) not in sys.path:
    sys.path.insert(0, str(MATERIALS_ROOT))

from materials import proc_material as pm  # noqa: E402
from materials import proc_mesh_forge as mf  # noqa: E402


# ---------------------------------------------------------------------------
# 1. Spectral Energy Conservation & Illuminant Metamerism
# ---------------------------------------------------------------------------

def test_spectral_energy_conservation_and_illuminant_metamerism():
    """Measured gold and glass obey 0 <= R <= 1; gold shifts visibly across D65, A, and sodium."""
    gold = pm.synthesize_proc_material("gold", seed=42, size=32)
    glass = pm.synthesize_proc_material("soda_lime_glass", seed=42, size=32)
    for spec in (gold, glass):
        refl = spec["spectral_reflectance"]
        assert len(refl) == 81
        assert all(0.0 <= r <= 1.0 for r in refl)
        assert 0.0 <= spec["optical_summary"]["r_min"] <= spec["optical_summary"]["r_max"] <= 1.0
    # Gold under D65 has warm yellow-gold chroma (R > G > B), and shifts markedly under sodium D-line
    d65 = np.array(gold["illuminant_srgb"]["D65"])
    illum_a = np.array(gold["illuminant_srgb"]["A"])
    sodium = np.array(gold["illuminant_srgb"]["sodium"])
    assert d65[0] > d65[1] > d65[2]
    assert float(np.linalg.norm(d65 - illum_a)) > 0.05
    assert float(np.linalg.norm(d65 - sodium)) > 0.15


# ---------------------------------------------------------------------------
# 2. Periodic Tileability, Determinism & Planted Non-Periodic Seam Control
# ---------------------------------------------------------------------------

def test_periodic_tileability_determinism_and_planted_seam_control():
    """Procedural height map has exact 0.0 wrap seam error and byte-identical SHA-256 on rebuild."""
    a = pm.synthesize_proc_material("copper", seed=202607, size=32, weather={"wetness": 0.4, "oxidation": 0.3})
    b = pm.synthesize_proc_material("copper", seed=202607, size=32, weather={"wetness": 0.4, "oxidation": 0.3})
    c = pm.synthesize_proc_material("copper", seed=202608, size=32, weather={"wetness": 0.4, "oxidation": 0.3})
    assert a["seam_delta"] == 0.0
    assert a["map_digest_sha256"] == b["map_digest_sha256"]
    assert a["map_digest_sha256"] != c["map_digest_sha256"]
    # Tangent normals are unit length everywhere
    nrm = a["maps"]["normal"]
    lens = np.linalg.norm(nrm, axis=-1)
    assert np.allclose(lens, 1.0, atol=1e-12)

    # Planted-failure control: non-periodic ramp f(u, v) = u MUST be caught with large seam delta
    seam_bad = pm.verify_tileable_seam(lambda u, v: u + 0.25 * v, size=32)
    assert seam_bad > 0.99


# ---------------------------------------------------------------------------
# 3. WGSL, HLSL SM 6.6+, and glTF 2.0 Material Emitter Verification
# ---------------------------------------------------------------------------

def test_wgsl_hlsl_and_gltf_material_emitters():
    """Emitters generate syntactically complete WGSL, HLSL SM 6.6+, and glTF 2.0 PBR+spectral JSON."""
    spec = pm.synthesize_proc_material("gold", seed=99, size=16, recipe={"roughness_base": 0.22})
    wgsl = spec["shaders"]["wgsl"]
    hlsl = spec["shaders"]["hlsl"]
    gltf_mat = spec["shaders"]["gltf_material"]

    for token in ("struct ProcMaterialParams", "@group(0) @binding(0)", "fn fresnel_complex_unpol",
                  "fn ggx_d", "fn smith_g1", "fn eval_proc_material"):
        assert token in wgsl, f"missing WGSL token: {token}"
    for token in ("struct ProcMaterialParams", "ConstantBuffer<ProcMaterialParams>",
                  "float fresnel_complex_unpol", "float ggx_d", "float smith_g1", "float3 eval_proc_material"):
        assert token in hlsl, f"missing HLSL token: {token}"
    assert gltf_mat["pbrMetallicRoughness"]["metallicFactor"] == 1.0
    assert gltf_mat["pbrMetallicRoughness"]["roughnessFactor"] == 0.22
    assert gltf_mat["extras"]["schema"] == "proc-material/1"
    assert "D65" in gltf_mat["extras"]["illuminant_srgb"]


# ---------------------------------------------------------------------------
# 4. Da Vinci Pipe Model Conservation, Seasonal Snow-Load Sag & Abscission
# ---------------------------------------------------------------------------

def test_da_vinci_pipe_model_and_seasonal_snow_sag():
    """Branch radii obey r_parent^p == sum r_child^p within 1e-5; winter snow lowers mean canopy Z."""
    summer = mf.build_biomechanical_tree(mf.FloraParams(
        species="AncientGnarledOak", seed=101, height_m=12.0, da_vinci_exponent=2.5,
        chlorophyll01=1.0, leaf_abscission01=0.0, canopy_snow_load01=0.0,
    ))
    winter = mf.build_biomechanical_tree(mf.FloraParams(
        species="AncientGnarledOak", seed=101, height_m=12.0, da_vinci_exponent=2.5,
        chlorophyll01=0.0, autumn_carotenoid01=0.2, leaf_abscission01=0.85, canopy_snow_load01=0.9,
    ))
    assert summer.stats["pipe_model_max_err"] < 1e-5
    assert winter.stats["pipe_model_max_err"] < 1e-5
    # Verify pipe conservation explicitly on every non-leaf branch node
    p = summer.params.da_vinci_exponent
    for nd in summer.skeleton:
        if nd.children:
            rhs = sum(summer.skeleton[c].radius ** p for c in nd.children)
            assert abs(nd.radius ** p - rhs) < 1e-5
    # Physical winter snow-load Euler-Bernoulli cantilever sag lowers canopy elevation
    assert winter.stats["mean_canopy_z"] < summer.stats["mean_canopy_z"] - 0.5
    # Deciduous abscission sheds most foliage clusters in winter
    assert winter.stats["foliage_cluster_count"] < summer.stats["foliage_cluster_count"]
    assert winter.stats["abscised_cluster_count"] > 0


# ---------------------------------------------------------------------------
# 5. SDF Boulder / Arch, 64v/126t Meshlets, GLB/OBJ Export & Planted Controls
# ---------------------------------------------------------------------------

def test_sdf_meshlet_invariants_glb_export_and_planted_controls(tmp_path: Path):
    """SDF boulder, basalt arch, and tree satisfy 64v/126t invariants; planted corruptions are caught."""
    boulder = mf.build_sdf_boulder(seed=7, radius=1.8, fracture_planes=5)
    arch = mf.build_basalt_arch(seed=11, span=5.0, height=3.2)
    tree = mf.build_biomechanical_tree(mf.FloraParams(seed=19))

    for mesh in (boulder, arch, tree.mesh):
        ok, errs = mf.verify_meshlets(mesh, max_verts=64, max_tris=126)
        assert ok and errs == [], errs
        assert len(mesh.meshlets) >= 1
        for ml in mesh.meshlets:
            assert 1 <= ml.vertex_count <= 64
            assert 1 <= ml.triangle_count <= 126

    # Export binary glTF 2.0 (.glb) and Wavefront .obj and validate binary header + chunks
    mat = pm.synthesize_proc_material("copper", seed=7, size=16)["shaders"]["gltf_material"]
    glb_path = mf.export_glb(boulder, tmp_path / "boulder.glb", material_gltf=mat)
    obj_path = mf.export_obj(arch, tmp_path / "arch.obj")
    glb = glb_path.read_bytes()
    magic, version, total_len = struct.unpack_from("<4sII", glb, 0)
    assert magic == b"glTF" and version == 2 and total_len == len(glb)
    json_len, json_type = struct.unpack_from("<II", glb, 12)
    assert json_type == 0x4E4F534A
    gltf_doc = json.loads(glb[20:20 + json_len].decode("utf-8"))
    assert gltf_doc["asset"]["version"] == "2.0"
    assert gltf_doc["materials"][0]["name"] == "proc_copper"
    assert "f " in obj_path.read_text(encoding="utf-8")

    # Planted-failure control 1: push a vertex outside its meshlet bounding sphere -> REJECTED
    corrupted = copy.deepcopy(boulder)
    corrupted.vertices[0] = corrupted.vertices[0] + np.array([50.0, 0.0, 0.0], dtype=np.float32)
    ok_bad, errs_bad = mf.verify_meshlets(corrupted)
    assert not ok_bad and any("exceeds sphere radius" in e for e in errs_bad)

    # Planted-failure control 2: oversized meshlet (>64 verts) -> REJECTED
    oversized = copy.deepcopy(boulder)
    oversized.meshlets[0].vertex_count = 65
    ok_ov, errs_ov = mf.verify_meshlets(oversized)
    assert not ok_ov and any("vertex_count" in e for e in errs_ov)


def test_engine_receipt_sealing_and_planted_tamper_rejection(tmp_path: Path):
    """Exported GLB seals into canonical engine-receipt/1; 1-byte tamper is caught."""
    boulder = mf.build_sdf_boulder(seed=2026)
    glb_path = mf.export_glb(boulder, tmp_path / "asset.glb")
    rec_path = tmp_path / "asset.receipt.json"
    rec = mf.emit_asset_receipt(
        out_path=rec_path,
        task_id="proc-asset-boulder",
        artifact_paths=[glb_path],
        oracle_cmd=[sys.executable, "-c", "print('[PASS] meshlet and glb verified')"],
        root=tmp_path,
    )
    assert rec["schema"] == "engine-receipt/1"
    assert rec["verdict"] == "MATCH"
    assert mf.verify_asset_receipt(rec_path, check_files=True) == (True, [])

    # Planted 1-byte tamper on exported .glb -> caught by SHA-256 file verification
    buf = bytearray(glb_path.read_bytes())
    buf[-1] ^= 0xFF
    glb_path.write_bytes(bytes(buf))
    ok, errs = mf.verify_asset_receipt(rec_path, check_files=True)
    assert not ok and any("artifact SHA-256 drift" in e for e in errs)
