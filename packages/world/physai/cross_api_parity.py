# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Unified Live WebGPU + Native DX12 Scene-Graph Certificate Parity (superframe.cross-api-parity/v1).

Implements Wave 27C / WAVE25I Pillar #4:
- Quantized 100 Hz fixed-point scene-graph state hash H_state(t) (15.26 um lattice, 0-bit drift).
- Dual-target BuildLang compilation of native/bld/scene_parity_probe.bld to WGSL and HLSL.
- 64x64 f32 readback radiometric envelope: max_abs_lin <= 2^-10, PSNR >= 60 dB, p99 OKLab DeltaE <= 0.002.
- Offline fail-closed superframe.cross-api-parity/v1 certificate emission and verification.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
import math
import shutil
import struct
import subprocess
import sys
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Mapping, Sequence

import numpy as np

from .latency_sim import SIM_DT, SIM_HZ

SCHEMA_ID = "superframe.cross-api-parity/v1"
CPP_STILL_LIFE_PIN = "0x8e70a9159d2007bf"
MAX_ABS_LIN_BOUND = 2.0 ** -10
MIN_PSNR_DB_BOUND = 60.0
MAX_P99_OKLAB_DELTA_E_BOUND = 0.002
FNV_START = 1469598103934665603
FNV_PRIME = 1099511628211

_COLOUR_DIR = Path(__file__).resolve().parents[2] / "colour" / "build-color" / "build_color"


def _load_colour_module(name: str):
    key = f"wave27c_build_color_{name}"
    if key in sys.modules:
        return sys.modules[key]
    spec = importlib.util.spec_from_file_location(key, _COLOUR_DIR / f"{name}.py")
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[key] = mod
    spec.loader.exec_module(mod)
    return mod


@dataclass(frozen=True)
class RadiometricParity:
    max_abs_lin: float
    psnr_db: float
    p99_oklab_delta_e: float
    max_oklab_delta_e: float


@dataclass(frozen=True)
class DualTargetBuild:
    shader_source_sha256: str
    wgsl_sha256: str
    hlsl_sha256: str
    wgsl_live_compiled: bool
    hlsl_live_compiled: bool


def _sha256_bytes(data: bytes) -> str:
    return "sha256:" + hashlib.sha256(data).hexdigest()


def _sqrt_f32_arr(v: np.ndarray) -> np.ndarray:
    vf, half, zero = np.asarray(v, dtype=np.float32), np.float32(0.5), np.float32(0.0)
    pos = vf > zero
    safe_g = np.where(pos, np.float32(vf * half + half), np.float32(1.0)).astype(np.float32)
    for _ in range(8):
        safe_g = (half * (safe_g + vf / safe_g)).astype(np.float32)
    return np.where(pos, safe_g, zero).astype(np.float32)


def advance_probe_state_100hz(ticks: int) -> tuple[list[tuple[float, ...]], list[float]]:
    """Advance deterministic 100 Hz (dt=0.01 s) 6-DOF probe state with zero trig drift."""
    px, vx = 0.35, 0.0
    for _ in range(ticks):
        vx = vx + (-4.0 * px - 0.35 * vx) * SIM_DT
        px = px + vx * SIM_DT
    py, pz, th = 1.15 + 0.12 * px, -0.25 * vx, 0.25 * px
    qn = math.sqrt(1.0 + th * th)
    pose = (px, py, pz, th / qn, 0.0, 0.0, 1.0 / qn)
    slen = float(_sqrt_f32_arr(np.array([np.float32(-0.45) ** 2 + np.float32(0.78) ** 2 + np.float32(0.42) ** 2]))[0])
    sun = tuple(float(np.float32(c) / np.float32(slen)) for c in (-0.45, 0.78, 0.42))
    return [pose], [float(np.float32(px)), float(np.float32(py)), float(np.float32(pz)), *sun]


def quantize_scene_state_hash(poses: Sequence[tuple[float, ...]]) -> str:
    """Compute SHA-256 over signed int32 fixed-point quantized poses (p*2^16, q*2^15)."""
    buf = bytearray()
    for px, py, pz, qx, qy, qz, qw in poses:
        vals = [int(math.floor(v * 65536.0 + 0.5)) for v in (px, py, pz)] + [
            int(math.floor(v * 32768.0 + 0.5)) for v in (qx, qy, qz, qw)
        ]
        buf.extend(struct.pack("<7i", *vals))
    return _sha256_bytes(bytes(buf))


def fnv1a_f32_hex(buf: np.ndarray) -> str:
    """Renderer-compatible FNV-1a over IEEE-754 little-endian f32 bytes."""
    raw = np.ascontiguousarray(buf, dtype="<f4").tobytes()
    h = FNV_START
    mask = (1 << 64) - 1
    for b in raw:
        h = ((h ^ b) * FNV_PRIME) & mask
    return f"{h:016x}"


def _apply_planted_fault(img: np.ndarray, fault: str | None) -> np.ndarray:
    if fault is None:
        return img
    if fault == "gamma_curve":
        out = img.copy()
        out[..., :3] = np.power(np.clip(out[..., :3], 0.0, 1.0), 1.0 / 2.2).astype(np.float32)
        return out
    if fault == "rb_channel_swap":
        return img[..., [2, 1, 0, 3]].copy()
    raise ValueError(f"unknown planted fault: {fault}")


def render_scene_parity_probe_64x64(
    state_vec: Sequence[float],
    *,
    w: int = 64,
    h: int = 64,
    fault: str | None = None,
) -> np.ndarray:
    """Evaluate exact f32 scene_parity_probe.bld kernel on a 64x64 grid (optional planted fault)."""
    sx, sy, sz, sun_x, sun_y, sun_z = [np.float32(v) for v in state_vec[:6]]
    ys, xs = np.meshgrid(np.arange(h, dtype=np.float32), np.arange(w, dtype=np.float32), indexing="ij")
    half, one, two, zero = np.float32(0.5), np.float32(1.0), np.float32(2.0), np.float32(0.0)
    u = ((xs + half) / np.float32(w) * two - one).astype(np.float32)
    v = (one - (ys + half) / np.float32(h) * two).astype(np.float32)
    rdx, rdy, rdz = (u * np.float32(0.72)).astype(np.float32), (v * np.float32(0.72) - np.float32(0.095)).astype(np.float32), np.full_like(u, -one)
    rlen = _sqrt_f32_arr((rdx * rdx + rdy * rdy + rdz * rdz).astype(np.float32))
    dx, dy, dz = (rdx / rlen).astype(np.float32), (rdy / rlen).astype(np.float32), (rdz / rlen).astype(np.float32)

    sky_t = np.clip((dy * np.float32(1.6) + np.float32(0.25)).astype(np.float32), zero, one)
    cr = (np.float32(0.78) + (np.float32(0.34) - np.float32(0.78)) * sky_t).astype(np.float32)
    cg = (np.float32(0.81) + (np.float32(0.50) - np.float32(0.81)) * sky_t).astype(np.float32)
    cb = (np.float32(0.86) + (np.float32(0.78) - np.float32(0.86)) * sky_t).astype(np.float32)
    best_t, oy, oz = np.full_like(u, np.float32(1000000.0)), np.float32(1.4), np.float32(4.2)

    safe_dy = np.where(dy < np.float32(-0.0001), dy, np.float32(-1.0)).astype(np.float32)
    tg = (-oy / safe_dy).astype(np.float32)
    gx, gz = (tg * dx).astype(np.float32), (oz + tg * dz).astype(np.float32)
    hit_g = (dy < np.float32(-0.0001)) & (tg > np.float32(0.001)) & (tg < best_t) & (gx > np.float32(-12.0)) & (gx < np.float32(12.0)) & (gz > np.float32(-12.0)) & (gz < np.float32(12.0))
    nl_g = max(zero, sun_y)
    best_t = np.where(hit_g, tg, best_t).astype(np.float32)
    cr = np.where(hit_g, np.float32(0.34) * (np.float32(1.85) * nl_g + np.float32(0.35)), cr).astype(np.float32)
    cg = np.where(hit_g, np.float32(0.32) * (np.float32(1.72) * nl_g + np.float32(0.35)), cg).astype(np.float32)
    cb = np.where(hit_g, np.float32(0.27) * (np.float32(1.55) * nl_g + np.float32(0.35)), cb).astype(np.float32)

    qx, qy, qz = (zero - sx), (oy - sy), (oz - sz)
    b = (qx * dx + qy * dy + qz * dz).astype(np.float32)
    disc = (b * b - (np.float32(qx * qx + qy * qy + qz * qz) - np.float32(0.7225))).astype(np.float32)
    ts = (-b - _sqrt_f32_arr(np.where(disc >= zero, disc, zero))).astype(np.float32)
    hit_s = (disc >= zero) & (ts > np.float32(0.001)) & (ts < best_t)
    nx, ny, nz = ((qx + ts * dx) / np.float32(0.85)).astype(np.float32), ((qy + ts * dy) / np.float32(0.85)).astype(np.float32), ((qz + ts * dz) / np.float32(0.85)).astype(np.float32)
    nl = np.maximum(zero, (nx * sun_x + ny * sun_y + nz * sun_z).astype(np.float32))
    amb_t = (half + half * ny).astype(np.float32)
    ar = (np.float32(0.22) + (np.float32(0.42) - np.float32(0.22)) * amb_t).astype(np.float32)
    ag = (np.float32(0.20) + (np.float32(0.55) - np.float32(0.20)) * amb_t).astype(np.float32)
    ab = (np.float32(0.18) + (np.float32(0.80) - np.float32(0.18)) * amb_t).astype(np.float32)
    cr = np.where(hit_s, np.float32(0.84) * (np.float32(2.10) * nl + ar), cr).astype(np.float32)
    cg = np.where(hit_s, np.float32(0.42) * (np.float32(1.95) * nl + ag), cg).astype(np.float32)
    cb = np.where(hit_s, np.float32(0.28) * (np.float32(1.75) * nl + ab), cb).astype(np.float32)
    img = np.stack([cr, cg, cb, np.ones_like(cr, dtype=np.float32)], axis=-1)
    return _apply_planted_fault(img, fault)


def compute_radiometric_parity(img_wgpu: np.ndarray, img_dx12: np.ndarray) -> RadiometricParity:
    """Compute linear L_inf error, tonemapped PSNR (dB), and OKLab p99/max DeltaE."""
    a = np.asarray(img_wgpu, dtype=np.float64)[..., :3]
    b = np.asarray(img_dx12, dtype=np.float64)[..., :3]
    if a.shape != b.shape:
        raise ValueError(f"shape mismatch: {a.shape} vs {b.shape}")
    max_abs_lin = float(np.max(np.abs(a - b)))
    tonemap_mod = _load_colour_module("tonemap")
    spaces_mod = _load_colour_module("spaces")
    tm_a = tonemap_mod.aces_filmic(np.maximum(a, 0.0))
    tm_b = tonemap_mod.aces_filmic(np.maximum(b, 0.0))
    mse = float(np.mean((tm_a - tm_b) ** 2))
    psnr_db = 999.0 if mse <= 1e-18 else float(10.0 * math.log10(1.0 / mse))
    lab_a = spaces_mod.linear_srgb_to_oklab(tm_a.reshape(-1, 3))
    lab_b = spaces_mod.linear_srgb_to_oklab(tm_b.reshape(-1, 3))
    de = np.linalg.norm(lab_a - lab_b, axis=-1)
    return RadiometricParity(
        max_abs_lin=max_abs_lin,
        psnr_db=psnr_db,
        p99_oklab_delta_e=float(np.percentile(de, 99.0)),
        max_oklab_delta_e=float(np.max(de)),
    )


def compile_dual_target_shaders(
    shader_bld: Path,
    out_dir: Path,
    buildc: str | None = None,
) -> DualTargetBuild:
    """Compile a single BuildLang GPU scene kernel to both --target wgsl and --target hlsl."""
    src_bytes = shader_bld.read_bytes()
    out_dir.mkdir(parents=True, exist_ok=True)
    wgsl_path = out_dir / (shader_bld.stem + ".wgsl")
    hlsl_path = out_dir / (shader_bld.stem + ".hlsl")
    exe = buildc or shutil.which("buildc")
    if not exe:
        raise RuntimeError("buildc executable not found for dual-target shader compilation")
    for target, dst in (("wgsl", wgsl_path), ("hlsl", hlsl_path)):
        res = subprocess.run([exe, str(shader_bld), "--target", target, "-o", str(dst)], capture_output=True, text=True, check=False)
        if res.returncode != 0:
            raise RuntimeError(f"buildc --target {target} failed: {res.stdout}\n{res.stderr}")
    return DualTargetBuild(
        shader_source_sha256=_sha256_bytes(src_bytes),
        wgsl_sha256=_sha256_bytes(wgsl_path.read_bytes()),
        hlsl_sha256=_sha256_bytes(hlsl_path.read_bytes()),
        wgsl_live_compiled=True,
        hlsl_live_compiled=True,
    )


def _seal_certificate_body(body: Mapping[str, object]) -> str:
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    return _sha256_bytes(raw)


def emit_cross_api_parity_certificate(
    *, state_tick: int, state_hash_wgpu: str, state_hash_dx12: str,
    img_wgpu: np.ndarray, img_dx12: np.ndarray, reference_frame_fnv1a: str,
    shader_source_sha256: str, wgsl_sha256: str, hlsl_sha256: str,
    cpp_reference_pin: str = CPP_STILL_LIFE_PIN,
) -> dict[str, object]:
    """Emit a sealed superframe.cross-api-parity/v1 certificate with fail-closed verdict."""
    rad = compute_radiometric_parity(img_wgpu, img_dx12)
    reasons: list[str] = []
    if state_hash_wgpu != state_hash_dx12:
        reasons.append("state_hash_divergence")
    if rad.max_abs_lin > MAX_ABS_LIN_BOUND:
        reasons.append("max_abs_lin_exceeded")
    if rad.psnr_db < MIN_PSNR_DB_BOUND:
        reasons.append("psnr_below_60db")
    if rad.p99_oklab_delta_e > MAX_P99_OKLAB_DELTA_E_BOUND:
        reasons.append("oklab_p99_delta_e_exceeded")
    body: dict[str, object] = {
        "schema": SCHEMA_ID, "sim_hz": SIM_HZ, "state_tick": int(state_tick),
        "shader_source_sha256": shader_source_sha256, "wgsl_sha256": wgsl_sha256, "hlsl_sha256": hlsl_sha256,
        "cpp_reference_pin": cpp_reference_pin, "reference_frame_fnv1a": reference_frame_fnv1a,
        "wgpu_frame_fnv1a": fnv1a_f32_hex(img_wgpu), "dx12_frame_fnv1a": fnv1a_f32_hex(img_dx12),
        "state_hash_wgpu": state_hash_wgpu, "state_hash_dx12": state_hash_dx12,
        "state_hash_parity": state_hash_wgpu == state_hash_dx12, "metrics": asdict(rad),
        "bounds": {"max_abs_lin": MAX_ABS_LIN_BOUND, "min_psnr_db": MIN_PSNR_DB_BOUND, "max_p99_oklab_delta_e": MAX_P99_OKLAB_DELTA_E_BOUND},
        "verdict": "PASS" if not reasons else "FAIL", "reasons": reasons,
    }
    return {**body, "certificate_sha256": _seal_certificate_body(body)}


def verify_cross_api_parity_certificate(cert: Mapping[str, object]) -> tuple[bool, list[str]]:
    """Verify a superframe.cross-api-parity/v1 certificate offline (fail-closed)."""
    errors: list[str] = []
    if cert.get("schema") != SCHEMA_ID:
        errors.append("invalid_schema")
    body = {k: v for k, v in cert.items() if k != "certificate_sha256"}
    expected_sha = _seal_certificate_body(body)
    if cert.get("certificate_sha256") != expected_sha:
        errors.append("certificate_sha256_mismatch")
    metrics = cert.get("metrics") or {}
    if cert.get("state_hash_wgpu") != cert.get("state_hash_dx12"):
        errors.append("state_hash_divergence")
    if float(metrics.get("max_abs_lin", 1.0)) > MAX_ABS_LIN_BOUND:
        errors.append("max_abs_lin_exceeded")
    if float(metrics.get("psnr_db", 0.0)) < MIN_PSNR_DB_BOUND:
        errors.append("psnr_below_60db")
    if float(metrics.get("p99_oklab_delta_e", 1.0)) > MAX_P99_OKLAB_DELTA_E_BOUND:
        errors.append("oklab_p99_delta_e_exceeded")
    if cert.get("verdict") != "PASS":
        errors.append("verdict_not_pass")
    return len(errors) == 0, errors
