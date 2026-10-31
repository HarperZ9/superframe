# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Board materials for the 3D render and the trace-resistance back-annotation, read through the materials
library's own API (materials.get). Records the library lacks are written as assumed, with the reason, so the
render can show them and the coverage matrix can count them as gaps.

    python -I eda/build/board_materials.py           writes eda/data/board-materials.json
    python -I eda/build/board_materials.py --check   exit 1 when the file differs from a fresh export

The file is generated and kept in the repo; tests/test_materials_export.py fails when it drifts.
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "materials"))
import materials as M  # noqa: E402

OUT = Path(__file__).resolve().parent.parent / "data" / "board-materials.json"


def rec(mid, role):
    r = M.get(mid)
    s = r["optics"]["srgb_preview"]
    return {"role": role, "material": mid, "srgb": s["value"], "source": s["source"], "method": s.get("method", ""), "confidence": s["confidence"]}


def build():
    cu = M.get("copper")
    out = {
        "about": "Read through packages/materials (materials.get) on build; assumed entries have no record in that library.",
        "copper": rec("copper", "bare copper, traces and pour under the mask"),
        "enig": rec("gold", "ENIG pad finish (gold over nickel)"),
        "silk": rec("titanium_white", "silkscreen ink (a titanium white pigment)"),
        "fr4": {"role": "FR-4 laminate", "material": None, "srgb": [0.80, 0.74, 0.52], "source": "assumed", "confidence": "none", "method": "no FR-4 or epoxy record in the materials library; a woven-glass epoxy tan is assumed"},
        "mask": {"role": "solder mask, green", "material": None, "srgb": [0.06, 0.36, 0.20], "alpha": 0.62, "source": "assumed", "confidence": "none", "method": "no solder-mask record; colour and translucency assumed"},
        "epoxy_black": {"role": "IC and relay bodies", "material": None, "srgb": [0.09, 0.09, 0.10], "source": "assumed", "confidence": "none", "method": "no moulding-compound record"},
        "ceramic": {"role": "C0G capacitor body", "material": None, "srgb": [0.72, 0.62, 0.45], "source": "assumed", "confidence": "none", "method": "no barium-titanate or C0G ceramic record"},
        "copper_sigma": {"value": cu["electromagnetic"]["electrical_conductivity"]["value"], "unit": "S/m", "source": cu["electromagnetic"]["electrical_conductivity"]["source"], "confidence": cu["electromagnetic"]["electrical_conductivity"]["confidence"]},
        "copper_thickness_m": {"value": 35e-6, "source": "assumed, 1 oz/ft^2 finished copper"},
        "absent": ["FR-4 (glass-epoxy laminate): optics, permittivity, loss tangent", "solder mask", "IC moulding compound", "C0G ceramic", "tin and solder alloys"],
    }
    return out


def text(out):
    return json.dumps(out, indent=1)


def main(argv):
    out = build()
    if "--check" in argv:
        same = OUT.exists() and OUT.read_text(encoding="utf-8") == text(out)
        print("eda/data/board-materials.json", "matches a fresh export" if same else "differs from a fresh export")
        return 0 if same else 1
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(text(out), encoding="utf-8")
    print("wrote", OUT)
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
