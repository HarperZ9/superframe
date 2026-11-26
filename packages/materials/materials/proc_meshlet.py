# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""DX12/WebGPU 64v/126t GPU meshlet cluster packer, OBJ/GLB exporters, and engine-receipt/1 hook."""
from __future__ import annotations

import json
import math
import struct
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Sequence

import numpy as np

_SUPERSTACK_DIR = Path(__file__).resolve().parents[2] / "superstack"
if str(_SUPERSTACK_DIR) not in sys.path:
    sys.path.insert(0, str(_SUPERSTACK_DIR))

import engine_receipt as _er  # noqa: E402


@dataclass
class MeshletDesc:
    """48-byte GPU meshlet descriptor matching RawMeshPipeline.h (<=64v, <=126t)."""
    vertex_offset: int
    triangle_offset: int
    vertex_count: int
    triangle_count: int
    bound_sphere: tuple[float, float, float, float]
    normal_cone: tuple[float, float, float, float]


@dataclass
class ProceduralMesh:
    """Unified procedural mesh carrying per-vertex attributes and 64v/126t meshlets."""
    name: str
    vertices: np.ndarray        # (V, 3) float32
    normals: np.ndarray         # (V, 3) float32
    uvs: np.ndarray             # (V, 2) float32
    meta: np.ndarray            # (V, 4) float32: bend_flex, wind_phase, part_tag, snow_mask
    indices: np.ndarray         # (T, 3) uint32 (local vertex indices inside each meshlet)
    meshlets: list[MeshletDesc] = field(default_factory=list)
    aabb_min: tuple[float, float, float] = (0.0, 0.0, 0.0)
    aabb_max: tuple[float, float, float] = (0.0, 0.0, 0.0)


def _compute_bounds_and_cone(
    verts: np.ndarray,
    tris: np.ndarray,
) -> tuple[tuple[float, float, float, float], tuple[float, float, float, float]]:
    """Compute exact enclosing bounding sphere and backface normal cone for one meshlet."""
    center = 0.5 * (verts.min(axis=0) + verts.max(axis=0))
    radius = float(np.linalg.norm(verts - center, axis=1).max()) if len(verts) else 0.0
    v0 = verts[tris[:, 0]]
    v1 = verts[tris[:, 1]]
    v2 = verts[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    lens = np.linalg.norm(fn, axis=1, keepdims=True)
    valid = lens[:, 0] > 1e-10
    if not np.any(valid):
        return (float(center[0]), float(center[1]), float(center[2]), radius), (0.0, 0.0, 1.0, -1.0)
    unit_n = fn[valid] / lens[valid]
    axis = unit_n.mean(axis=0)
    an = float(np.linalg.norm(axis))
    if an < 1e-8:
        return (float(center[0]), float(center[1]), float(center[2]), radius), (0.0, 0.0, 1.0, -1.0)
    axis = axis / an
    min_dot = float(np.clip(unit_n @ axis, -1.0, 1.0).min())
    half_angle = math.acos(min_dot)
    cutoff = -1.0 if half_angle >= 0.5 * math.pi else -math.sin(half_angle)
    return (
        (float(center[0]), float(center[1]), float(center[2]), radius),
        (float(axis[0]), float(axis[1]), float(axis[2]), float(cutoff)),
    )


def _group_triangles(sorted_tris: np.ndarray, max_verts: int, max_tris: int) -> list[tuple[list[int], list[tuple[int, int, int]]]]:
    clusters, cur_map, cur_verts, cur_tris = [], {}, [], []
    for tri in sorted_tris:
        new_v = [int(v) for v in tri if int(v) not in cur_map]
        if len(cur_tris) >= max_tris or (len(cur_verts) + len(new_v)) > max_verts:
            if cur_tris:
                clusters.append((list(cur_verts), list(cur_tris)))
            cur_map.clear(); cur_verts.clear(); cur_tris.clear()
        local = []
        for v in tri:
            iv = int(v)
            if iv not in cur_map:
                cur_map[iv] = len(cur_verts)
                cur_verts.append(iv)
            local.append(cur_map[iv])
        cur_tris.append((local[0], local[1], local[2]))
    if cur_tris:
        clusters.append((cur_verts, cur_tris))
    return clusters


def pack_meshlets(
    name: str,
    vertices: np.ndarray,
    normals: np.ndarray,
    uvs: np.ndarray,
    indices: np.ndarray,
    meta: np.ndarray | None = None,
    max_verts: int = 64,
    max_tris: int = 126,
) -> ProceduralMesh:
    """Pack an indexed triangle mesh into spatially coherent <=64v / <=126t GPU meshlets."""
    mv, mt = max(3, min(int(max_verts), 64)), max(1, min(int(max_tris), 126))
    v_arr = np.asarray(vertices, dtype=np.float32)
    n_arr = np.asarray(normals, dtype=np.float32)
    u_arr = np.asarray(uvs, dtype=np.float32)
    m_arr = np.zeros((len(v_arr), 4), dtype=np.float32) if meta is None else np.asarray(meta, dtype=np.float32)
    t_arr = np.asarray(indices, dtype=np.uint32).reshape(-1, 3)

    centroids = v_arr[t_arr].mean(axis=1)
    sorted_tris = t_arr[np.lexsort((centroids[:, 2], centroids[:, 1], centroids[:, 0]))]
    out_v, out_n, out_u, out_m, out_t, meshlets = [], [], [], [], [], []
    v_off, t_off = 0, 0
    for cur_verts, cur_tris in _group_triangles(sorted_tris, mv, mt):
        idx_arr = np.array(cur_verts, dtype=np.int64)
        mv_pos, mt_arr = v_arr[idx_arr], np.array(cur_tris, dtype=np.uint32)
        sphere, cone = _compute_bounds_and_cone(mv_pos, mt_arr)
        out_v.append(mv_pos); out_n.append(n_arr[idx_arr]); out_u.append(u_arr[idx_arr])
        out_m.append(m_arr[idx_arr]); out_t.append(mt_arr)
        meshlets.append(MeshletDesc(v_off, t_off, len(cur_verts), len(cur_tris), sphere, cone))
        v_off += len(cur_verts); t_off += len(cur_tris)

    pv = np.vstack(out_v) if out_v else np.zeros((0, 3), dtype=np.float32)
    pn = np.vstack(out_n) if out_n else np.zeros((0, 3), dtype=np.float32)
    pu = np.vstack(out_u) if out_u else np.zeros((0, 2), dtype=np.float32)
    pm = np.vstack(out_m) if out_m else np.zeros((0, 4), dtype=np.float32)
    pt = np.vstack(out_t) if out_t else np.zeros((0, 3), dtype=np.uint32)
    bmin = tuple(float(x) for x in pv.min(axis=0)) if len(pv) else (0.0, 0.0, 0.0)
    bmax = tuple(float(x) for x in pv.max(axis=0)) if len(pv) else (0.0, 0.0, 0.0)
    return ProceduralMesh(name, pv, pn, pu, pm, pt, meshlets, bmin, bmax)


def verify_meshlets(mesh: ProceduralMesh, max_verts: int = 64, max_tris: int = 126) -> tuple[bool, list[str]]:
    """Verify 64v/126t GPU meshlet limits, index bounds, and exact bounding-sphere enclosure."""
    errors: list[str] = []
    if not mesh.meshlets:
        errors.append("mesh has zero meshlets")
    for idx, ml in enumerate(mesh.meshlets):
        if ml.vertex_count == 0 or ml.vertex_count > max_verts:
            errors.append(f"meshlet {idx}: vertex_count {ml.vertex_count} outside 1..{max_verts}")
        if ml.triangle_count == 0 or ml.triangle_count > max_tris:
            errors.append(f"meshlet {idx}: triangle_count {ml.triangle_count} outside 1..{max_tris}")
        vs = mesh.vertices[ml.vertex_offset:ml.vertex_offset + ml.vertex_count]
        ts = mesh.indices[ml.triangle_offset:ml.triangle_offset + ml.triangle_count]
        if len(ts) and int(ts.max()) >= ml.vertex_count:
            errors.append(f"meshlet {idx}: local triangle index out of range")
        center = np.array(ml.bound_sphere[:3], dtype=np.float64)
        radius = float(ml.bound_sphere[3])
        if len(vs):
            max_dist = float(np.linalg.norm(vs.astype(np.float64) - center, axis=1).max())
            if max_dist > radius + 1e-4:
                errors.append(f"meshlet {idx}: vertex dist {max_dist:.6f} exceeds sphere radius {radius:.6f}")
        if not (-1.0001 <= ml.normal_cone[3] <= 1.0001):
            errors.append(f"meshlet {idx}: invalid normal_cone cutoff {ml.normal_cone[3]}")
    return len(errors) == 0, errors


def _flatten_global_indices(mesh: ProceduralMesh) -> np.ndarray:
    chunks = [
        mesh.indices[ml.triangle_offset:ml.triangle_offset + ml.triangle_count] + ml.vertex_offset
        for ml in mesh.meshlets
    ]
    return np.vstack(chunks).astype(np.uint32) if chunks else np.zeros((0, 3), dtype=np.uint32)


def serialize_obj(mesh: ProceduralMesh) -> str:
    """Serialize ProceduralMesh (flattened across meshlets) to deterministic Wavefront OBJ."""
    lines = [f"# ProceduralMesh {mesh.name} (meshlets={len(mesh.meshlets)})", f"o {mesh.name}"]
    for v in mesh.vertices:
        lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}")
    for uv in mesh.uvs:
        lines.append(f"vt {uv[0]:.6f} {uv[1]:.6f}")
    for n in mesh.normals:
        lines.append(f"vn {n[0]:.6f} {n[1]:.6f} {n[2]:.6f}")
    for a, b, c in _flatten_global_indices(mesh):
        i1, i2, i3 = int(a) + 1, int(b) + 1, int(c) + 1
        lines.append(f"f {i1}/{i1}/{i1} {i2}/{i2}/{i2} {i3}/{i3}/{i3}")
    return "\n".join(lines) + "\n"


def export_obj(mesh: ProceduralMesh, path: Path | str) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(serialize_obj(mesh), encoding="utf-8")
    return out


def _pad4(data: bytes, fill: bytes) -> bytes:
    rem = len(data) % 4
    return data if rem == 0 else data + fill * (4 - rem)


def serialize_glb(mesh: ProceduralMesh, material_gltf: dict | None = None, z_up_to_y_up: bool = True) -> bytes:
    """Serialize ProceduralMesh to standard binary glTF 2.0 (.glb) bytes."""
    pos = mesh.vertices.astype("<f4").copy()
    nrm = mesh.normals.astype("<f4").copy()
    if z_up_to_y_up and len(pos):
        pos = np.stack([pos[:, 0], pos[:, 2], -pos[:, 1]], axis=-1).astype("<f4")
        nrm = np.stack([nrm[:, 0], nrm[:, 2], -nrm[:, 1]], axis=-1).astype("<f4")
    uv = mesh.uvs.astype("<f4")
    idx = _flatten_global_indices(mesh).reshape(-1).astype("<u4")

    pos_b, nrm_b, uv_b, idx_b = pos.tobytes(), nrm.tobytes(), uv.tobytes(), idx.tobytes()
    off_pos, off_nrm = 0, len(pos_b)
    off_uv = off_nrm + len(nrm_b)
    off_idx = off_uv + len(uv_b)
    bin_chunk = _pad4(pos_b + nrm_b + uv_b + idx_b, b"\x00")

    pmin = [float(x) for x in pos.min(axis=0)] if len(pos) else [0.0, 0.0, 0.0]
    pmax = [float(x) for x in pos.max(axis=0)] if len(pos) else [0.0, 0.0, 0.0]
    prim = {"attributes": {"POSITION": 0, "NORMAL": 1, "TEXCOORD_0": 2}, "indices": 3}
    gltf: dict = {
        "asset": {"version": "2.0", "generator": "superframe-proc-mesh-forge"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": mesh.name}],
        "meshes": [{"name": mesh.name, "primitives": [prim]}],
        "buffers": [{"byteLength": len(bin_chunk)}],
        "bufferViews": [
            {"buffer": 0, "byteOffset": off_pos, "byteLength": len(pos_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_nrm, "byteLength": len(nrm_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_uv, "byteLength": len(uv_b), "target": 34962},
            {"buffer": 0, "byteOffset": off_idx, "byteLength": len(idx_b), "target": 34963},
        ],
        "accessors": [
            {"bufferView": 0, "componentType": 5126, "count": len(pos), "type": "VEC3", "min": pmin, "max": pmax},
            {"bufferView": 1, "componentType": 5126, "count": len(nrm), "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126, "count": len(uv), "type": "VEC2"},
            {"bufferView": 3, "componentType": 5125, "count": len(idx), "type": "SCALAR"},
        ],
    }
    if material_gltf is not None:
        prim["material"] = 0
        gltf["materials"] = [material_gltf]
    json_chunk = _pad4(json.dumps(gltf, separators=(",", ":"), sort_keys=True).encode("utf-8"), b" ")
    total_len = 12 + 8 + len(json_chunk) + 8 + len(bin_chunk)
    header = struct.pack("<4sII", b"glTF", 2, total_len)
    return header + struct.pack("<II", len(json_chunk), 0x4E4F534A) + json_chunk + struct.pack("<II", len(bin_chunk), 0x004E4942) + bin_chunk


def export_glb(mesh: ProceduralMesh, path: Path | str, material_gltf: dict | None = None, z_up_to_y_up: bool = True) -> Path:
    out = Path(path)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(serialize_glb(mesh, material_gltf=material_gltf, z_up_to_y_up=z_up_to_y_up))
    return out


def emit_asset_receipt(
    out_path: Path | str,
    task_id: str,
    artifact_paths: Sequence[Path | str],
    oracle_cmd: Sequence[str] | None = None,
    root: Path | str | None = None,
    hmac_key: str | None = None,
) -> dict:
    """Seal procedural asset artifacts with a canonical engine-receipt/1 envelope."""
    resolved_root = Path(root) if root is not None else Path(out_path).resolve().parent
    return _er.emit_receipt(
        out_path=out_path,
        engine="superframe",
        flagship="superframe",
        task_id=task_id,
        root=resolved_root,
        artifact_paths=artifact_paths,
        oracle_cmd=oracle_cmd,
        hmac_key=hmac_key,
    )


def verify_asset_receipt(
    receipt_or_path: dict | Path | str,
    check_files: bool = True,
    hmac_key: str | None = None,
) -> tuple[bool, list[str]]:
    """Verify an engine-receipt/1 envelope for procedural assets."""
    rec = json.loads(Path(receipt_or_path).read_text(encoding="utf-8")) if isinstance(receipt_or_path, (Path, str)) else receipt_or_path
    return _er.verify_receipt(rec, check_files=check_files, hmac_key=hmac_key)
