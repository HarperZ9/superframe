# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Catalogue schema and connection helpers. One SQLite file, FTS5 for text."""
from __future__ import annotations

import hashlib
import os
import sqlite3
from datetime import datetime, timezone

DB_ENV = "LIBRARY_DB"  # path of the catalogue file; required (or pass --db)
ANCHORS_ENV = "LIBRARY_PROJECT_ANCHORS"  # comma-separated folder names; see project_from_path
DEFAULT_ANCHORS = ("notes", "public", "dev")

SCHEMA = """
CREATE TABLE IF NOT EXISTS artifacts(
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  project TEXT,
  home TEXT,
  date TEXT,
  mtime TEXT,
  size INTEGER,
  sha256 TEXT,
  topic TEXT,
  status TEXT NOT NULL DEFAULT 'live'
    CHECK(status IN ('live','archived','superseded','missing')),
  retention TEXT NOT NULL DEFAULT 'keep'
    CHECK(retention IN ('keep','permanent','fold','expire')),
  flags TEXT,
  source TEXT NOT NULL,
  session_id TEXT,
  note TEXT,
  added_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_art_kind ON artifacts(kind);
CREATE INDEX IF NOT EXISTS ix_art_project ON artifacts(project);
CREATE INDEX IF NOT EXISTS ix_art_home ON artifacts(home);
CREATE INDEX IF NOT EXISTS ix_art_date ON artifacts(date);
CREATE INDEX IF NOT EXISTS ix_art_sha ON artifacts(sha256);
CREATE TABLE IF NOT EXISTS links(
  src_id INTEGER NOT NULL REFERENCES artifacts(id),
  rel TEXT NOT NULL,
  dst_path TEXT NOT NULL,
  PRIMARY KEY(src_id, rel, dst_path)
);
CREATE TABLE IF NOT EXISTS living_docs(
  name TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('live','proposed')),
  keywords TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS refusals(
  id INTEGER PRIMARY KEY,
  path TEXT NOT NULL,
  topic TEXT,
  living_doc TEXT NOT NULL,
  session_id TEXT,
  at TEXT NOT NULL
);
CREATE VIRTUAL TABLE IF NOT EXISTS artifacts_fts USING fts5(
  path, topic, body, tokenize='porter unicode61'
);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
"""

NOTE_EXT = {".md", ".txt", ".rst", ".org", ".markdown"}
NOTES_KINDS = {"note", "report", "plan", "journal", "intake", "scratch", "study"}
BODY_LIMIT = 256 * 1024


def now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def connect(db: str) -> sqlite3.Connection:
    parent = os.path.dirname(os.path.abspath(db))
    os.makedirs(parent, exist_ok=True)
    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.executescript(SCHEMA)
    conn.execute("INSERT OR IGNORE INTO meta VALUES('schema','library.catalogue/v1')")
    return conn


def sha256_file(path: str):
    """Return (hex, size) or (None, None) when the file cannot be read."""
    h = hashlib.sha256()
    try:
        with open(path, "rb") as f:
            size = 0
            for chunk in iter(lambda: f.read(1 << 20), b""):
                h.update(chunk)
                size += len(chunk)
    except OSError:
        return None, None
    return h.hexdigest(), size


def read_body(path: str) -> str:
    if os.path.splitext(path)[1].lower() not in NOTE_EXT:
        return ""
    try:
        with open(path, "rb") as f:
            raw = f.read(BODY_LIMIT)
    except OSError:
        return ""
    return raw.decode("utf-8", errors="replace")


def first_heading(body: str) -> str:
    for line in body.splitlines():
        s = line.strip()
        if s.startswith("#"):
            return s.lstrip("#").strip()[:200]
    for line in body.splitlines():
        if line.strip() and not line.strip().startswith("<!--"):
            return line.strip()[:200]
    return ""


def anchors():
    v = os.environ.get(ANCHORS_ENV)
    return tuple(a.strip().lower() for a in v.split(",") if a.strip()) if v else DEFAULT_ANCHORS


def project_from_path(path: str) -> str:
    """The folder under the first anchor folder found (anchors tried in order), date prefix removed."""
    parts = os.path.normpath(path).split(os.sep)
    low = [p.lower() for p in parts]
    for anchor in anchors():
        if anchor in low:
            i = low.index(anchor)
            if i + 1 < len(parts) - 1:
                return _strip_date(parts[i + 1])
    return ""


def _strip_date(slug: str) -> str:
    import re
    return re.sub(r"^\d{4}-\d{2}(-\d{2})?-?", "", slug) or slug


def upsert_fts(conn, art_id: int, path: str, topic: str, body: str):
    conn.execute("DELETE FROM artifacts_fts WHERE rowid=?", (art_id,))
    conn.execute(
        "INSERT INTO artifacts_fts(rowid, path, topic, body) VALUES (?,?,?,?)",
        (art_id, path.replace("\\", " ").replace("-", " "), topic or "", body or ""),
    )
