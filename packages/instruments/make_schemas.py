# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Write the ten stage templates and the reading receipt as JSON Schemas (draft 2020-12) into schemas/.

    python -I -B make_schemas.py

Every stage shares one envelope: what goes in, what comes out, the gate with a measurable pass condition,
the tools (ours or open, with licence and lineage), and the stage's does-not-prove line. Each stage adds its
own block under `spec`. The receipt schema extends the measurement bus rather than replacing it.
"""
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE / "schemas"
BASE = "https://harperz9.local/hardware-pipeline/schemas/"
S, A, N, B, O = {"type": "string"}, {"type": "array"}, {"type": "number"}, {"type": "boolean"}, {"type": "object"}
NUL_S = {"type": ["string", "null"]}
NUL_N = {"type": ["number", "null"]}


def obj(props, req=None, extra=False):
    return {"type": "object", "properties": props, "required": req or list(props), "additionalProperties": extra}


def arr(items, min_items=0):
    return {"type": "array", "items": items, "minItems": min_items}


TOOL = obj({"name": S, "role": S, "licence": S, "ours": B, "lineage": S}, ["name", "role", "licence", "ours"])
GATE = obj({"condition": S, "metric": S, "op": {"enum": ["<", "<=", ">", ">=", "==", "in"]},
            "threshold": {}, "measured": {}, "verdict": {"enum": ["pass", "fail", "open", "not-applicable"]},
            "evidence": NUL_S}, ["condition", "metric", "op", "threshold", "verdict"])
STAGES = [
    ("01", "principle", "Principle: the law, its form, and the wall-audit assumptions it rests on", {
        "law": obj({"name": S, "form": S, "catalogue_id": NUL_S, "lineage": S}),
        "quantity": S, "signal": S, "inversion": S,
        "wall_assumptions": arr(obj({"assumption": S, "how_checked": S, "if_broken": S}), 1),
        "fundamental_bound": S}),
    ("02", "twin", "Simulation and digital twin of the instrument and its signal chain", {
        "model": S, "code": arr(S),
        "noise_sources": arr(obj({"name": S, "formula": S, "value": S}), 1),
        "bounds": arr(obj({"name": S, "formula": S, "value": S}), 1),
        "known_answer_tests": arr(obj({"name": S, "truth": S, "pass_condition": S, "result": NUL_S}), 1)}),
    ("03", "front_end", "Analog front end: sensor, amplifier, filter, ADC, with a noise budget against the bound", {
        "existing_device": B,
        "chain": arr(obj({"element": S, "part_or_device": S, "key_spec": S}), 1),
        "noise_budget": arr(obj({"source": S, "density": S, "share_of_total": S}), 1),
        "adc": obj({"bits": NUL_N, "fs_hz": NUL_N, "enob_or_floor": S}),
        "margin_to_bound": S}),
    ("04", "schematic_pcb", "Schematic and PCB in KiCad, BOM with lifecycle and alternates; nothing ordered", {
        "existing_device": B, "eda": obj({"tool": S, "version": S, "files": arr(S)}),
        "checks": arr(S),
        "bom": arr(obj({"ref": S, "part": S, "function": S, "lifecycle": S, "lifecycle_source": S,
                        "alternates": arr(S)}, ["ref", "part", "function", "lifecycle", "alternates"])),
        "spend": {"const": "gated: nothing ordered, priced or fabricated"}}),
    ("05", "firmware", "Firmware: deterministic, reproducible builds; self-test designed in from the start", {
        "platform": S, "toolchain": obj({"name": S, "pinned": S}),
        "reproducible_build": obj({"method": S, "check": S}),
        "self_tests": arr(obj({"name": S, "check_id": S, "method": S, "pass_condition": S}), 1)}),
    ("06", "calibration", "Calibration by substitution against references, with honest traceability", {
        "method": S,
        "references": arr(obj({"name": S, "kind": {"enum": ["primary", "fixed-point", "secondary", "working", "none"]},
                               "traceability": S}), 1),
        "record_fields": arr(S, 1), "is_primary_standard": B, "honest_traceability": S}),
    ("07", "hil", "Hardware in the loop: digital to analog to digital round trip, scored against truth", {
        "rig": S, "signals": arr(obj({"name": S, "truth": S}), 1),
        "scoring": obj({"error_vs_truth": S, "bits_lost": S}),
        "results": {"type": ["object", "null"]}}),
    ("08", "field", "Field testing in non-digital environments under a preregistered protocol", {
        "sites": arr(S, 1),
        "protocol": obj({"prereg": S, "known_answers": arr(S, 1), "kill_condition": S, "controls": arr(S, 1)}),
        "conditions_logged": arr(S, 1)}),
    ("09", "data_return", "Data return: every reading as a receipt on the measurement bus", {
        "receipt_schema": S, "value_fields": arr(S, 1), "uncal_policy": S,
        "feeds": obj({"measurement_bus": S, "perceptual_bridge": S, "findings": S}),
        "example": NUL_S}),
    ("10", "manufacturing", "Manufacturing readiness: design for test, fixture, yield, a capsule per build", {
        "design_for_test": arr(S, 1), "fixture": S,
        "yield": obj({"metric": S, "tracking": S}),
        "build_capsule": obj({"design_sha256": S, "firmware_sha256": S, "calibration_record_sha256": S,
                              "test_receipts": S})}),
]


def stage_schema(num, key, title, spec):
    return {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "$id": BASE + f"stage-{num}-{key}.schema.json", "title": title,
        "type": "object", "additionalProperties": False,
        "required": ["stage", "key", "status", "inputs", "outputs", "gate", "tools", "spec", "does_not_prove"],
        "properties": {
            "stage": {"const": int(num)}, "key": {"const": key},
            "status": {"enum": ["paper", "built", "run", "passed", "failed", "blocked", "existing-device"]},
            "inputs": arr(S, 1), "outputs": arr(S, 1), "gate": GATE, "tools": arr(TOOL, 1),
            "spec": obj(spec), "notes": S, "does_not_prove": S}}


def instrument_schema():
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": BASE + "instrument.schema.json",
            "title": "An instrument carried through all ten stages", "type": "object",
            "required": ["schema", "id", "name", "written", "stages"], "additionalProperties": False,
            "properties": {"schema": {"const": "hardware-pipeline.instrument/0.1"}, "id": S, "name": S, "written": S,
                           "atlas_id": NUL_S, "summary": S,
                           "stages": {"type": "array", "minItems": 10, "maxItems": 10,
                                      "prefixItems": [{"$ref": f"stage-{n}-{k}.schema.json"} for n, k, _, _ in STAGES]}}}


def receipt_schema():
    st = obj({"ran": B, "pass": {"type": ["boolean", "null"]}, "value": {}}, ["ran", "pass"])
    inst = obj({
        "id": S, "kind": S,
        "build": obj({"design_sha256": NUL_S, "firmware_sha256": NUL_S, "code_sha256": NUL_S}),
        "calibration": obj({"state": {"enum": ["PRIMARY", "CALIBRATED", "UNCAL"]}, "uncal": B, "record_sha256": NUL_S,
                            "reference": NUL_S, "traceability": NUL_S, "valid_until": NUL_S, "why": NUL_S}),
        "conditions": O, "self_test": {"type": "object", "additionalProperties": st}, "sim": B})
    ev = {"type": "object", "additionalProperties": True,
          "required": ["event_id", "run_id", "frame_id", "actor", "domain", "subject_ref", "timestamp", "clock_domain",
                       "coordinate_space", "units", "value_shape", "value", "uncertainty", "provenance", "privacy",
                       "severity", "event_hash", "state", "instrument"],
          "properties": {
              "uncertainty": {"type": "object", "required": ["status"],
                              "properties": {"status": {"enum": ["estimated", "witnessed", "calibrated", "unverifiable"]}}},
              "provenance": {"type": "object", "required": ["measurement_hash", "source", "generated_by"]},
              "state": {"type": "object", "required": ["dimension", "range"]},
              "event_hash": {"type": "string", "pattern": "^sha256:[0-9a-f]{64}$"},
              "instrument": inst}}
    return {"$schema": "https://json-schema.org/draft/2020-12/schema", "$id": BASE + "receipt.schema.json",
            "title": "Instrument reading receipt: a measurement-bus/v1 event with the every-dimension state block "
                     "and one added `instrument` key",
            "description": "Extends project-telos.measurement-bus/v1 (17 fields) and every-dimension.state/0.1 "
                           "(state block). Rule: calibration.uncal is true whenever no calibration record exists, "
                           "any self-test that ran failed, or the record has expired; then uncertainty.status must "
                           "not be 'calibrated'.",
            "type": "object", "required": ["schema", "tool", "generated_at", "channels", "events", "receipt_hash"],
            "properties": {"schema": S, "tool": S, "generated_at": S, "channels": arr(S, 1),
                           "events": arr(ev, 1), "receipt_hash": {"type": "string", "pattern": "^sha256:[0-9a-f]{64}$"}}}


def main():
    OUT.mkdir(exist_ok=True)
    for num, key, title, spec in STAGES:
        (OUT / f"stage-{num}-{key}.schema.json").write_text(json.dumps(stage_schema(num, key, title, spec), indent=1) + "\n",
                                                            encoding="utf-8")
    (OUT / "instrument.schema.json").write_text(json.dumps(instrument_schema(), indent=1) + "\n", encoding="utf-8")
    (OUT / "receipt.schema.json").write_text(json.dumps(receipt_schema(), indent=1) + "\n", encoding="utf-8")
    print("wrote", len(STAGES) + 2, "schemas to", OUT)


if __name__ == "__main__":
    main()
