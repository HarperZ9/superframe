# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Search the catalogue by text, project, kind, status and date."""
from __future__ import annotations

import re

_TOKEN = re.compile(r"[\w]+", re.UNICODE)


STOP = set("""a an and are as at be by can did do does for from had has have how i in is it its
of on or our should that the their them then there these this to under was we were what when
where which who whose why will with would you your about after before into than per via""".split())


# Names that changed: a query for either name finds files that use the other.
SYNONYMS = {
    "bdb": ("qdb", "BuildDB"), "qdb": ("bdb", "BuildDB"), "builddb": ("qdb", "bdb"),
    "cmmns": ("daylight",), "daylight": ("cmmns",),
    "plygrnd": ("playground",), "zentropy": ("harper",),
}


def fts_expr(text: str, raw: bool = False, any_word: bool = False) -> str:
    """Quote each word so user text never trips FTS5 syntax.

    Default: AND across every word. any_word: OR across the content words
    (stopwords dropped), so bm25 ranks by how many rare words a file holds.
    """
    if raw:
        return text
    words = _TOKEN.findall(text or "")
    if any_word:
        words = [w for w in words if w.lower() not in STOP and len(w) > 1] or words
        words += [s for w in words for s in SYNONYMS.get(w.lower(), ())]
        return " OR ".join(f'"{w}"' for w in dict.fromkeys(words))
    return " ".join(f'"{w}"' for w in words)


def search(conn, text: str = "", project: str | None = None, kind: str | None = None,
           status: str | None = None, since: str | None = None, until: str | None = None,
           home: str | None = None, limit: int = 20, raw: bool = False):
    """Rank by bm25 over the content words, any of which may match.

    Measured on a private 40-question recall bench over the author's catalogue
    (2026-10-29; the bench stays with that catalogue): requiring every word found
    9 of 40 sources in the top 5; any-word bm25 found 36. raw=True passes FTS5
    syntax through for exact phrase or boolean queries.
    """
    filters = (project, kind, status, since, until, home, limit)
    if not text.strip():
        return _search(conn, "", *filters)
    expr = fts_expr(text, raw, any_word=not raw)
    if not expr:
        return []
    return _search(conn, expr, *filters)


def _search(conn, expr, project, kind, status, since, until, home, limit):
    where, args = [], []
    text = expr
    select = ("SELECT a.id, a.path, a.kind, a.project, a.home, a.date, a.status, a.sha256,"
              " a.topic, a.size")
    if text.strip():
        select += (", snippet(artifacts_fts, 2, '[', ']', ' ... ', 12) AS snip,"
                   " bm25(artifacts_fts, 4.0, 8.0, 1.0) AS rank"
                   " FROM artifacts_fts JOIN artifacts a ON a.id = artifacts_fts.rowid")
        where.append("artifacts_fts MATCH ?")
        args.append(expr)
        order = "rank"
    else:
        select += ", '' AS snip, 0 AS rank FROM artifacts a"
        order = "a.date DESC, a.path"
    if project:
        where.append("(a.project LIKE ? OR a.home LIKE ?)")
        args += [f"%{project}%", f"%{project}%"]
    if kind:
        where.append("a.kind = ?")
        args.append(kind)
    if status:
        where.append("a.status = ?")
        args.append(status)
    if home:
        where.append("a.home = ?")
        args.append(home)
    if since:
        where.append("a.date >= ?")
        args.append(since)
    if until:
        where.append("a.date <= ?")
        args.append(until + "￿")
    sql = select + (" WHERE " + " AND ".join(where) if where else "") + f" ORDER BY {order} LIMIT ?"
    args.append(int(limit))
    return [dict(r) for r in conn.execute(sql, args).fetchall()]


def where_to_write(conn, topic: str):
    from . import ingest, living
    return living.match(topic, ingest._docs(conn))


def stats(conn) -> dict:
    out = {"artifacts": conn.execute("SELECT count(*) FROM artifacts").fetchone()[0]}
    for col in ("kind", "status", "retention", "home"):
        out[col] = {str(k): n for k, n in conn.execute(
            f"SELECT {col}, count(*) FROM artifacts GROUP BY 1 ORDER BY 2 DESC").fetchall()}
    out["links"] = {k: n for k, n in conn.execute(
        "SELECT rel, count(*) FROM links GROUP BY 1").fetchall()}
    out["refusals"] = conn.execute("SELECT count(*) FROM refusals").fetchone()[0]
    out["hashed"] = conn.execute(
        "SELECT count(*) FROM artifacts WHERE sha256 IS NOT NULL").fetchone()[0]
    return out
