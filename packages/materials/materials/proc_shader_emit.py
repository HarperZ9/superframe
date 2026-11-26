# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""WGSL, HLSL SM 6.6+, and glTF 2.0 material emitters for proc-material/1 definitions."""
from __future__ import annotations

import numpy as np


def _fmt_vec3(rgb: tuple[float, float, float]) -> str:
    return f"{rgb[0]:.6f}, {rgb[1]:.6f}, {rgb[2]:.6f}"


def _shader_params(spec: dict) -> dict[str, float | tuple[float, float, float]]:
    d65 = tuple(float(c) for c in spec["illuminant_srgb"]["D65"])
    n_rgb = tuple(float(c) for c in spec["optical_summary"]["n_rgb"])
    k_rgb = tuple(float(c) for c in spec["optical_summary"]["k_rgb"])
    weather = spec["weather"]
    return {
        "albedo": d65,
        "n_rgb": n_rgb,
        "k_rgb": k_rgb,
        "roughness": float(spec["recipe"]["roughness_base"]),
        "conductor": 1.0 if spec["optical_summary"]["conductor"] else 0.0,
        "wetness": float(weather["wetness"]),
        "moss": float(weather["moss"]),
        "snow": float(weather["snow"]),
        "oxidation": float(weather["oxidation"]),
    }


_WGSL_BODY = """
fn fresnel_complex_unpol(n: f32, k: f32, cos_i: f32) -> f32 {
    let ci: f32 = clamp(cos_i, 0.0001, 1.0);
    let s2: f32 = max(0.0, 1.0 - ci * ci);
    let t0: f32 = n * n - k * k - s2;
    let a2b2: f32 = sqrt(max(0.0, t0 * t0 + 4.0 * n * n * k * k));
    let a: f32 = sqrt(max(0.0, 0.5 * (a2b2 + t0)));
    let rs: f32 = (a2b2 + ci * ci - 2.0 * a * ci) / max(1e-6, a2b2 + ci * ci + 2.0 * a * ci);
    let c2: f32 = ci * ci;
    let t1: f32 = a2b2 * c2 + s2 * s2;
    let t2: f32 = 2.0 * a * ci * s2;
    let rp: f32 = rs * (t1 - t2) / max(1e-6, t1 + t2);
    return clamp(0.5 * (rs + rp), 0.0, 1.0);
}

fn ggx_d(ndoth: f32, alpha: f32) -> f32 {
    let a2: f32 = alpha * alpha;
    let d: f32 = ndoth * ndoth * (a2 - 1.0) + 1.0;
    return a2 / max(1e-6, 3.14159265 * d * d);
}

fn smith_g1(ndotx: f32, alpha: f32) -> f32 {
    let a2: f32 = alpha * alpha;
    return 2.0 * ndotx / max(1e-6, ndotx + sqrt(a2 + (1.0 - a2) * ndotx * ndotx));
}

fn eval_proc_material(nrm: vec3f, v: vec3f, l: vec3f, rough_in: f32) -> vec3f {
    let h: vec3f = normalize(v + l);
    let ndotv: f32 = max(dot(nrm, v), 0.001);
    let ndotl: f32 = max(dot(nrm, l), 0.0);
    let ndoth: f32 = max(dot(nrm, h), 0.0);
    let vdoth: f32 = max(dot(v, h), 0.0);
    let rough: f32 = mix(rough_in, 0.08, PM.weather.x);
    let alpha: f32 = max(rough * rough, 0.001);
    let f: vec3f = vec3f(
        fresnel_complex_unpol(PM.n_rgb.x, PM.k_rgb.x, vdoth),
        fresnel_complex_unpol(PM.n_rgb.y, PM.k_rgb.y, vdoth),
        fresnel_complex_unpol(PM.n_rgb.z, PM.k_rgb.z, vdoth));
    let spec: f32 = ggx_d(ndoth, alpha) * smith_g1(ndotv, alpha) * smith_g1(ndotl, alpha) / (4.0 * ndotv * max(ndotl, 0.001));
    let base_col: vec3f = mix(PM.albedo_rough.xyz, vec3f(0.92, 0.94, 0.97), PM.weather.z);
    let diff: vec3f = (vec3f(1.0) - f) * base_col * (1.0 - PM_IS_CONDUCTOR) / 3.14159265;
    return (f * spec + diff) * ndotl;
}
"""

_HLSL_BODY = """
float fresnel_complex_unpol(float n, float k, float cos_i) {
    float ci = clamp(cos_i, 0.0001f, 1.0f);
    float s2 = max(0.0f, 1.0f - ci * ci);
    float t0 = n * n - k * k - s2;
    float a2b2 = sqrt(max(0.0f, t0 * t0 + 4.0f * n * n * k * k));
    float a = sqrt(max(0.0f, 0.5f * (a2b2 + t0)));
    float rs = (a2b2 + ci * ci - 2.0f * a * ci) / max(1e-6f, a2b2 + ci * ci + 2.0f * a * ci);
    float t1 = a2b2 * ci * ci + s2 * s2;
    float t2 = 2.0f * a * ci * s2;
    float rp = rs * (t1 - t2) / max(1e-6f, t1 + t2);
    return saturate(0.5f * (rs + rp));
}

float ggx_d(float ndoth, float alpha) {
    float a2 = alpha * alpha;
    float d = ndoth * ndoth * (a2 - 1.0f) + 1.0f;
    return a2 / max(1e-6f, 3.14159265f * d * d);
}

float smith_g1(float ndotx, float alpha) {
    float a2 = alpha * alpha;
    return 2.0f * ndotx / max(1e-6f, ndotx + sqrt(a2 + (1.0f - a2) * ndotx * ndotx));
}

float3 eval_proc_material(float3 nrm, float3 v, float3 l, float rough_in) {
    float3 h = normalize(v + l);
    float ndotv = max(dot(nrm, v), 0.001f);
    float ndotl = max(dot(nrm, l), 0.0f);
    float ndoth = max(dot(nrm, h), 0.0f);
    float vdoth = max(dot(v, h), 0.0f);
    float rough = lerp(rough_in, 0.08f, PM.weather.x);
    float alpha = max(rough * rough, 0.001f);
    float3 f = float3(
        fresnel_complex_unpol(PM.n_rgb.x, PM.k_rgb.x, vdoth),
        fresnel_complex_unpol(PM.n_rgb.y, PM.k_rgb.y, vdoth),
        fresnel_complex_unpol(PM.n_rgb.z, PM.k_rgb.z, vdoth));
    float spec = ggx_d(ndoth, alpha) * smith_g1(ndotv, alpha) * smith_g1(ndotl, alpha) / (4.0f * ndotv * max(ndotl, 0.001f));
    float3 base_col = lerp(PM.albedo_rough.xyz, float3(0.92f, 0.94f, 0.97f), PM.weather.z);
    float3 diff = (1.0f - f) * base_col * (1.0f - PM_IS_CONDUCTOR) / 3.14159265f;
    return (f * spec + diff) * ndotl;
}
"""


def emit_wgsl_shader(spec: dict) -> str:
    """Emit ready-to-compile WGSL snippet carrying complex Fresnel, GGX+Smith, and weather coupling."""
    p = _shader_params(spec)
    header = "\n".join([
        f"// Generated proc-material/1 WGSL shader for measured material: {spec['material_id']}",
        "struct ProcMaterialParams { n_rgb: vec4f, k_rgb: vec4f, albedo_rough: vec4f, weather: vec4f };",
        "@group(0) @binding(0) var<uniform> PM: ProcMaterialParams;",
        f"const PM_DEFAULT_N: vec3f = vec3f({_fmt_vec3(p['n_rgb'])});",
        f"const PM_DEFAULT_K: vec3f = vec3f({_fmt_vec3(p['k_rgb'])});",
        f"const PM_DEFAULT_ALBEDO: vec3f = vec3f({_fmt_vec3(p['albedo'])});",
        f"const PM_DEFAULT_ROUGH: f32 = {p['roughness']:.6f};",
        f"const PM_IS_CONDUCTOR: f32 = {p['conductor']:.1f};",
    ])
    return header + "\n" + _WGSL_BODY


def emit_hlsl_shader(spec: dict) -> str:
    """Emit ready-to-compile HLSL SM 6.6+ shader snippet for RAW DX12 integration."""
    p = _shader_params(spec)
    header = "\n".join([
        f"// Generated proc-material/1 HLSL SM 6.6+ snippet for measured material: {spec['material_id']}",
        "struct ProcMaterialParams { float4 n_rgb; float4 k_rgb; float4 albedo_rough; float4 weather; };",
        "ConstantBuffer<ProcMaterialParams> PM : register(b0);",
        f"static const float3 PM_DEFAULT_N = float3({_fmt_vec3(p['n_rgb'])});",
        f"static const float3 PM_DEFAULT_K = float3({_fmt_vec3(p['k_rgb'])});",
        f"static const float3 PM_DEFAULT_ALBEDO = float3({_fmt_vec3(p['albedo'])});",
        f"static const float PM_DEFAULT_ROUGH = {p['roughness']:.6f}f;",
        f"static const float PM_IS_CONDUCTOR = {p['conductor']:.1f}f;",
    ])
    return header + "\n" + _HLSL_BODY


def emit_gltf_material(spec: dict) -> dict:
    """Emit glTF 2.0 material JSON carrying PBR, KHR_materials_ior, and full spectral extras."""
    p = _shader_params(spec)
    albedo = p["albedo"]
    conductor = bool(spec["optical_summary"]["conductor"])
    n_mean = float(spec["optical_summary"]["n_mean"])
    return {
        "name": f"proc_{spec['material_id']}",
        "pbrMetallicRoughness": {
            "baseColorFactor": [round(albedo[0], 6), round(albedo[1], 6), round(albedo[2], 6), 1.0],
            "metallicFactor": 1.0 if conductor else 0.0,
            "roughnessFactor": round(float(p["roughness"]), 6),
        },
        "extensions": {
            "KHR_materials_ior": {"ior": round(max(1.0, n_mean), 4)},
        },
        "extras": {
            "schema": spec["schema"],
            "material_id": spec["material_id"],
            "seed": spec["seed"],
            "illuminant_srgb": spec["illuminant_srgb"],
            "optical_summary": spec["optical_summary"],
            "weather": spec["weather"],
            "map_digest_sha256": spec["map_digest_sha256"],
        },
    }


def verify_tileable_seam(field_fn, size: int) -> float:
    """Return max absolute wrap delta between f(u=0,v) vs f(u=1,v) and f(u,v=0) vs f(u,v=1)."""
    coords = np.linspace(0.0, 1.0, size, endpoint=False)
    u0 = np.zeros(size, dtype=np.float64)
    u1 = np.ones(size, dtype=np.float64)
    dx = np.max(np.abs(field_fn(u0, coords) - field_fn(u1, coords)))
    dy = np.max(np.abs(field_fn(coords, u0) - field_fn(coords, u1)))
    return float(max(dx, dy))
