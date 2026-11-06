# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Materials and media with provenance, read from packages/measured (data/mechanical.json).

A Material carries density rho, Young's modulus E, Poisson's ratio nu and a loss factor eta, each with the
status of its row (measured, derived or from_memory). Nothing here holds a hand-typed physical value except
the 0 C reference temperature, which is a definition. Loss factors come from measured decay of recorded bars where a recording exists (aluminium, steel), else
from memory, marked so. Damping by frequency uses the loss-factor model
alpha(f) = pi f eta + alpha0: a mode at f with loss factor eta decays as exp(-pi f eta t).
"""
import math
from dataclasses import dataclass, field

from . import PKG  # noqa: F401  (sets sys.path for measured)
from measured import load

T0_KELVIN = 273.15  # 0 C, defined
_TABLE = None


def table():
    """The mechanical rows and the measured decay rows (decay_iowa.json), indexed by id."""
    global _TABLE
    if _TABLE is None:
        _TABLE = {r["id"]: r for r in load("mechanical")["rows"]}
        _TABLE.update({r["id"]: r for r in load("decay_iowa")["rows"]})
    return _TABLE


def row(rid):
    return table()[rid]


def crosscheck():
    return load("mechanical")["provenance"]["crosscheck_wikidata"]


@dataclass(frozen=True)
class Material:
    name: str
    rho: float
    E: float
    nu: float | None
    eta: float
    status: dict = field(default_factory=dict, compare=False)

    @property
    def c_bar(self):
        """Extensional (rod) wave speed sqrt(E / rho)."""
        return math.sqrt(self.E / self.rho)

    def with_(self, **kw):
        d = dict(name=self.name, rho=self.rho, E=self.E, nu=self.nu, eta=self.eta, status=self.status)
        d.update(kw)
        return Material(**d)


# Density row for crown glass: Kaye and Laby list soda glass density, used for crown (noted in the row).
_RHO = {"glass_crown": "glass_soda.rho"}
NAMES = ("steel_mild", "aluminium", "brass", "copper", "glass_crown", "oak", "pine", "ash")


def material(name):
    """Build a Material from its rows; Poisson's ratio is None where the table lists none (woods)."""
    t = table()
    eta_id = f"{name}.eta_measured" if f"{name}.eta_measured" in t else f"{name}.eta"   # measured decay first
    rid = {"rho": _RHO.get(name, f"{name}.rho"), "E": f"{name}.E", "nu": f"{name}.nu", "eta": eta_id}
    vals = {k: (t[v]["value"] if v in t else None) for k, v in rid.items()}
    status = {k: (t[v]["status"] if v in t else "missing") for k, v in rid.items()}
    if vals["rho"] is None or vals["E"] is None:
        raise KeyError(f"{name}: density or modulus missing from the mechanical table")
    return Material(name, vals["rho"], vals["E"], vals["nu"], vals["eta"], status)


def air_speed(celsius=20.0):
    """Speed of sound in dry air: the Kaye and Laby 0 C value scaled by sqrt(T / T0), the ideal-gas law."""
    return row("air.c0")["value"] * math.sqrt((T0_KELVIN + celsius) / T0_KELVIN)


def water_speed():
    """Water at 20 C and 1 atm from wavelab.consts.water (NIST reference equation). The Kaye and Laby row
    water.c20 stays in the table as the cross-check (tests/test_voice_nature.py)."""
    from wavelab import consts
    return consts.water(293.15)["c"]


MEDIA = {"air": air_speed, "water": lambda: water_speed()}


def medium_speed(name):
    return MEDIA[name]()
