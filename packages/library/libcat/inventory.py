# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Load INVENTORY.tsv (the consolidation pass) into the catalogue, with sha256s.

Read-only on the inventoried files. Rows whose file is gone are kept with
status 'missing' so a later move or delete is visible, never silent.
"""
from __future__ import annotations

import csv
import os
import re
import sys

from . import schema

CLUSTER_KIND = {
    "machine output": "machine",
    "evidence and raw captures": "evidence",
    "agent report": "report",
    "data records": "data",
    "intake note": "intake",
    "scratch": "scratch",
    "journal": "journal",
    "study": "study",
    "corpus text": "corpus",
    "memory": "memory",
    "plan": "plan",
    "living canon": "canon",
    "work content": "game-content",
}
INTAKE_DOC = "REFERENCE-INTAKE"  # files under <its folder>/_archive/ were folded into it


def kind_of(cluster: str, flags: str) -> str:
    if "prereg" in flags:
        return "prereg"
    for prefix, kind in CLUSTER_KIND.items():
        if cluster.startswith(prefix):
            return kind
    return "other"


def home_of(target: str, homes) -> str | None:
    """The registered living document an inventory target names, exactly or inside its text."""
    if target in homes:
        return target
    t = target.lower()
    for doc in homes:
        if doc in target or doc.lower().replace("-", " ") in t:
            return doc
    return None


def _registry(conn):
    rows = conn.execute("SELECT name, path FROM living_docs").fetchall()
    homes = {r[0] for r in rows}
    intake = [r[1] for r in rows if r[0] == INTAKE_DOC]
    archive = os.path.join(os.path.dirname(intake[0]), "_archive") + os.sep if intake else None
    return homes, archive


def retention_of(kind: str, flags: str) -> str:
    if kind == "machine":
        return "expire"
    if kind in ("evidence", "data", "prereg", "corpus", "memory", "game-content"):
        return "permanent"
    if "sealed-archive" in flags or "hash-anchored" in flags:
        return "permanent"
    if kind in schema.NOTES_KINDS or kind == "canon":
        return "fold"
    return "keep"


def _rows(tsv: str):
    csv.field_size_limit(1 << 30)
    with open(tsv, encoding="utf-8", newline="") as f:
        first = f.readline()
        if not first.startswith("#"):
            f.seek(0)
        yield from csv.DictReader(f, delimiter="\t", quoting=csv.QUOTE_NONE)


def import_inventory(conn, tsv: str, hash_files: bool = True, progress=None) -> dict:
    stats = {"rows": 0, "hashed": 0, "missing": 0, "bodies": 0}
    dup_first: dict[str, int] = {}
    homes, archive = _registry(conn)
    ts = schema.now()
    for row in _rows(tsv):
        stats["rows"] += 1
        path = row["path"]
        flags = row.get("flags") or ""
        kind = kind_of(row.get("cluster") or "", flags)
        sha, size = (schema.sha256_file(path) if hash_files else (None, None))
        status = "live"
        if hash_files and sha is None:
            status = "missing"
            stats["missing"] += 1
        elif sha:
            stats["hashed"] += 1
        if "\\_archive\\" in path:
            status = "archived" if status == "live" else status
        topic = row.get("topic") or row.get("first_heading") or ""
        cur = conn.execute(
            "INSERT INTO artifacts(path, kind, project, home, date, mtime, size, sha256, topic,"
            " status, retention, flags, source, added_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            " ON CONFLICT(path) DO UPDATE SET kind=excluded.kind, home=excluded.home,"
            " size=excluded.size, sha256=excluded.sha256, status=excluded.status,"
            " flags=excluded.flags RETURNING id",
            (path, kind, schema.project_from_path(path), home_of(row.get("target") or "", homes),
             row.get("date"), row.get("mtime"), size if size is not None else _int(row.get("size_bytes")),
             sha, topic, status, retention_of(kind, flags), flags, "inventory", ts),
        )
        art_id = cur.fetchone()[0]
        body = ""
        if kind != "machine" and status != "missing":
            body = schema.read_body(path)
            if body:
                stats["bodies"] += 1
        schema.upsert_fts(conn, art_id, path, topic, body)
        _links(conn, art_id, path, row, flags, dup_first, homes, archive)
        if progress and stats["rows"] % 5000 == 0:
            progress(stats)
            conn.commit()
    conn.commit()
    return stats


def _links(conn, art_id, path, row, flags, dup_first, homes, archive):
    target = row.get("target") or ""
    home = home_of(target, homes)
    if home:
        conn.execute("INSERT OR IGNORE INTO links VALUES (?,?,?)",
                     (art_id, "folds-into(proposed)", home))
    if archive and os.path.normcase(path).startswith(os.path.normcase(archive)):
        conn.execute("INSERT OR IGNORE INTO links VALUES (?,?,?)",
                     (art_id, "folded-into", INTAKE_DOC))
    m = re.search(r"dup:(D\d+)", flags)
    if m:
        group = m.group(1)
        if group in dup_first:
            first = conn.execute("SELECT path FROM artifacts WHERE id=?",
                                 (dup_first[group],)).fetchone()[0]
            conn.execute("INSERT OR IGNORE INTO links VALUES (?,?,?)",
                         (art_id, "duplicate-of", first))
        else:
            dup_first[group] = art_id


def _int(v):
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def stderr_progress(stats):
    print(f"  {stats['rows']} rows, {stats['hashed']} hashed, {stats['missing']} missing",
          file=sys.stderr, flush=True)
