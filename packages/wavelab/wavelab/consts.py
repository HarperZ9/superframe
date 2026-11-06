# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Constants and media, read from packages/measured and never typed by hand.

CODATA 2022 values come from measured/generated/constants.py and, for the few it does not export (G, R,
standard gravity, standard atmosphere), from the CODATA rows in measured/data/codata2022.json by quantity
name. Media (PREM, NIST fluid states, Mars and Hunga values, the 1976 atmosphere) come from
measured/data/wave_media.json, built by measured/build/b_wavemedia.py with sha256 provenance.
"""
import importlib.util
import json
from functools import lru_cache
from pathlib import Path

import numpy as np

MEASURED = Path(__file__).resolve().parents[2] / "measured"


@lru_cache(None)
def gen():
    spec = importlib.util.spec_from_file_location("measured_generated_constants", MEASURED / "generated" / "constants.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


@lru_cache(None)
def _codata():
    rows = json.loads((MEASURED / "data" / "codata2022.json").read_text(encoding="utf-8"))["rows"]
    return {r["quantity"]: r["value"] for r in rows}


def codata(quantity):
    """One CODATA 2022 value by its NIST quantity name."""
    return _codata()[quantity]


G = codata("Newtonian constant of gravitation")
R_GAS = codata("molar gas constant")
G_N = codata("standard acceleration of gravity")
ATM = codata("standard atmosphere")
KB, HBAR, NA = gen().kB, gen().hbar, gen().NA


@lru_cache(None)
def media():
    return json.loads((MEASURED / "data" / "wave_media.json").read_text(encoding="utf-8"))


def row(fid):
    for r in media()["rows"]:
        if r["id"] == fid:
            return r["value"]
    raise KeyError(fid)


def nist_table(name):
    """NIST state table as (columns, float array of the numeric columns)."""
    t = media()["nist"][name]
    cols = [c for c in t["columns"] if c != "Phase"]
    return cols, np.array([[v for v in r if not isinstance(v, str)] for r in t["rows"]], float)


def nist_at(name, T, col):
    cols, a = nist_table(name)
    return float(np.interp(T, a[:, 0], a[:, cols.index(col)]))


def air_molar_mass():
    """Dry-air molar mass from the 1976 composition (Table 3), kg/mol. The standard's M0 is 28.9644 kg/kmol."""
    u = media()["ussa1976"]
    return sum(m * f for m, f in zip(u["air_M_kg_per_kmol"], u["air_F"])) / 1000.0


def ideal_sound_speed(T, M, gamma):
    return float(np.sqrt(gamma * R_GAS * T / M))


def air(T=293.15, p=None):
    """Dry air as an ideal gas with the 1976 standard's gamma, molar mass and Sutherland viscosity."""
    u = media()["ussa1976"]
    p = ATM if p is None else p
    M = air_molar_mass()
    rho = p * M / (R_GAS * T)
    mu = u["sutherland_beta"] * T ** 1.5 / (T + u["sutherland_S_K"])
    return {"T": T, "p": p, "rho": rho, "c": ideal_sound_speed(T, M, u["gamma"]), "gamma": u["gamma"],
            "beta": (u["gamma"] + 1) / 2, "mu": mu, "M": M}


def water(T=293.15):
    """Liquid water at 1 atm from the NIST reference equation (IAPWS-95 in the WebBook); vapour pressure and
    surface tension from the WebBook saturation table."""
    c = "Sound Spd. (m/s)"
    sat = np.array(sorted(media()["nist"]["water_sat"]["rows"]), float)
    return {"T": T, "rho": nist_at("water_1atm", T, "Density (kg/m3)"), "c": nist_at("water_1atm", T, c),
            "mu": nist_at("water_1atm", T, "Viscosity (Pa*s)"), "pv": float(np.interp(T, sat[:, 0], sat[:, 1])),
            "sigma": float(np.interp(T, sat[:, 0], sat[:, 2]))}
