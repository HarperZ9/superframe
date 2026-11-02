# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Shared build helpers. Run every build script with python -I; raw paths come from measured.prov
(the MEASURED_REFS environment variable).

write(name, table) writes a public table to data/. write(name, table, private=reason) writes it to
the private folder (MEASURED_PRIVATE, or data/private/, both outside the public tree) and records
its file name, sha256, row count and reason in data/PRIVATE.json, the public hash-only index.
A private overlay of a public table is written as <name>.private.json with field=<key or "rows">.
"""
import hashlib
import json
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PKG))
from measured import prov, private_dir  # noqa: E402,F401

DATA = PKG / "data"
INDEX = DATA / "PRIVATE.json"


def _dump(table):
    return json.dumps(table, indent=1, ensure_ascii=False) + "\n"


def count_rows(table):
    """Rows of a table: its rows list, else the number of points at any depth, where a point is a
    flat dict or a list of scalars inside a list (the samples of digitised curves)."""
    if isinstance(table.get("rows"), list):
        return len(table["rows"])

    def flat(x):
        vals = x.values() if isinstance(x, dict) else x
        return isinstance(x, (dict, list)) and not any(isinstance(y, (dict, list)) for y in vals)

    def walk(v):
        if isinstance(v, list):
            if flat(v):
                return len(v)  # a column of scalars: one row per value
            return sum(1 if flat(x) else walk(x) for x in v)
        if isinstance(v, dict):
            return sum(walk(x) for k, x in v.items() if k != "provenance")
        return 0
    return walk(table)


def _put(path, text):
    """Write UTF-8 with LF line ends on every platform, so a recorded sha256 matches the bytes on disk."""
    path.write_bytes(text.encode("utf-8"))


def record_private(file, text, rows, reason, field=None, **extra):
    idx = json.loads(INDEX.read_text(encoding="utf-8"))
    entry = {"file": file, **({"field": field} if field else {}),
             "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "rows": rows, "reason": reason, **extra}
    idx["entries"] = [e for e in idx["entries"] if (e["file"], e.get("field")) != (file, field)] + [entry]
    _put(INDEX, _dump(idx))


def write(name, table, private=None, field=None):
    text = _dump(table)
    if private:
        out = private_dir()
        out.mkdir(parents=True, exist_ok=True)
        p = out / (f"{name}.private.json" if field else f"{name}.json")
        record_private(f"{name}.json", text, count_rows(table), private, field=field,
                       **({"private_file": p.name} if field else {}))
    else:
        p = DATA / f"{name}.json"
    _put(p, text)
    n = len(table.get("rows", [])) if isinstance(table.get("rows"), list) else "-"
    print(f"wrote {p} rows={n}{' (private)' if private else ''}")
    return p
