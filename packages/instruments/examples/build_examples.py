# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Build, validate and render the worked examples.

    python -B build_examples.py

Writes examples/<id>.json (validated against schemas/instrument.schema.json and each stage schema) and
examples/<id>.md (a readable rendering of the same data). Exits 1 on any schema error.
"""
import json
import sys
from pathlib import Path

import jsonschema
from referencing import Registry, Resource

sys.dont_write_bytecode = True
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import ex_jnt  # noqa: E402
import ex_polariscope  # noqa: E402
import ex_room  # noqa: E402

SCHEMAS = HERE.parent / "schemas"


def registry():
    reg = Registry()
    for p in SCHEMAS.glob("*.schema.json"):
        s = json.loads(p.read_text(encoding="utf-8"))
        res = Resource.from_contents(s)
        reg = reg.with_resource(s["$id"], res).with_resource(p.name, res)
    return reg


def validate(doc, reg):
    top = json.loads((SCHEMAS / "instrument.schema.json").read_text(encoding="utf-8"))
    v = jsonschema.Draft202012Validator(top, registry=reg)
    errs = [f"{'/'.join(map(str, e.absolute_path))}: {e.message}" for e in v.iter_errors(doc)]
    return errs


def render(doc):
    L = [f"# {doc['name']}: the pipeline, stage by stage", "", doc["summary"], ""]
    for s in doc["stages"]:
        g = s["gate"]
        L += [f"## Stage {s['stage']}: {s['key'].replace('_', ' ')} ({s['status']})", "",
              f"- **In:** {'; '.join(s['inputs'])}", f"- **Out:** {'; '.join(s['outputs'])}",
              f"- **Gate:** {g['condition']}. Metric `{g['metric']} {g['op']} {g['threshold']}`; verdict **{g['verdict']}**"
              + (f", measured {g['measured']}" if "measured" in g else "") + (f" ({g['evidence']})" if g.get("evidence") else "") + ".",
              "- **Tools:** " + "; ".join(f"{t['name']} ({t['licence'] if not t['ours'] or t['licence'] != 'ours' else 'ours'}{', ours' if t['ours'] and t['licence'] != 'ours' else ''})" for t in s["tools"]) + ".", ""]
        for k, val in s["spec"].items():
            if isinstance(val, list) and val and isinstance(val[0], dict):
                L.append(f"**{k.replace('_', ' ')}**")
                L.append("")
                cols = list(val[0].keys())
                L.append("| " + " | ".join(cols) + " |")
                L.append("|" + "---|" * len(cols))
                for row in val:
                    L.append("| " + " | ".join(str(row.get(c, "")).replace("|", "/") if not isinstance(row.get(c), list)
                                               else ", ".join(row.get(c)) for c in cols) + " |")
                L.append("")
            elif isinstance(val, dict):
                L.append(f"**{k.replace('_', ' ')}:** " + "; ".join(f"{a}: {b}" for a, b in val.items()))
                L.append("")
            elif isinstance(val, list):
                L.append(f"**{k.replace('_', ' ')}:** " + ("; ".join(map(str, val)) if val else "none"))
                L.append("")
            else:
                L.append(f"**{k.replace('_', ' ')}:** {val}")
                L.append("")
        if s.get("notes"):
            L += [f"**Notes:** {s['notes']}", ""]
        L += [f"*Does not prove:* {s['does_not_prove']}", ""]
    return "\n".join(L)


def main():
    reg = registry()
    bad = 0
    for mod in (ex_jnt, ex_room, ex_polariscope):
        try:
            doc = mod.build()
        except FileNotFoundError as e:
            print(f"{mod.__name__}: its study results are private ({e.filename}); the committed record stands")
            continue
        errs = validate(doc, reg)
        for e in errs:
            print(f"{doc['id']}: {e}")
        bad += len(errs)
        (HERE / f"{doc['id']}.json").write_text(json.dumps(doc, indent=1) + "\n", encoding="utf-8")
        (HERE / f"{doc['id']}.md").write_text(render(doc) + "\n", encoding="utf-8")
        print(f"{doc['id']}: {len(doc['stages'])} stages, {len(errs)} schema errors")
    sys.exit(1 if bad else 0)


if __name__ == "__main__":
    main()
