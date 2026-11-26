# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Megascans-surpassing resolution-independent spectral procedural material synthesizer.

Synthesizes proc-material/1 definitions directly from the 111 measured 380-780 nm
spectral materials plus optional distill_recipe/1 or design_parts descriptors.
Produces seamlessly tileable PBR+Spectral maps (height, tangent normal, roughness,
cavity/AO, wetness/moss/snow/oxidation weather masks) and emits WGSL, HLSL SM 6.6+,
and glTF 2.0 material snippets.
"""
from __future__ import annotations

import hashlib
import math
from typing import Callable

import numpy as np

from . import optics, spectral
from .proc_shader_emit import (  # noqa: F401
    emit_gltf_material,
    emit_hlsl_shader,
    emit_wgsl_shader,
    verify_tileable_seam,
)

SCHEMA = "proc-material/1"
_RGB_NM_INDICES = (
    spectral.GRID.index(630),
    spectral.GRID.index(530),
    spectral.GRID.index(460),
)


def _hash2_u32(ix: np.ndarray, iy: np.ndarray, seed: int) -> np.ndarray:
    h = (ix.astype(np.uint64) * np.uint64(374761393)
         + iy.astype(np.uint64) * np.uint64(668265263)
         + np.uint64(seed & 0xFFFFFFFF) * np.uint64(1442695041))
    h = (h ^ (h >> np.uint64(13))) * np.uint64(1274126177)
    h = h ^ (h >> np.uint64(16))
    return (h & np.uint64(0xFFFFFFFF)).astype(np.float64) / 4294967295.0


def periodic_value_noise(u: np.ndarray, v: np.ndarray, period: int, seed: int) -> np.ndarray:
    """Exact C1 periodic 2D value noise on torus [0, 1)^2 with integer wrap period."""
    p = max(1, int(period))
    x = np.mod(u, 1.0) * p
    y = np.mod(v, 1.0) * p
    x0 = np.floor(x).astype(np.int64) % p
    y0 = np.floor(y).astype(np.int64) % p
    x1 = (x0 + 1) % p
    y1 = (y0 + 1) % p
    fx = x - np.floor(x)
    fy = y - np.floor(y)
    sx = fx * fx * (3.0 - 2.0 * fx)
    sy = fy * fy * (3.0 - 2.0 * fy)
    n00 = _hash2_u32(x0, y0, seed)
    n10 = _hash2_u32(x1, y0, seed)
    n01 = _hash2_u32(x0, y1, seed)
    n11 = _hash2_u32(x1, y1, seed)
    nx0 = n00 * (1.0 - sx) + n10 * sx
    nx1 = n01 * (1.0 - sx) + n11 * sx
    return nx0 * (1.0 - sy) + nx1 * sy


def periodic_fbm_2d(
    u: np.ndarray,
    v: np.ndarray,
    base_period: int = 4,
    octaves: int = 4,
    seed: int = 202607,
) -> np.ndarray:
    """Multi-octave periodic fractional Brownian motion normalized to [0, 1]."""
    acc = np.zeros_like(u, dtype=np.float64)
    amp, total = 1.0, 0.0
    period = max(1, int(base_period))
    for k in range(octaves):
        acc += amp * periodic_value_noise(u, v, period, seed + k * 997)
        total += amp
        amp *= 0.5
        period *= 2
    return acc / max(total, 1e-12)


def periodic_worley_2d(
    u: np.ndarray,
    v: np.ndarray,
    cells: int = 6,
    seed: int = 202607,
) -> np.ndarray:
    """Exact periodic 2D cellular Worley F1 distance field in [0, 1]."""
    p = max(1, int(cells))
    x = np.mod(u, 1.0) * p
    y = np.mod(v, 1.0) * p
    ix = np.floor(x).astype(np.int64)
    iy = np.floor(y).astype(np.int64)
    fx = x - ix
    fy = y - iy
    min_d2 = np.full_like(x, 1e9, dtype=np.float64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx = (ix + dx) % p
            cy = (iy + dy) % p
            jx = _hash2_u32(cx, cy, seed + 17)
            jy = _hash2_u32(cx, cy, seed + 53)
            rx = dx + jx - fx
            ry = dy + jy - fy
            min_d2 = np.minimum(min_d2, rx * rx + ry * ry)
    return np.clip(np.sqrt(min_d2) / math.sqrt(2.0), 0.0, 1.0)


def build_height_evaluator(seed: int, grain_scale: int = 4) -> Callable[[np.ndarray, np.ndarray], np.ndarray]:
    """Return a deterministic C1-periodic continuous height evaluator h(u, v) in [0, 1]."""
    p = max(2, int(grain_scale))

    def _eval(u: np.ndarray, v: np.ndarray) -> np.ndarray:
        fbm = periodic_fbm_2d(u, v, base_period=p, octaves=4, seed=seed)
        worley = periodic_worley_2d(u, v, cells=p + 2, seed=seed + 31337)
        return np.clip(0.68 * fbm + 0.32 * (1.0 - worley), 0.0, 1.0)

    return _eval


def _tangent_normals_from_height(height: np.ndarray, strength: float = 2.0) -> np.ndarray:
    """Compute unit tangent-space normals using periodic central differences."""
    dhdx = 0.5 * (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * strength
    dhdy = 0.5 * (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * strength
    nx, ny = -dhdx, -dhdy
    nz = np.ones_like(height)
    inv = 1.0 / np.sqrt(nx * nx + ny * ny + nz * nz)
    return np.stack([nx * inv, ny * inv, nz * inv], axis=-1)


def _spectral_summary(record: dict) -> tuple[list[float], dict, dict]:
    n, k = optics.nk(record)
    if n is None:
        raise ValueError(f"{record.get('id')}: missing spectral optical constants")
    refl = [float(optics.normal_reflectance(nv, kv)) for nv, kv in zip(n, k)]
    conductor = bool((record.get("optics") or {}).get("conductor"))
    if not conductor:
        body = optics.body_albedo(record) or [0.0] * len(refl)
        refl = [min(1.0, max(0.0, r + (1.0 - r) ** 2 * b)) for r, b in zip(refl, body)]
    else:
        refl = [min(1.0, max(0.0, r)) for r in refl]
    previews = {
        illum: [round(c, 6) for c in spectral.reflectance_to_srgb(refl, illum)]
        for illum in ("D65", "A", "sodium")
    }
    ri, gi, bi = _RGB_NM_INDICES
    summary = {
        "conductor": conductor,
        "n_mean": round(float(sum(n) / len(n)), 6),
        "k_mean": round(float(sum(k) / len(k)), 6),
        "n_rgb": [round(float(n[ri]), 6), round(float(n[gi]), 6), round(float(n[bi]), 6)],
        "k_rgb": [round(float(k[ri]), 6), round(float(k[gi]), 6), round(float(k[bi]), 6)],
        "r_min": round(min(refl), 6),
        "r_max": round(max(refl), 6),
    }
    return refl, previews, summary


def _compute_weather_masks(height: np.ndarray, cavity: np.ndarray, normal: np.ndarray, weather: dict) -> dict:
    up = np.clip(normal[..., 2], 0.0, 1.0)
    wet = np.clip(float(weather["wetness"]) * (0.4 + 0.6 * (1.0 - height)), 0.0, 1.0)
    moss = np.clip(float(weather["moss"]) * np.power(up, 2.0) * (0.35 + 0.65 * cavity), 0.0, 1.0)
    snow = np.clip(float(weather["snow"]) * np.power(up, 3.0) * (0.5 + 0.5 * height), 0.0, 1.0)
    ox = np.clip(float(weather["oxidation"]) * (0.3 + 0.7 * (1.0 - cavity)), 0.0, 1.0)
    return {"wetness": wet, "moss": moss, "snow": snow, "oxidation": ox}


def _digest_maps(maps: dict) -> str:
    h = hashlib.sha256()
    for key in sorted(maps):
        val = maps[key]
        if isinstance(val, dict):
            for sub in sorted(val):
                h.update(f"{key}.{sub}:".encode("ascii"))
                h.update(np.ascontiguousarray(val[sub], dtype="<f4").tobytes())
        else:
            h.update(f"{key}:".encode("ascii"))
            h.update(np.ascontiguousarray(val, dtype="<f4").tobytes())
    return "sha256:" + h.hexdigest()


def _build_tileable_maps(height_fn, size: int, rec_cfg: dict, weather_cfg: dict) -> dict:
    axis = np.linspace(0.0, 1.0, size, endpoint=False)
    uu, vv = np.meshgrid(axis, axis, indexing="xy")
    height = height_fn(uu, vv)
    normal = _tangent_normals_from_height(height, strength=2.2)
    cavity = np.clip(1.0 - rec_cfg["cavity_strength"] * (1.0 - height), 0.0, 1.0)
    roughness = np.clip(rec_cfg["roughness_base"] + 0.18 * (0.5 - height), 0.04, 1.0)
    return {
        "height": height,
        "normal": normal,
        "roughness": roughness,
        "cavity_ao": cavity,
        "weather_masks": _compute_weather_masks(height, cavity, normal, weather_cfg),
    }


def synthesize_proc_material(
    material_id: str,
    seed: int = 202607,
    size: int = 64,
    recipe: dict | None = None,
    weather: dict | None = None,
) -> dict:
    """Synthesize a resolution-independent proc-material/1 package from a measured material."""
    from . import get as get_material

    rec_cfg = {
        "roughness_base": float((recipe or {}).get("roughness_base", 0.35)),
        "grain_scale": int((recipe or {}).get("grain_scale", 4)),
        "cavity_strength": float((recipe or {}).get("cavity_strength", 0.45)),
    }
    weather_cfg = {k: float((weather or {}).get(k, 0.0)) for k in ("wetness", "moss", "snow", "oxidation")}
    refl, previews, opt_summary = _spectral_summary(get_material(material_id))
    height_fn = build_height_evaluator(seed=seed, grain_scale=rec_cfg["grain_scale"])
    maps = _build_tileable_maps(height_fn, size, rec_cfg, weather_cfg)
    spec = {
        "schema": SCHEMA, "material_id": material_id, "seed": int(seed), "size": int(size),
        "recipe": rec_cfg, "weather": weather_cfg, "spectral_grid_nm": list(spectral.GRID),
        "spectral_reflectance": refl, "illuminant_srgb": previews, "optical_summary": opt_summary,
        "seam_delta": verify_tileable_seam(height_fn, size),
        "map_digest_sha256": _digest_maps(maps), "maps": maps,
    }
    spec["shaders"] = {
        "wgsl": emit_wgsl_shader(spec), "hlsl": emit_hlsl_shader(spec),
        "gltf_material": emit_gltf_material(spec),
    }
    return spec
