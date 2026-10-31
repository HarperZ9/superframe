# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The registry of living documents and the topic matcher.

A living document is the one place a topic's notes go. New notes for a topic
with a living document are appended there as a dated section, never written as
a new file.

The registry is data, not code. It is read from the JSON file named by the
LIBRARY_LIVING_DOCS environment variable (format: living_docs.example.json).
A relative path in that file resolves against the file's own folder. With the
variable unset the registry is empty, and the catalogue keeps whatever
living_docs rows its database already holds.
"""
from __future__ import annotations

import json
import os
import re

REGISTRY_ENV = "LIBRARY_LIVING_DOCS"


def load_registry(path: str | None = None):
    """(name, path, state, keywords) tuples from the registry file, or [] when none is set.

    state: live = exists and takes appends now; proposed = planned, created at
    that path on first write.
    """
    path = path or os.environ.get(REGISTRY_ENV)
    if not path:
        return []
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    base = os.path.dirname(os.path.abspath(path))
    docs = []
    for d in data.get("docs", []):
        p = d["path"] if os.path.isabs(d["path"]) else os.path.join(base, d["path"])
        docs.append((d["name"], os.path.normpath(p), d["state"], list(d["keywords"])))
    return docs


_WORD = re.compile(r"[a-z0-9]+")


def _norm(text: str) -> str:
    return " " + " ".join(_WORD.findall((text or "").lower().replace("_", " "))) + " "


def match(text: str, docs=None):
    """Return (name, path, state, score) of the best living doc for text, or None.

    Multi-word keywords score 2, single words 1. Ties go to a live document,
    then to registry order. Score 0 means no living document covers the topic.
    """
    docs = docs if docs is not None else load_registry()
    hay = _norm(text)
    best = None
    for order, (name, path, state, kws) in enumerate(docs):
        score = 0
        for kw in kws:
            needle = _norm(kw)
            if needle.strip() and needle in hay:
                score += 2 if " " in needle.strip() else 1
        if score == 0:
            continue
        key = (score, 1 if state == "live" else 0, -order)
        if best is None or key > best[0]:
            best = (key, (name, path, state, score))
    return best[1] if best else None


def is_living_doc(path: str, docs=None) -> bool:
    docs = docs if docs is not None else load_registry()
    p = os.path.normcase(os.path.abspath(path))
    return any(os.path.normcase(os.path.abspath(d[1])) == p for d in docs)


def seed(conn, docs=None):
    docs = docs if docs is not None else load_registry()
    for name, path, state, kws in docs:
        if state == "proposed" and os.path.exists(path):
            state = "live"
        conn.execute(
            "INSERT INTO living_docs(name, path, state, keywords) VALUES (?,?,?,?) "
            "ON CONFLICT(name) DO UPDATE SET path=excluded.path, state=excluded.state, "
            "keywords=excluded.keywords",
            (name, path, state, "|".join(kws)),
        )
