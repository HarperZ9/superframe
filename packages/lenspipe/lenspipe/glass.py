# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""Glass indices. Catalogue rows come from the CC0 refractiveindex.info database; nd and Vd alone give a model glass.

Formula 2 is Sellmeier in n^2 - 1 = sum B l^2 / (l^2 - C). Formula 1 uses C^2. Other vendor formulas (Hoya, CDGM older
forms) are formula 3 or similar polynomials. Wavelengths in nm at the public interface.
"""
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

CATALOG = Path(__file__).resolve().parent.parent / "data" / "glass_catalog.json"
ND, NF, NC = 587.5618, 486.1327, 656.2725


@lru_cache(maxsize=1)
def catalog():
    return json.loads(CATALOG.read_text(encoding="utf-8"))["rows"]


def _formula(row, um):
    c = row["coef"]
    l2 = um * um
    f = row["formula"]
    if f == 1:
        s = 1 + c[0]
        for i in range(1, len(c) - 1, 2):
            s += c[i] * l2 / (l2 - c[i + 1] ** 2)
    elif f == 2:
        s = 1 + c[0]
        for i in range(1, len(c) - 1, 2):
            s += c[i] * l2 / (l2 - c[i + 1])
    elif f == 3:
        s = c[0]
        for i in range(1, len(c) - 1, 2):
            s += c[i] * um ** c[i + 1]
    else:
        raise ValueError(f"glass formula {f} not implemented")
    return float(np.sqrt(s))


def model_glass(nd, vd):
    """Two-term Cauchy through nd and nF - nC. Good to a few 1e-4 inside the visible; no partial dispersion."""
    dnfc = (nd - 1) / vd
    b = dnfc / (1 / (NF * 1e-3) ** 2 - 1 / (NC * 1e-3) ** 2)
    a = nd - b / (ND * 1e-3) ** 2
    return lambda nm: a + b / (nm * 1e-3) ** 2


def index(material, nm):
    """material: None or 'air', a catalogue name, or {'nd':, 'vd':}."""
    if material is None or material == "air":
        return 1.0
    if isinstance(material, dict):
        return float(model_glass(material["nd"], material["vd"])(nm))
    row = catalog().get(material)
    if row is None:
        raise KeyError(f"glass {material} not in catalogue")
    return _formula(row, nm * 1e-3)


def k_at(material, nm):
    """Extinction k from the catalogue, or None when the catalogue has none or the material is a model glass."""
    if not isinstance(material, str) or material == "air":
        return None
    row = catalog().get(material)
    if not row or not row.get("k"):
        return None
    t = np.array(row["k"])
    return float(np.interp(nm * 1e-3, t[:, 0], t[:, 1]))


def internal_transmittance(material, nm, path_mm):
    k = k_at(material, nm)
    if k is None:
        return None
    return float(np.exp(-4 * np.pi * k * path_mm / (nm * 1e-6)))
