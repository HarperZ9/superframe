# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Attach literature, HSDB, Maxwell-relation and Drude-Lorentz fields to a record."""
import json
from pathlib import Path

import assemble as A
import lit_values as L
import wd_values

ROOT = Path(__file__).resolve().parent.parent
UNITS = {"surface_tension": ("surface", "N/m"), "viscosity": ("mechanical", "Pa s"),
         "relative_permittivity": ("electromagnetic", "1")}


def add_contact_angle(rec):
    row = L.CONTACT_ANGLE.get(rec["id"])
    if not row:
        return
    value, pm, doi, conf, note = row
    cite, where = L.PAPERS[doi]
    rec["surface"]["water_contact_angle"] = A.field(
        value, "deg", f"doi:{doi}", conf, uncertainty_deg=pm, citation=cite, location=where, note=note,
        attribution=f"{cite}, CC BY 4.0, https://doi.org/{doi}")
    rec["provenance"].append(f"doi:{doi}")


def _hsdb_field(value, T, cid, text, conf, note, unit):
    return A.field(A.sig(value), unit, f"{L.HSDB}:CID{cid}", conf, temperature_K=[T] if T else None,
                   as_read=text, note=note, attribution="Source: National Library of Medicine (HSDB via PubChem)")


def add_hsdb(rec):
    for key, row in L.HSDB_VALUES.get(rec["id"], {}).items():
        group, unit = UNITS[key]
        new = _hsdb_field(*row, unit)
        cur = rec[group][key]
        if cur is None:
            rec[group][key] = new
        else:
            rel = abs(cur["value"] - new["value"]) / new["value"]
            if rel <= 0.05:
                cur["corroborated_by"] = f"{new['source']} ({new['value']:g} {unit}, within 5%)"
                if cur["confidence"] == "low":
                    cur["confidence"] = "moderate"
                continue
            if cur["confidence"] == "low" and rel > 0.20:
                wd_values.REJECTED.append({"qid": cur["source"], "prop": key, "value": cur["value"],
                                           "phase": rec["phase"], "statement": None,
                                           "bounds": f"disagrees with {new['source']} {new['value']:g} by "
                                                     f"{rel:.0%}; replaced"})
                rec[group][key] = new
            else:
                cur.setdefault("disagrees_with", []).append(f"{new['source']} {new['value']:g} {unit}")
                continue
        rec["provenance"].append(new["source"])


def add_maxwell_permittivity(rec):
    if rec["id"] not in L.MAXWELL_GASES or rec["electromagnetic"]["relative_permittivity"] is not None:
        return
    n = rec["optics"].get("n")
    if not n:
        return
    n780 = n["value"][-1]
    rec["electromagnetic"]["relative_permittivity"] = A.field(
        A.sig(n780 * n780, 8), "1", "derived:Maxwell relation eps = n^2 at 780 nm", "moderate",
        inputs=n["source"], note="nonpolar gas at the conditions of the n data; dispersion to DC changes "
        "eps - 1 by a few percent")


def load_drude_lorentz():
    p = ROOT / "data" / "drude_lorentz.json"
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else {"metals": {}}


def add_drude_lorentz(rec, dl):
    m = dl["metals"].get(rec["id"])
    if not m:
        return
    e = m["errors"]
    value = dict(m["params"], fit_range_nm=dl["fit_range_nm"], n_points=m["n_points"],
                 holdout_rms=m["rms_by_oscillator_count"][str(m["oscillators_chosen"])]["holdout_rms"],
                 params_at_bound=m["params_at_bound"], errors={k: e[k] for k in e})
    conf = "moderate" if m["n_points"] >= 3 * (1 + m["oscillators_chosen"]) * 1.5 else "low"
    rec["electromagnetic"]["drude_lorentz"] = A.field(
        value, "eV (energies), eV^2 (strengths)", f"derived:drude-lorentz fit to {m['source']}", conf,
        note="effective parameters valid 380-1000 nm; not physical constants outside that range")
