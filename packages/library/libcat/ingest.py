# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Add one artifact to the catalogue, and the no-new-notes-file rule.

The rule: a notes file (.md, .txt and the like, of a notes kind) whose topic
has a living document is refused. The caller is told which document to append
a dated section to. Data, code, preregistrations, evidence and media are never
refused. A living document itself is always accepted.
"""
from __future__ import annotations

import json
import os
import sys
from datetime import datetime

from . import living, schema

EXEMPT_KINDS = {"data", "code", "prereg", "evidence", "media", "corpus", "machine",
                "game-content", "model", "archive", "memory", "canon-mirror"}


class Refused(Exception):
    def __init__(self, path, doc):
        self.path, self.doc = path, doc
        name, dpath, state, _score = doc
        how = ("append a dated section to it" if state == "live"
               else "it is planned but not written yet; create it at that path and write the section there")
        super().__init__(
            f"refused: {path} is a new notes file, and the living document {name} "
            f"({dpath}) covers this topic; {how}. Nothing was catalogued.")


def guess_kind(path: str) -> str:
    ext = os.path.splitext(path)[1].lower()
    low = os.path.normcase(path)
    name = os.path.basename(low)
    in_claude = os.path.normcase(os.sep + ".claude" + os.sep) in low
    if in_claude and os.path.normcase(os.sep + "memory" + os.sep) in low:
        return "memory"
    if "prereg" in name:
        return "prereg"
    if ext in schema.NOTE_EXT:
        return "note"
    if ext in {".json", ".jsonl", ".tsv", ".csv", ".parquet", ".npz", ".sqlite", ".db"}:
        return "data"
    if ext in {".py", ".rs", ".js", ".ts", ".c", ".cpp", ".h", ".hlsl", ".bld", ".ps1", ".sh"}:
        return "code"
    if ext in {".png", ".jpg", ".jpeg", ".gif", ".webp", ".mp4", ".mkv", ".wav", ".flac", ".pdf"}:
        return "media"
    return "other"


def check(conn, path: str, kind: str, topic: str, project: str):
    """Return the living doc tuple that blocks this file, or None."""
    if kind in EXEMPT_KINDS:
        return None
    if os.path.splitext(path)[1].lower() not in schema.NOTE_EXT:
        return None
    if living.is_living_doc(path, _docs(conn)):
        return None
    if "\\_archive\\" in path or "/_archive/" in path:
        return None
    known = conn.execute("SELECT 1 FROM artifacts WHERE path=?", (path,)).fetchone()
    if known:
        return None  # already catalogued before the rule: re-ingest updates it
    return living.match(f"{topic} {project} {os.path.basename(path)}", _docs(conn))


def _docs(conn):
    rows = conn.execute("SELECT name, path, state, keywords FROM living_docs").fetchall()
    if not rows:
        return living.load_registry()
    return [(r["name"], r["path"], r["state"], r["keywords"].split("|")) for r in rows]


def ingest(conn, path: str, kind: str | None = None, project: str | None = None,
           topic: str | None = None, session_id: str | None = None,
           status: str = "live", links=(), note: str | None = None,
           enforce: bool = True) -> int:
    path = os.path.abspath(path)
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    kind = kind or guess_kind(path)
    body = schema.read_body(path)
    topic = topic or schema.first_heading(body) or os.path.basename(path)
    project = project if project is not None else schema.project_from_path(path)
    blocker = check(conn, path, kind, topic, project) if enforce else None
    if blocker:
        conn.execute("INSERT INTO refusals(path, topic, living_doc, session_id, at) "
                     "VALUES (?,?,?,?,?)", (path, topic, blocker[0], session_id, schema.now()))
        conn.commit()
        raise Refused(path, blocker)
    sha, size = schema.sha256_file(path)
    home = living.match(f"{topic} {project}", _docs(conn))
    mtime = schema.datetime.fromtimestamp(os.path.getmtime(path)).strftime("%Y-%m-%d")
    retention = "fold" if kind in schema.NOTES_KINDS else (
        "permanent" if kind in ("prereg", "evidence", "data") else "keep")
    cur = conn.execute(
        "INSERT INTO artifacts(path, kind, project, home, date, mtime, size, sha256, topic,"
        " status, retention, source, session_id, note, added_at)"
        " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        " ON CONFLICT(path) DO UPDATE SET kind=excluded.kind, project=excluded.project,"
        " home=excluded.home, mtime=excluded.mtime, size=excluded.size,"
        " sha256=excluded.sha256, topic=excluded.topic, status=excluded.status,"
        " session_id=COALESCE(excluded.session_id, artifacts.session_id),"
        " note=COALESCE(excluded.note, artifacts.note) RETURNING id",
        (path, kind, project, home[0] if home else None, mtime, mtime, size, sha, topic,
         status, retention, "ingest", session_id, note, schema.now()),
    )
    art_id = cur.fetchone()[0]
    schema.upsert_fts(conn, art_id, path, topic, body)
    for rel, dst in links:
        conn.execute("INSERT OR IGNORE INTO links VALUES (?,?,?)", (art_id, rel, dst))
    conn.commit()
    return art_id


WRITE_TOOLS = {"Write", "Edit", "MultiEdit", "NotebookEdit"}


def written_paths(transcript: str) -> list[str]:
    """Every file a session (and its subagents) wrote through a file tool.

    Reads the jsonl transcript, plus <session>/subagents/*.jsonl beside it.
    Files written by shell commands are not seen; the walk-based capture covers
    those when a caller passes roots.
    """
    files = [transcript]
    sub = os.path.join(os.path.splitext(transcript)[0], "subagents")
    if os.path.isdir(sub):
        files += [os.path.join(sub, f) for f in sorted(os.listdir(sub)) if f.endswith(".jsonl")]
    seen: dict[str, str] = {}
    for fp in files:
        try:
            fh = open(fp, encoding="utf-8", errors="replace")
        except OSError:
            continue
        with fh:
            for line in fh:
                if '"tool_use"' not in line:
                    continue
                for path in _tool_paths(line):
                    seen.setdefault(os.path.normcase(os.path.abspath(path)), os.path.abspath(path))
    return list(seen.values())


def _tool_paths(line: str):
    import json
    try:
        msg = json.loads(line).get("message") or {}
    except ValueError:
        return
    content = msg.get("content")
    if not isinstance(content, list):
        return
    for item in content:
        if isinstance(item, dict) and item.get("type") == "tool_use" \
                and item.get("name") in WRITE_TOOLS:
            p = (item.get("input") or {}).get("file_path") or \
                (item.get("input") or {}).get("notebook_path")
            if isinstance(p, str) and p:
                yield p


def _born(path: str) -> float:
    """Creation time where the platform records one (Windows, macOS). Elsewhere st_ctime, the last inode change."""
    st = os.stat(path)
    return getattr(st, "st_birthtime", st.st_ctime)


def _session_start(transcript: str) -> float:
    """When the session began: the transcript's creation time, or its first record's timestamp on Linux,
    where rewriting the file moves st_ctime and Python exposes no creation time."""
    st = os.stat(transcript)
    if hasattr(st, "st_birthtime"):
        return st.st_birthtime
    try:
        with open(transcript, encoding="utf-8") as fh:
            stamp = json.loads(fh.readline()).get("timestamp")
        return datetime.fromisoformat(stamp.replace("Z", "+00:00")).timestamp()
    except (OSError, ValueError, AttributeError) as exc:
        print(f"library: no timestamp in the first record of {transcript} ({exc}); using its st_ctime", file=sys.stderr)
        return st.st_ctime


def capture_transcript(conn, transcript: str, session_id: str):
    """Catalogue what the session wrote. Returns (ingested_ids, refusals, skipped).

    The no-new-notes rule applies only to files created after the session
    started. Edits to files that already existed are catalogued without the rule.
    Limit: without a creation time (Linux), an edited old file counts as new, so the
    rule applies to it too.
    """
    done, refused, skipped = [], [], []
    try:
        started = _session_start(transcript)
    except OSError:
        started = 0.0
    for p in written_paths(transcript):
        if not os.path.isfile(p):
            skipped.append(p)
            continue
        try:
            new_file = _born(p) >= started
            done.append(ingest(conn, p, session_id=session_id, enforce=new_file))
        except Refused as exc:
            refused.append((p, exc.doc[0]))
        except OSError:
            skipped.append(p)
    return done, refused, skipped


def capture(conn, roots, since_epoch: float, session_id: str, skip_dirs=None):
    """Catalogue every file under roots modified at or after since_epoch.

    Returns (ingested_ids, refusals). Refused notes files stay on disk; the
    refusal is recorded so the end-of-session report can name them.
    """
    skip = {s.lower() for s in (skip_dirs or {".git", "node_modules", "__pycache__",
                                               ".venv", "venv", "target", ".pytest_cache"})}
    done, refused = [], []
    for root in roots:
        for dirpath, dirnames, filenames in os.walk(root):
            dirnames[:] = [d for d in dirnames if d.lower() not in skip]
            for fn in filenames:
                p = os.path.join(dirpath, fn)
                try:
                    if os.path.getmtime(p) < since_epoch:
                        continue
                except OSError:
                    continue
                try:
                    done.append(ingest(conn, p, session_id=session_id))
                except Refused as exc:
                    refused.append((p, exc.doc[0]))
    return done, refused
