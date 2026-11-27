# SPDX-License-Identifier: MIT
"""Scene IR helpers shared by the Python backends .

Turns a superstack.scene/1 document into the triangle list raw-native
builds internally, in the same vertex and index order, so a port can match
the reference operation for operation.
"""
from __future__ import annotations

import json
from pathlib import Path

import numpy as np

F = np.float32


def load(path) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _quad(a, b, c, d, n, albedo):
    # raw-native addQuad: triangles (a,b,c) and (a,c,d), one normal per vertex.
    return [((a, b, c), n, albedo), ((a, c, d), n, albedo)]


def _box(c, h, albedo):
    lo = [c[0] - h, c[1] - h, c[2] - h]
    hi = [c[0] + h, c[1] + h, c[2] + h]
    x0, y0, z0 = lo
    x1, y1, z1 = hi
    faces = [
        ((x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1), (0, 0, 1)),
        ((x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0), (0, 0, -1)),
        ((x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0), (0, 1, 0)),
        ((x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1), (0, -1, 0)),
        ((x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (1, 0, 0)),
        ((x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0), (-1, 0, 0)),
    ]
    tris = []
    for a, b, cc, d, n in faces:
        tris += _quad(a, b, cc, d, n, albedo)
    return tris


def triangles(scene: dict):
    """Return (verts[T,3,3], normals[T,3], albedo[T,3]) as float32."""
    tris = []
    for m in scene["meshes"]:
        if m["shape"] == "quad":
            tris += _quad(*m["corners"], m["normal"], m["albedo"])
        elif m["shape"] == "box":
            tris += _box(m["center"], m["half"], m["albedo"])
        else:
            raise ValueError(f"unsupported shape {m['shape']}")
    v = np.array([t[0] for t in tris], dtype=F)
    n = np.array([t[1] for t in tris], dtype=F)
    a = np.array([t[2] for t in tris], dtype=F)
    return v, n, a


def normalize(v):
    length = np.sqrt(dot(v, v))
    inv = (F(1.0) / length).astype(F)
    return (v * inv[..., None]).astype(F)


def dot(a, b):
    return (a[..., 0] * b[..., 0] + a[..., 1] * b[..., 1] + a[..., 2] * b[..., 2]).astype(F)


def cross(a, b):
    return np.stack([
        a[..., 1] * b[..., 2] - a[..., 2] * b[..., 1],
        a[..., 2] * b[..., 0] - a[..., 0] * b[..., 2],
        a[..., 0] * b[..., 1] - a[..., 1] * b[..., 0],
    ], axis=-1).astype(F)


def is_raw_default(scene: dict) -> bool:
    """raw-native renders one built-in scene. Its adapter must refuse any
    other geometry rather than render the wrong thing."""
    want = {
        "meshes": [
            {"id": "ground", "shape": "quad", "corners": [[-5, 0, -5], [5, 0, -5], [5, 0, 5], [-5, 0, 5]],
             "normal": [0, 1, 0], "albedo": [0.7, 0.7, 0.7]},
            {"id": "box", "shape": "box", "center": [0, 1, 0], "half": 1, "albedo": [0.8, 0.3, 0.2]},
        ],
        "lights": [{"kind": "directional", "dir": [-0.4, -1, -0.3], "intensity": 1}],
    }
    return all(scene.get(k) == v for k, v in want.items())
