# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The every-dimension state: Telos measurement-bus/v1 events, extended, never replaced.

Each channel is one event with the seventeen bus fields of
public/telos/demo/integrations/measurement-layers.json (event_id ... event_hash). The extension
lives in one added key, `state`, so a Telos bus reader that ignores unknown keys still reads every
event. `state` carries what the bus lacks:

  dimension      which of the twelve dimensions the channel covers
  range          [lo, hi] the value can take, in `units`
  information    bits the channel keeps of its source (isomorphism metric), where defined
  homeostasis    set point, band, current error, effector, effector tier, loop (closed | open),
                 time constant and overshoot when measured

Hashes are sha256 over canonical JSON (the Telos demo uses 32-bit FNV-1a; sha256 is the
membrane Observation's digest form and is what this extension uses).
"""
import hashlib
import json

BUS_FIELDS = ["event_id", "run_id", "frame_id", "actor", "domain", "subject_ref", "timestamp",
              "clock_domain", "coordinate_space", "units", "value_shape", "value", "uncertainty",
              "provenance", "privacy", "severity", "event_hash"]
SCHEMA = "every-dimension.state/0.1 (extends project-telos.measurement-bus/v1)"


def sha(obj):
    return "sha256:" + hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",", ":"),
                                                 default=float).encode()).hexdigest()


def event(run_id, frame_id, channel, *, domain, dimension, coordinate_space, units, value_shape, value,
          rng, uncertainty, source, timestamp, homeostasis=None, information=None, status="witnessed"):
    ev = {
        "event_id": f"{run_id}:{frame_id}:{channel}", "run_id": run_id, "frame_id": frame_id,
        "actor": "every-dimension.slice", "domain": domain, "subject_ref": channel,
        "timestamp": timestamp, "clock_domain": "host.perf_counter", "coordinate_space": coordinate_space,
        "units": units, "value_shape": value_shape, "value": value,
        "uncertainty": {"status": status, **uncertainty},
        "provenance": {"measurement_hash": sha(value), "source": source, "generated_by": "slice/scene.py"},
        "privacy": {"raw_payload_required": False, "exported_value_is_summary": True},
        "severity": "info",
        "state": {"dimension": dimension, "range": rng, "information": information,
                  "homeostasis": homeostasis},
    }
    ev["event_hash"] = sha({k: v for k, v in ev.items() if k != "event_hash"})
    return ev


def packet(run_id, frame_id, events, generated_at):
    p = {"schema": SCHEMA, "tool": "every-dimension.slice", "generated_at": generated_at, "run_id": run_id,
         "frame_id": frame_id, "bus_fields": BUS_FIELDS, "channels": [e["subject_ref"] for e in events],
         "events": events}
    p["receipt_hash"] = sha(p)
    return p


def model_view(p):
    """The non-vision view: one compact block per channel, value plus where it should be."""
    lines = [f"frame {p['frame_id']}"]
    for e in p["events"]:
        st = e["state"]
        lines.append(f"- {e['subject_ref']} [{st['dimension']}] units={json.dumps(e['units'])} "
                     f"range={st['range']} uncertainty={json.dumps(e['uncertainty'])}")
        lines.append(f"  value={json.dumps(e['value'], default=float)}")
        if st.get("information"):
            lines.append(f"  information={json.dumps(st['information'])}")
        if st.get("homeostasis"):
            lines.append(f"  homeostasis={json.dumps(st['homeostasis'])}")
    return "\n".join(lines)
