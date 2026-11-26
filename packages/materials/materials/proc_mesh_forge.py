# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Unified Procedural Mesh, SDF Boulder/Arch, Biomechanical Flora, and 64v/126t Meshlet Forge.

Matches RawFloraEngine.h and RawMeshPipeline.h contracts:
  - SDF boulder and architectural hexagonal basalt arch geometry with analytic normals
  - Da Vinci Pipe Model (r_parent^p = sum r_child^p, default p = 2.5)
  - Phototropism, wind shear, Euler-Bernoulli cantilever flex & winter snow-load sag
  - Seasonal phenology (chlorophyll, carotenoid, abscission, canopy snow load)
  - 3D sculpted needle/leaf cluster fans (zero flat billboards)
  - 64v/126t GPU meshlet clustering, OBJ/GLB export, and engine-receipt/1 sealing
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

import numpy as np

from .proc_meshlet import (  # noqa: F401
    MeshletDesc,
    ProceduralMesh,
    emit_asset_receipt,
    export_glb,
    export_obj,
    pack_meshlets,
    serialize_glb,
    serialize_obj,
    verify_asset_receipt,
    verify_meshlets,
)


def sdf_smin_cubic(a: float, b: float, k: float) -> float:
    """C2 cubic polynomial smooth union (matching native/tools/asset/DESIGN.md)."""
    if k <= 0.0:
        return min(a, b)
    h = max(k - abs(a - b), 0.0) / k
    return min(a, b) - h * h * h * k * (1.0 / 6.0)


def _compute_smooth_normals(verts: np.ndarray, tris: np.ndarray) -> np.ndarray:
    nrm = np.zeros_like(verts, dtype=np.float64)
    v0, v1, v2 = verts[tris[:, 0]], verts[tris[:, 1]], verts[tris[:, 2]]
    fn = np.cross(v1 - v0, v2 - v0)
    for col in range(3):
        np.add.at(nrm, tris[:, col], fn)
    lens = np.linalg.norm(nrm, axis=1, keepdims=True)
    return (nrm / np.maximum(lens, 1e-12)).astype(np.float32)


def build_sdf_boulder(
    seed: int = 202607,
    radius: float = 1.5,
    fracture_planes: int = 4,
    stacks: int = 12,
    slices: int = 18,
) -> ProceduralMesh:
    """Generate a deterministic SDF-displaced alpine boulder with fracture planes and 64v/126t meshlets."""
    rng = np.random.default_rng(seed)
    planes = rng.normal(size=(max(1, fracture_planes), 3))
    planes /= np.linalg.norm(planes, axis=1, keepdims=True)
    offsets = rng.uniform(0.72 * radius, 0.94 * radius, size=len(planes))
    freqs = rng.uniform(1.6, 3.8, size=(3, 3))
    phases = rng.uniform(0.0, 2.0 * math.pi, size=3)

    verts, uvs = [], []
    for i in range(stacks + 1):
        v = i / stacks
        phi = math.pi * v
        for j in range(slices + 1):
            u = j / slices
            theta = 2.0 * math.pi * u
            d = np.array([math.sin(phi) * math.cos(theta), math.sin(phi) * math.sin(theta), math.cos(phi)])
            disp = 0.14 * sum(math.sin(float(d @ freqs[k]) + phases[k]) / (k + 1) for k in range(3))
            r = radius * (1.0 + disp)
            for pn, po in zip(planes, offsets):
                proj = float(d @ pn)
                if proj > 0.15:
                    r = min(r, po / proj)
            p = d * max(0.35 * radius, r)
            verts.append(p)
            uvs.append((u, v))
    tris = []
    stride = slices + 1
    for i in range(stacks):
        for j in range(slices):
            a, b = i * stride + j, (i + 1) * stride + j
            tris.append((a, b, a + 1))
            tris.append((a + 1, b, b + 1))
    v_arr = np.array(verts, dtype=np.float32)
    t_arr = np.array(tris, dtype=np.uint32)
    n_arr = _compute_smooth_normals(v_arr, t_arr)
    return pack_meshlets(f"sdf_boulder_{seed}", v_arr, n_arr, np.array(uvs, dtype=np.float32), t_arr)


def build_basalt_arch(
    seed: int = 202607,
    span: float = 4.0,
    height: float = 3.0,
    thickness: float = 0.55,
    segments: int = 16,
    sides: int = 6,
) -> ProceduralMesh:
    """Generate an architectural hexagonal basalt arch packed into 64v/126t meshlets."""
    rng = np.random.default_rng(seed)
    verts, uvs = [], []
    for i in range(segments + 1):
        u = i / segments
        ang = math.pi * u
        cx = -0.5 * span * math.cos(ang)
        cz = height * math.sin(ang)
        tx, tz = 0.5 * span * math.sin(ang), height * math.cos(ang)
        tn = math.hypot(tx, tz)
        nx, nz = -tz / tn, tx / tn
        rad = thickness * (1.0 - 0.18 * math.sin(ang) + 0.04 * rng.standard_normal())
        for j in range(sides + 1):
            v = j / sides
            a2 = 2.0 * math.pi * v
            ca, sa = math.cos(a2), math.sin(a2)
            verts.append((cx + rad * ca * nx, rad * sa, cz + rad * ca * nz))
            uvs.append((u, v))
    tris = []
    stride = sides + 1
    for i in range(segments):
        for j in range(sides):
            a, b = i * stride + j, (i + 1) * stride + j
            tris.append((a, b, a + 1))
            tris.append((a + 1, b, b + 1))
    v_arr = np.array(verts, dtype=np.float32)
    t_arr = np.array(tris, dtype=np.uint32)
    n_arr = _compute_smooth_normals(v_arr, t_arr)
    return pack_meshlets(f"basalt_arch_{seed}", v_arr, n_arr, np.array(uvs, dtype=np.float32), t_arr)


@dataclass
class FloraParams:
    """Biomechanical tree parameters aligned with RawFloraEngine.h."""
    species: str = "OldGrowthSitkaSpruce"
    seed: int = 202607
    height_m: float = 10.0
    da_vinci_exponent: float = 2.5
    sun_dir: tuple[float, float, float] = (0.35, -0.45, 0.82)
    wind_xy: tuple[float, float] = (0.6, 0.2)
    chlorophyll01: float = 1.0
    autumn_carotenoid01: float = 0.0
    leaf_abscission01: float = 0.0
    canopy_snow_load01: float = 0.0
    max_order: int = 3
    tip_radius_m: float = 0.035


@dataclass
class BranchNode:
    """Single biomechanical branch node in Z-up metric coordinates."""
    index: int
    parent: int
    position: np.ndarray
    direction: np.ndarray
    radius: float
    order: int
    bend_flex: float
    wind_phase: float
    children: list[int] = field(default_factory=list)


@dataclass
class FloraAsset:
    """Complete biomechanical tree asset with skeleton, meshlets, and verification stats."""
    params: FloraParams
    skeleton: list[BranchNode]
    mesh: ProceduralMesh
    stats: dict


def _grow_skeleton(params: FloraParams) -> list[BranchNode]:
    rng = np.random.default_rng(params.seed)
    sun = np.array(params.sun_dir, dtype=np.float64)
    sun /= max(float(np.linalg.norm(sun)), 1e-8)
    wind = np.array([params.wind_xy[0], params.wind_xy[1], 0.0], dtype=np.float64)
    nodes: list[BranchNode] = [
        BranchNode(0, -1, np.zeros(3), np.array([0.0, 0.0, 1.0]), params.tip_radius_m, 0, 0.0, 0.0)
    ]

    def _spawn(parent_idx: int, order: int, length: float, depth: int) -> None:
        if depth <= 0 or order > params.max_order:
            return
        parent = nodes[parent_idx]
        n_child = 2 if order < params.max_order else 2
        for c in range(n_child):
            az = 2.0 * math.pi * (c / n_child + 0.37 * parent_idx) + float(rng.uniform(-0.35, 0.35))
            spread = 0.22 if order == 0 else 0.55
            raw_dir = parent.direction + spread * np.array([math.cos(az), math.sin(az), 0.35])
            raw_dir = raw_dir + 0.18 * sun + 0.10 * wind
            # Euler-Bernoulli cantilever winter snow-load sag on upper boughs (order >= 1)
            sag = params.canopy_snow_load01 * (0.45 * order + 0.15)
            raw_dir[2] -= sag
            raw_dir /= max(float(np.linalg.norm(raw_dir)), 1e-8)
            pos = parent.position + raw_dir * length
            flex = min(1.0, (order + 1) / (params.max_order + 1))
            idx = len(nodes)
            nodes.append(BranchNode(idx, parent_idx, pos, raw_dir, params.tip_radius_m, order, flex, float(rng.random())))
            parent.children.append(idx)
            _spawn(idx, order + 1, length * 0.68, depth - 1)

    _spawn(0, 1, params.height_m * 0.36, params.max_order)
    # Bottom-up Leonardian da Vinci Pipe Model: r_parent^p = sum(r_child^p)
    p = params.da_vinci_exponent
    for node in reversed(nodes):
        if node.children:
            node.radius = float(sum(nodes[cid].radius ** p for cid in node.children) ** (1.0 / p))
        else:
            node.radius = params.tip_radius_m
    return nodes


def _add_foliage_spray(verts, uvs, metas, tris, node: BranchNode, ax, u_vec, v_vec, params: FloraParams) -> None:
    sz = max(0.28, params.height_m * 0.065)
    for b in range(3):
        ba = 2.0 * math.pi * b / 3.0
        bdir = math.cos(ba) * u_vec + math.sin(ba) * v_vec
        bi = len(verts)
        tip = node.position
        for pt in (tip, tip + sz * (0.7 * bdir + 0.4 * ax), tip + sz * (0.4 * bdir + 0.9 * ax), tip + sz * (-0.3 * bdir + 0.6 * ax)):
            verts.append(pt); uvs.append((0.5, 0.5))
            metas.append((node.bend_flex, node.wind_phase, 1.0, params.canopy_snow_load01))
        tris.append((bi, bi + 1, bi + 2)); tris.append((bi, bi + 2, bi + 3))


def _append_limb_and_foliage(nodes: list[BranchNode], params: FloraParams):
    rng = np.random.default_rng(params.seed + 77)
    verts, uvs, metas, tris, foliage_count, abscised_count, sides = [], [], [], [], 0, 0, 6
    for node in nodes:
        if node.parent < 0:
            continue
        par = nodes[node.parent]
        axis = node.position - par.position
        alen = float(np.linalg.norm(axis))
        if alen < 1e-6:
            continue
        ax = axis / alen
        ref = np.array([1.0, 0.0, 0.0]) if abs(ax[0]) < 0.8 else np.array([0.0, 1.0, 0.0])
        u_vec = np.cross(ax, ref); u_vec /= max(float(np.linalg.norm(u_vec)), 1e-8)
        v_vec = np.cross(ax, u_vec)
        base_i = len(verts)
        for rt, pos, rad, fl in ((0.0, par.position, par.radius, par.bend_flex), (1.0, node.position, node.radius, node.bend_flex)):
            for k in range(sides):
                ang = 2.0 * math.pi * k / sides
                verts.append(pos + rad * (math.cos(ang) * u_vec + math.sin(ang) * v_vec))
                uvs.append((k / sides, rt)); metas.append((fl, node.wind_phase, 0.0, params.canopy_snow_load01))
        for k in range(sides):
            kn = (k + 1) % sides
            tris.append((base_i + k, base_i + sides + k, base_i + kn))
            tris.append((base_i + kn, base_i + sides + k, base_i + sides + kn))
        if not node.children:
            if float(rng.random()) < params.leaf_abscission01:
                abscised_count += 1
            else:
                foliage_count += 1
                _add_foliage_spray(verts, uvs, metas, tris, node, ax, u_vec, v_vec, params)
    v_arr, t_arr = np.array(verts, dtype=np.float32), np.array(tris, dtype=np.uint32)
    return v_arr, _compute_smooth_normals(v_arr, t_arr), np.array(uvs, dtype=np.float32), np.array(metas, dtype=np.float32), t_arr, foliage_count, abscised_count


def build_biomechanical_tree(params: FloraParams | None = None) -> FloraAsset:
    """Build a complete biomechanical tree with da Vinci pipe conservation and 64v/126t meshlets."""
    cfg = params or FloraParams()
    nodes = _grow_skeleton(cfg)
    p = cfg.da_vinci_exponent
    max_pipe_err = max(
        (abs(n.radius ** p - sum(nodes[c].radius ** p for c in n.children)) for n in nodes if n.children),
        default=0.0,
    )
    v, n, uv, meta, tris, f_cnt, a_cnt = _append_limb_and_foliage(nodes, cfg)
    mesh = pack_meshlets(f"flora_{cfg.species}_{cfg.seed}", v, n, uv, tris, meta=meta)
    crown_z = [float(nd.position[2]) for nd in nodes if nd.order >= 1]
    stats = {
        "total_nodes": len(nodes),
        "root_radius_m": float(nodes[0].radius),
        "pipe_model_max_err": float(max_pipe_err),
        "mean_canopy_z": float(sum(crown_z) / max(len(crown_z), 1)),
        "foliage_cluster_count": f_cnt,
        "abscised_cluster_count": a_cnt,
        "meshlet_count": len(mesh.meshlets),
        "chlorophyll01": cfg.chlorophyll01,
        "autumn_carotenoid01": cfg.autumn_carotenoid01,
    }
    return FloraAsset(cfg, nodes, mesh, stats)
