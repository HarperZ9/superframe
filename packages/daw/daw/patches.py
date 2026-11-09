# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The patch library (gap G2): an instrument as a JSON record with a content hash, saved, recalled by name and
version, and listed.

A patch is {"name", "version", "engine", "params", "inserts", "track"}:
- engine names how a note is made (ENGINES in voices.py): a modal object of a measured material and a shape,
  the waveguide piano, the electric piano, a plucked waveguide string, a bowed string, a noise floor;
- params are that engine's arguments, plain JSON numbers and strings;
- inserts are the track's effects chain, [[name, {args}], ...], from INSERTS in voices.py;
- track holds mixer defaults (gain_db, pan, send) a piece may override.
The hash is the sha256 of the record's superstack canonical JSON, so the same sound always has the same hash,
and a piece can name its sounds by hash. A record saved under a name and version that already holds a
different hash is refused: a version is never rewritten.
"""
import json
from pathlib import Path

from . import superstack as ss
from .arrange import Track

KEYS = ("name", "version", "engine", "params", "inserts", "track")


def patch(name, engine, params, inserts=(), track=None, version=1):
    """A patch record, normalised to plain JSON types (tuples become lists)."""
    rec = {"name": name, "version": int(version), "engine": engine, "params": params,
           "inserts": [[k, a] for k, a in inserts], "track": track or {}}
    return json.loads(json.dumps(rec))


def digest(rec):
    """Content hash of a patch: sha256 of its canonical JSON over the six keys."""
    return ss.canonical_sha256({k: rec[k] for k in KEYS})


class Library:
    """Patches on disk as <root>/<name>@<version>.json, each file carrying its own hash."""

    def __init__(self, root):
        self.root = Path(root)

    def path(self, name, version):
        return self.root / f"{name}@{int(version)}.json"

    def save(self, rec):
        self.root.mkdir(parents=True, exist_ok=True)
        h = digest(rec)
        p = self.path(rec["name"], rec["version"])
        if p.exists():
            old = json.loads(p.read_text(encoding="utf-8"))
            if old["sha256"] != h:
                raise ValueError(f"{p.name} already holds a different patch; save it as a new version")
            return h
        p.write_text(json.dumps(dict(rec, sha256=h), indent=1, sort_keys=True), encoding="utf-8")
        return h

    def versions(self, name):
        return sorted(int(p.stem.split("@")[1]) for p in self.root.glob(f"{name}@*.json"))

    def load(self, name, version=None):
        """Recall by name (the latest version unless one is given); the stored hash is checked."""
        vs = self.versions(name)
        if not vs:
            raise KeyError(f"no patch named {name!r} in {self.root}")
        v = vs[-1] if version is None else int(version)
        doc = json.loads(self.path(name, v).read_text(encoding="utf-8"))
        rec = {k: doc[k] for k in KEYS}
        if digest(rec) != doc["sha256"]:
            raise ValueError(f"{name}@{v}: stored hash does not match the record")
        return rec

    def list(self):
        """[(name, version, sha256)] for every patch in the library, sorted."""
        out = []
        for p in sorted(self.root.glob("*@*.json")):
            doc = json.loads(p.read_text(encoding="utf-8"))
            out.append((doc["name"], doc["version"], doc["sha256"]))
        return out


def track(rec, notes, name=None, **overrides):
    """A Track playing a patch: the instrument and its inserts built from the record, mixer values from the
    record's track defaults, then from overrides."""
    from .voices import build, build_inserts
    kw = dict(rec.get("track") or {})
    kw.update(overrides)
    return Track(name or rec["name"], build(rec), notes, inserts=build_inserts(rec), **kw)
