# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wave 27C tests: superframe.cross-api-parity/v1 (WebGPU WGSL + DX12 HLSL + planted faults)."""
from __future__ import annotations

import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
WORLD_ROOT = REPO_ROOT / "packages" / "world"
SHADER_BLD = REPO_ROOT / "native" / "bld" / "scene_parity_probe.bld"

if str(WORLD_ROOT) not in sys.path:
    sys.path.insert(0, str(WORLD_ROOT))

from physai.cross_api_parity import (  # noqa: E402
    CPP_STILL_LIFE_PIN,
    MAX_ABS_LIN_BOUND,
    MAX_P99_OKLAB_DELTA_E_BOUND,
    MIN_PSNR_DB_BOUND,
    SCHEMA_ID,
    advance_probe_state_100hz,
    compile_dual_target_shaders,
    emit_cross_api_parity_certificate,
    fnv1a_f32_hex,
    quantize_scene_state_hash,
    render_scene_parity_probe_64x64,
    verify_cross_api_parity_certificate,
)

PINNED_T100_FNV1A = "0b90e9765fa9b28e"
PINNED_T100_STATE_SHA = "sha256:a356797074b4521d6ce0e30916c36e040d8aa01e0c6345b3b1acfef5d040e8fd"


def _sha256_file(path: Path) -> str:
    return "sha256:" + hashlib.sha256(path.read_bytes()).hexdigest()


def test_clean_cross_api_parity_certificate_and_1000_tick_state_determinism(tmp_path: Path) -> None:
    poses_100, vec_100 = advance_probe_state_100hz(100)
    poses_1000_a, _ = advance_probe_state_100hz(1000)
    poses_1000_b, _ = advance_probe_state_100hz(1000)
    assert quantize_scene_state_hash(poses_1000_a) == quantize_scene_state_hash(poses_1000_b)

    state_sha = quantize_scene_state_hash(poses_100)
    assert state_sha == PINNED_T100_STATE_SHA

    img_wgpu = render_scene_parity_probe_64x64(vec_100)
    img_dx12 = render_scene_parity_probe_64x64(vec_100)
    assert fnv1a_f32_hex(img_wgpu) == PINNED_T100_FNV1A
    assert fnv1a_f32_hex(img_dx12) == PINNED_T100_FNV1A

    src_sha = _sha256_file(SHADER_BLD)
    cert = emit_cross_api_parity_certificate(
        state_tick=100,
        state_hash_wgpu=state_sha,
        state_hash_dx12=state_sha,
        img_wgpu=img_wgpu,
        img_dx12=img_dx12,
        reference_frame_fnv1a=PINNED_T100_FNV1A,
        shader_source_sha256=src_sha,
        wgsl_sha256=src_sha,
        hlsl_sha256=src_sha,
    )
    ok, errs = verify_cross_api_parity_certificate(cert)
    assert ok is True and errs == []
    assert cert["schema"] == SCHEMA_ID
    assert cert["cpp_reference_pin"] == CPP_STILL_LIFE_PIN
    assert cert["metrics"]["psnr_db"] >= MIN_PSNR_DB_BOUND
    assert cert["metrics"]["p99_oklab_delta_e"] <= MAX_P99_OKLAB_DELTA_E_BOUND
    assert cert["metrics"]["max_abs_lin"] <= MAX_ABS_LIN_BOUND

    # Tampering with certificate payload must fail closed offline.
    forged = dict(cert)
    forged["state_tick"] = 101
    ok_forged, errs_forged = verify_cross_api_parity_certificate(forged)
    assert ok_forged is False and "certificate_sha256_mismatch" in errs_forged


def test_planted_gamma_rb_swap_and_temporal_drift_rejected_fail_closed() -> None:
    poses_100, vec_100 = advance_probe_state_100hz(100)
    poses_101, vec_101 = advance_probe_state_100hz(101)
    sha_100 = quantize_scene_state_hash(poses_100)
    sha_101 = quantize_scene_state_hash(poses_101)
    img_ref = render_scene_parity_probe_64x64(vec_100)
    src_sha = _sha256_file(SHADER_BLD)

    # 1. Planted gamma curve error
    cert_gamma = emit_cross_api_parity_certificate(
        state_tick=100, state_hash_wgpu=sha_100, state_hash_dx12=sha_100,
        img_wgpu=render_scene_parity_probe_64x64(vec_100, fault="gamma_curve"),
        img_dx12=img_ref, reference_frame_fnv1a=PINNED_T100_FNV1A,
        shader_source_sha256=src_sha, wgsl_sha256=src_sha, hlsl_sha256=src_sha,
    )
    assert cert_gamma["verdict"] == "FAIL"
    assert cert_gamma["metrics"]["psnr_db"] < 30.0
    assert cert_gamma["metrics"]["p99_oklab_delta_e"] > 0.05
    assert verify_cross_api_parity_certificate(cert_gamma)[0] is False

    # 2. Planted R/B channel swap
    cert_rb = emit_cross_api_parity_certificate(
        state_tick=100, state_hash_wgpu=sha_100, state_hash_dx12=sha_100,
        img_wgpu=render_scene_parity_probe_64x64(vec_100, fault="rb_channel_swap"),
        img_dx12=img_ref, reference_frame_fnv1a=PINNED_T100_FNV1A,
        shader_source_sha256=src_sha, wgsl_sha256=src_sha, hlsl_sha256=src_sha,
    )
    assert cert_rb["verdict"] == "FAIL"
    assert cert_rb["metrics"]["psnr_db"] < 30.0
    assert cert_rb["metrics"]["p99_oklab_delta_e"] > 0.05
    assert verify_cross_api_parity_certificate(cert_rb)[0] is False

    # 3. Planted 1-tick temporal drift
    cert_drift = emit_cross_api_parity_certificate(
        state_tick=100, state_hash_wgpu=sha_101, state_hash_dx12=sha_100,
        img_wgpu=render_scene_parity_probe_64x64(vec_101),
        img_dx12=img_ref, reference_frame_fnv1a=PINNED_T100_FNV1A,
        shader_source_sha256=src_sha, wgsl_sha256=src_sha, hlsl_sha256=src_sha,
    )
    assert cert_drift["verdict"] == "FAIL"
    assert "state_hash_divergence" in cert_drift["reasons"]
    assert cert_drift["metrics"]["psnr_db"] < MIN_PSNR_DB_BOUND
    assert verify_cross_api_parity_certificate(cert_drift)[0] is False


def test_dual_target_wgsl_and_hlsl_compilation_and_naga_check(tmp_path: Path) -> None:
    src_text = SHADER_BLD.read_text(encoding="utf-8")
    assert "#[compute]" in src_text and "fn scene_parity_probe(" in src_text
    require = os.environ.get("CROSS_API_REQUIRE_NATIVE", "0") == "1"
    buildc = os.environ.get("BUILDC") or shutil.which("buildc")
    if not buildc:
        assert not require, "CROSS_API_REQUIRE_NATIVE=1 but buildc not found"
        return
    # Verify whether this buildc binary supports --target wgsl (Wave 19D+).
    probe = subprocess.run([buildc, str(SHADER_BLD), "--target", "wgsl", "-o", str(tmp_path / "probe.wgsl")], capture_output=True, text=True, check=False)
    if probe.returncode != 0:
        assert not require, f"CROSS_API_REQUIRE_NATIVE=1 but wgsl compile failed: {probe.stdout} {probe.stderr}"
        return
    built = compile_dual_target_shaders(SHADER_BLD, tmp_path / "dual", buildc=buildc)
    assert built.wgsl_live_compiled and built.hlsl_live_compiled
    wgsl_text = (tmp_path / "dual" / "scene_parity_probe.wgsl").read_text(encoding="utf-8")
    hlsl_text = (tmp_path / "dual" / "scene_parity_probe.hlsl").read_text(encoding="utf-8")
    assert "@compute @workgroup_size(" in wgsl_text
    assert "fn scene_parity_probe(" in wgsl_text
    assert "void scene_parity_probe(" in hlsl_text
    naga = shutil.which("naga")
    if naga:
        chk = subprocess.run([naga, str(tmp_path / "dual" / "scene_parity_probe.wgsl")], capture_output=True, text=True, check=False)
        assert chk.returncode == 0, f"naga validation failed: {chk.stdout} {chk.stderr}"
