# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Write font.golden.json from Flywheel's own font writers, before the port runs.

    git -C <flywheel> archive 681810fe harness/__init__.py harness/typeface_forge.py \
        harness/typeface_skeletons.py harness/typeface_ttf.py harness/typeface_variable.py \
        harness/typeface_family.py | tar -x -C <dir>
    python -I packages/studio/goldens/font_from_flywheel.py <dir> 681810fe

The goldens come from the source commit, never from packages/studio, so the port cannot pass by
comparing against itself. Each case keeps the sha256 and byte length of the font Flywheel wrote.
"""
import hashlib
import json
import sys
from pathlib import Path

SRC = Path(sys.argv[1]).resolve()
COMMIT = sys.argv[2]
sys.path.insert(0, str(SRC))

from harness.typeface_forge import DEFAULTS, mint  # noqa: E402
from harness.typeface_ttf import to_ttf  # noqa: E402
from harness.typeface_family import mint_variable_family  # noqa: E402

STATIC = [
    {"name": "regular-seed58", "params": {}, "seed": 58, "family": "Zain Mint", "style": "Regular"},
    {"name": "medium-narrow", "params": {"weight": 0.112, "width": 0.9, "contrast": 0.7}, "seed": 7,
     "family": "Studio Test", "style": "Medium"},
    {"name": "light-tall-round", "params": {"weight": 0.058, "x_height": 0.52, "roundness": 3.0, "aperture": 0.4},
     "seed": 3, "family": "Zain Mint", "style": "Light"},
]
VARIABLE = [
    {"name": "default-family", "params": {}, "seed": 58, "family": "Zain Mint", "instances": None},
    {"name": "three-masters", "params": {"width": 1.05}, "seed": 11, "family": "Studio Var",
     "instances": [["Thin", 0.05], ["Book", 0.09], ["Heavy", 0.13]]},
    {"name": "one-refused", "params": {}, "seed": 58, "family": "Zain Mint",
     "instances": [["Light", 0.058], ["Regular", 0.085], ["Black", 0.3]]},
    {"name": "too-few-masters", "params": {}, "seed": 58, "family": "Zain Mint",
     "instances": [["Regular", 0.085], ["Black", 0.3]]},
]


def sha(b):
    return hashlib.sha256(b).hexdigest()


def main():
    out = {"schema": "superframe.studio.golden/1", "port": "font",
           "source": f"HarperZ9/flywheel@{COMMIT}",
           "sourceFiles": {p.name: sha(p.read_bytes().replace(b"\r\n", b"\n"))
                           for p in sorted((SRC / "harness").glob("typeface_*.py"))},
           "static": [], "variable": []}
    for c in STATIC:
        face = mint({**DEFAULTS, **c["params"]}, seed=c["seed"])
        assert not face["refused"], face["refusals"]
        ttf = to_ttf(face, family=c["family"], style=c["style"])
        out["static"].append({**c, "ttf_sha256": sha(ttf), "bytes": len(ttf)})
    for c in VARIABLE:
        inst = [tuple(r) for r in c["instances"]] if c["instances"] else None
        r = mint_variable_family(c["params"], seed=c["seed"], family=c["family"], instances=inst)
        row = {**c, "refused": r["refused"], "refusals": r["refusals"],
               "refused_styles": [x["style"] for x in r.get("refused_instances", r.get("receipt", {}).get("refused_instances", []))]}
        if not r["refused"]:
            import base64
            ttf = base64.b64decode(r["ttf_b64"])
            row.update({"ttf_sha256": sha(ttf), "bytes": len(ttf),
                        "refused_styles": [x["style"] for x in r["receipt"]["refused_instances"]]})
        out["variable"].append(row)
    dest = Path(__file__).with_name("font.golden.json")
    dest.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {dest.name}: {len(out['static'])} static, {len(out['variable'])} variable")


if __name__ == "__main__":
    main()
