# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""The open design file: surfaces, materials, tolerances and intent. See data/design_schema.txt in the report."""
import copy
import json
from dataclasses import dataclass, field
from pathlib import Path

import numpy as np

from . import glass

SCHEMA = "lenspipe.design/1"
DEFAULT_TOL = dict(power_fringes=3.0, irreg_fringes=1.0, ct_mm=0.05, air_mm=0.05, tilt_arcmin=1.0, decentre_mm=0.025,
                   nd=0.001, vd_pct=0.8, diameter_mm=0.05)
LAMBDA_TEST_NM = 632.8


class DesignError(ValueError):
    pass


def load(path):
    return validate(json.loads(Path(path).read_text(encoding="utf-8")))


def validate(d):
    """Hard schema check. Anything broken here cannot be traced, so it is a refusal, never a silent default."""
    for key in ("schema", "id", "units", "intent", "surfaces"):
        if key not in d:
            raise DesignError(f"missing field {key}")
    if d["schema"] != SCHEMA:
        raise DesignError(f"schema must be {SCHEMA}")
    if d["units"] != "mm":
        raise DesignError("units must be mm")
    if len(d["surfaces"]) < 2:
        raise DesignError("need at least two surfaces")
    stops = [i for i, s in enumerate(d["surfaces"]) if s.get("stop")]
    if len(stops) != 1:
        raise DesignError(f"exactly one stop surface required, found {len(stops)}")
    for i, s in enumerate(d["surfaces"]):
        for k in ("r", "t", "semi"):
            if k not in s:
                raise DesignError(f"surface {i}: missing {k}")
        if s["r"] is not None and (not np.isfinite(s["r"]) or s["r"] == 0):
            raise DesignError(f"surface {i}: radius must be finite and non-zero, or null for a plane")
        if not np.isfinite(s["t"]) or not np.isfinite(s["semi"]) or s["semi"] <= 0:
            raise DesignError(f"surface {i}: bad thickness or semi-diameter")
        if "mech_semi" in s and not (np.isfinite(s["mech_semi"]) and s["mech_semi"] >= s["semi"]):
            raise DesignError(f"surface {i}: mechanical semi-diameter {s['mech_semi']} is smaller than the clear semi-diameter {s['semi']}")
    last = d["surfaces"][-1].get("material")
    if last not in (None, "air"):
        raise DesignError("the medium after the last surface must be air")
    it = d["intent"]
    for key in ("fno", "half_field_deg", "wavelengths_nm"):
        if key not in it:
            raise DesignError(f"intent: missing {key}")
    return d


@dataclass
class Lens:
    """Numeric form. Arrays may be complex so that one extra trace gives an exact derivative."""
    c: np.ndarray
    t: np.ndarray
    k: np.ndarray
    a: np.ndarray            # even polynomial terms r^4, r^6, ... per surface
    semi: np.ndarray
    n: np.ndarray            # row per wavelength, column per medium: n[w, 0] is object space
    wl: np.ndarray           # nm
    w: np.ndarray            # spectral weights
    primary: int
    stop: int
    dx: np.ndarray = None
    dy: np.ndarray = None
    ax: np.ndarray = None
    ay: np.ndarray = None
    irr: np.ndarray = None   # per surface: astigmatic and spherical zone sag amplitudes in mm, on normalised height
    meta: dict = field(default_factory=dict)

    def __post_init__(self):
        m = len(self.c)
        for name in ("dx", "dy", "ax", "ay"):
            if getattr(self, name) is None:
                setattr(self, name, np.zeros(m))
        if self.irr is None:
            self.irr = np.zeros((m, 2))

    def copy(self):
        return copy.deepcopy(self)


def to_lens(d, wavelengths=None):
    s = d["surfaces"]
    it = d["intent"]
    wl = np.array(wavelengths if wavelengths is not None else it["wavelengths_nm"], float)
    w = np.array(it.get("weights", [1.0] * len(it["wavelengths_nm"])), float) if wavelengths is None else np.ones(len(wl))
    w = w / w.sum()
    media = [None] + [x.get("material") for x in s]
    n = np.array([[glass.index(m, nm) for m in media] for nm in wl])
    order = max([len(x.get("aspheric", [])) for x in s] + [1])
    a = np.zeros((len(s), order))
    for i, x in enumerate(s):
        for j, v in enumerate(x.get("aspheric", [])):
            a[i, j] = v
    return Lens(c=np.array([0.0 if x["r"] is None else 1.0 / x["r"] for x in s]), t=np.array([x["t"] for x in s], float),
                k=np.array([x.get("conic", 0.0) for x in s], float), a=a, semi=np.array([x["semi"] for x in s], float),
                n=n, wl=wl, w=w, primary=int(it.get("primary", len(wl) // 2)) if wavelengths is None else 0,
                stop=[i for i, x in enumerate(s) if x.get("stop")][0], meta=dict(id=d["id"]))


def tolerances(d, i=None):
    t = dict(DEFAULT_TOL)
    t.update(d.get("tolerances", {}).get("default", {}))
    if i is not None:
        t.update(d.get("tolerances", {}).get("by_surface", {}).get(str(i), {}))
    return t


def elements(d):
    """Glass runs between air gaps. Returns (first surface, last surface) index pairs; cemented groups stay together."""
    out, s, start = [], d["surfaces"], None
    for i, x in enumerate(s):
        solid = x.get("material") not in (None, "air")
        if solid and start is None:
            start = i
        if not solid and start is not None:
            out.append((start, i))
            start = None
    return out


def scale(d, factor):
    """Scale all lengths. Sag polynomial terms scale by the matching power."""
    d = copy.deepcopy(d)
    for x in d["surfaces"]:
        x["r"] = None if x["r"] is None else x["r"] * factor
        x["t"] *= factor
        x["semi"] *= factor
        if x.get("aspheric"):
            x["aspheric"] = [a * factor ** (1 - (2 * j + 4)) for j, a in enumerate(x["aspheric"])]
    return d
