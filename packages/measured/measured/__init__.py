# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Measured-data package: normalised tables digested from primary sources, each row carrying its
provenance (source id, file, sha256, licence, status). Runtime code is stdlib only; the build
scripts under build/ may use numpy and PyMuPDF (research tools, not shipped dependencies).

Raw sources live outside the repo in the folder named by the MEASURED_REFS environment variable,
one subfolder per source with SOURCE.txt and SHA256SUMS. They are untrusted data: read only,
never executed, parsed with python -I.

Some tables are private: they are recorded by hash only in data/PRIVATE.json and are not in the
public tree. A private table, or a private overlay (<name>.private.json), is read from the folder
named by MEASURED_PRIVATE, or from data/private/ when that variable is unset. Both are gitignored.
load() merges an overlay when one is present and raises PrivateTable when a private table is absent.
"""
import json
import os
from pathlib import Path

DATA = Path(__file__).resolve().parent.parent / "data"


class PrivateTable(LookupError):
    """The table (or field) is private: listed in data/PRIVATE.json by hash, absent from this tree."""


def private_dir():
    env = os.environ.get("MEASURED_PRIVATE")
    return Path(env) if env else DATA / "private"


def private_index():
    """Hash-only records of every private table and field (file, sha256, rows, reason)."""
    return json.loads((DATA / "PRIVATE.json").read_text(encoding="utf-8"))["entries"]


def _read(p):
    return json.loads(p.read_text(encoding="utf-8"))


def _private_message(name, what=None):
    hit = [e for e in private_index() if e["file"] == f"{name}.json" and (what is None or e.get("field") == what)]
    rec = hit[0] if hit else {}
    part = f"field {what!r} of table {name!r}" if what else f"table {name!r}"
    return (f"{part} is private and not in the public repo (data/PRIVATE.json: sha256 {rec.get('sha256', '?')}, "
            f"rows {rec.get('rows', '?')}, reason: {rec.get('reason', '?')}). "
            f"Set MEASURED_PRIVATE to a folder that holds it, or place it in {DATA / 'private'}.")


def load(name):
    """Load one normalised table, e.g. load("tungsten_desai1984").

    A private overlay <name>.private.json, when present, is merged in: its rows are appended to the
    public rows and its other top-level keys are added. A private table that is absent raises PrivateTable."""
    pub, priv = DATA / f"{name}.json", private_dir() / f"{name}.json"
    if pub.exists():
        table = _read(pub)
    elif priv.exists():
        table = _read(priv)
    elif any(e["file"] == f"{name}.json" and "field" not in e for e in private_index()):
        raise PrivateTable(_private_message(name))
    else:
        raise FileNotFoundError(pub)
    over = private_dir() / f"{name}.private.json"
    if over.exists():
        extra = _read(over)
        rows = extra.pop("rows", [])
        extra.pop("provenance", None)
        if rows:
            table.setdefault("rows", []).extend(rows)
        table.update(extra)
    return table


def field(name, key):
    """One top-level field of a table; raises PrivateTable when the field is private and its overlay is absent."""
    table = load(name)
    if key in table:
        return table[key]
    if any(e["file"] == f"{name}.json" and e.get("field") == key for e in private_index()):
        raise PrivateTable(_private_message(name, key))
    raise KeyError((name, key))
