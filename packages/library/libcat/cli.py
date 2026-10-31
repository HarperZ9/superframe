# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Command line: init, import-inventory, query, where, ingest, capture, stats."""
from __future__ import annotations

import argparse
import json
import os
import sys
import time

from . import ingest as ing
from . import inventory, living, query, schema


def _parser():
    p = argparse.ArgumentParser(prog="library", description="One catalogue for every artifact.")
    p.add_argument("--db", default=os.environ.get(schema.DB_ENV),
                   help=f"catalogue file (default: the {schema.DB_ENV} environment variable; required)")
    sub = p.add_subparsers(dest="cmd", required=True)
    sub.add_parser("init", help="create the database and seed the living-doc registry")
    imp = sub.add_parser("import-inventory", help="load INVENTORY.tsv with sha256s")
    imp.add_argument("tsv")
    imp.add_argument("--no-hash", action="store_true")
    q = sub.add_parser("query", help="search by text, project, kind, status, date")
    q.add_argument("text", nargs="?", default="")
    q.add_argument("--project")
    q.add_argument("--kind")
    q.add_argument("--status", choices=["live", "archived", "superseded", "missing"])
    q.add_argument("--home", help="living document name, e.g. FLYWHEEL")
    q.add_argument("--since", help="YYYY-MM-DD")
    q.add_argument("--until", help="YYYY-MM-DD")
    q.add_argument("--limit", type=int, default=20)
    q.add_argument("--raw", action="store_true", help="pass text to FTS5 unquoted")
    q.add_argument("--json", action="store_true")
    w = sub.add_parser("where", help="which living document a topic belongs in")
    w.add_argument("topic")
    i = sub.add_parser("ingest", help="catalogue one artifact (refuses new notes files)")
    i.add_argument("path")
    i.add_argument("--kind")
    i.add_argument("--project")
    i.add_argument("--topic")
    i.add_argument("--session")
    i.add_argument("--status", default="live",
                   choices=["live", "archived", "superseded"])
    i.add_argument("--link", action="append", default=[], metavar="REL=PATH")
    c = sub.add_parser("capture", help="catalogue files changed since a time (session end)")
    c.add_argument("--session", required=True)
    c.add_argument("--since", help="ISO time or epoch seconds (walk mode)")
    c.add_argument("--transcript", help="session jsonl: catalogue files the session wrote")
    c.add_argument("roots", nargs="*")
    sub.add_parser("stats")
    sub.add_parser("mcp", help="serve query, where, ingest and stats over MCP stdio")
    return p


def _since_epoch(v: str) -> float:
    try:
        return float(v)
    except ValueError:
        from datetime import datetime
        return datetime.fromisoformat(v.replace("Z", "+00:00")).timestamp()


def _print_rows(rows, as_json):
    if as_json:
        print(json.dumps(rows, indent=1))
        return
    for r in rows:
        print(f"{r['date'] or '----------'}  {r['kind']:<9} {r['status']:<8} "
              f"{(r['home'] or r['project'] or '-'):<26} {r['path']}")
        if r.get("snip"):
            print("    " + " ".join(r["snip"].split())[:220])
    print(f"({len(rows)} rows)", file=sys.stderr)


def _capture(a, conn) -> int:
    out = {"catalogued": 0, "refused": [], "skipped": []}
    if a.transcript:
        done, refused, skipped = ing.capture_transcript(conn, a.transcript, a.session)
        out["catalogued"] += len(done)
        out["refused"] += refused
        out["skipped"] += skipped
    if a.roots:
        if not a.since:
            print("walk mode needs --since", file=sys.stderr)
            return 2
        done, refused = ing.capture(conn, a.roots, _since_epoch(a.since), a.session)
        out["catalogued"] += len(done)
        out["refused"] += refused
    print(json.dumps(out, indent=1))
    return 3 if out["refused"] else 0


def main(argv=None) -> int:
    a = _parser().parse_args(argv)
    if not a.db:
        print(f"no catalogue: pass --db FILE or set {schema.DB_ENV}", file=sys.stderr)
        return 2
    if a.cmd == "mcp":
        from . import mcp
        return mcp.serve(a.db)
    conn = schema.connect(a.db)
    try:
        living.seed(conn)
        conn.commit()
        return _run(a, conn)
    finally:
        conn.close()


def _run(a, conn) -> int:
    if a.cmd == "init":
        print(f"catalogue ready at {a.db}")
    elif a.cmd == "import-inventory":
        t0 = time.time()
        st = inventory.import_inventory(conn, a.tsv, hash_files=not a.no_hash,
                                        progress=inventory.stderr_progress)
        conn.execute("INSERT OR REPLACE INTO meta VALUES('inventory_imported', ?)", (schema.now(),))
        conn.commit()
        print(json.dumps({**st, "seconds": round(time.time() - t0, 1)}))
    elif a.cmd == "query":
        _print_rows(query.search(conn, a.text, a.project, a.kind, a.status, a.since, a.until,
                                 a.home, a.limit, a.raw), a.json)
    elif a.cmd == "where":
        m = query.where_to_write(conn, a.topic)
        print(f"{m[0]} ({m[2]}): {m[1]}" if m else "no living document covers this topic")
    elif a.cmd == "ingest":
        links = [tuple(x.split("=", 1)) for x in a.link if "=" in x]
        try:
            art = ing.ingest(conn, a.path, a.kind, a.project, a.topic, a.session, a.status, links)
        except ing.Refused as exc:
            print(str(exc), file=sys.stderr)
            return 3
        except FileNotFoundError as exc:
            print(f"no such file: {exc}", file=sys.stderr)
            return 2
        print(f"catalogued id {art}: {os.path.abspath(a.path)}")
    elif a.cmd == "capture":
        return _capture(a, conn)
    elif a.cmd == "stats":
        print(json.dumps(query.stats(conn), indent=1))
    return 0
