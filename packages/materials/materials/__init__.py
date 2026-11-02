# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Physically grounded materials library: spectral optics plus thermal, mechanical,
electrical and surface constants, every field with source, licence and confidence."""
import json
from functools import lru_cache
from pathlib import Path

from . import drude, optics, schema, spectral  # noqa: F401

DATA = Path(__file__).resolve().parent.parent / "data"


@lru_cache(maxsize=None)
def library():
    return json.loads((DATA / "materials.json").read_text(encoding="utf-8"))


def all_materials():
    return library()["materials"]


def get(material_id):
    for rec in all_materials():
        if rec["id"] == material_id:
            return rec
    raise KeyError(material_id)


def by_class(cls):
    return [r for r in all_materials() if r["class"] == cls]


def shade(material_id, light="D65", theta_view_deg=0.0, **kw):
    """Convenience wrapper: spectral radiance on spectral.GRID."""
    spd = spectral.illuminant(light) if isinstance(light, str) else light
    return optics.shade(get(material_id), spd, theta_view_deg, **kw)
