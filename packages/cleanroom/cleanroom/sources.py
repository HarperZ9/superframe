# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Readers for the two intake formats: CMMNS saves (daylight.sidecar/1 .md sidecars) and Gather
corpora (catalog.jsonl plus content-addressed bodies). Both are parsed as text data only.
"""
import datetime as dt
import hashlib
import json
import os
import re

from . import safety

FRONT = re.compile(r"\A---\r?\n(.*?)\r?\n---\r?\n", re.S)
OPEN_LICENCES = ("cc-by", "cc-by-sa", "cc0", "public-domain")


def parse_sidecar(path):
    """Front matter as a dict, plus the quoted post text. None when not a daylight.sidecar/1 file."""
    if safety.refuse_reason(path):
        return None
    with open(path, "rb") as f:
        raw = f.read(1 << 20)
    text = raw.decode("utf-8", errors="replace")
    m = FRONT.match(text)
    if not m:
        return None
    meta = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        k, v = line.split(":", 1)
        v = v.strip()
        try:
            meta[k.strip()] = json.loads(v)
        except ValueError:
            meta[k.strip()] = v
    if meta.get("format") != "daylight.sidecar/1":
        return None
    quoted = []
    for line in text[m.end():].splitlines():
        if line.startswith(">"):
            quoted.append(line[2:] if line.startswith("> ") else line[1:])
    meta["_text"] = "\n".join(quoted).strip()
    meta["_sha256"] = hashlib.sha256(raw).hexdigest()
    return meta


def daylight_saves(root):
    """Every sidecar under root, newest save first (by the sidecar's saved field, then mtime)."""
    out = []
    for d, dirs, files in os.walk(root):
        dirs[:] = sorted(x for x in dirs if not x.startswith("."))
        for n in files:
            if n.endswith(".md"):
                p = os.path.join(d, n)
                meta = parse_sidecar(p)
                if meta:
                    out.append((str(meta.get("saved") or ""), os.path.getmtime(p), p, meta))
    out.sort(key=lambda t: (t[0], t[1]), reverse=True)
    return [(p, m) for _, _, p, m in out]


def sidecar_items(path, meta):
    """(kind, payload, vault meta) for each media file named by the sidecar and for the post text."""
    base = os.path.dirname(path)
    common = {"source_kind": "daylight", "original_url": meta.get("media"),
              "post": meta.get("post") or meta.get("page"), "site": meta.get("site"),
              "author": meta.get("author"), "handle": meta.get("handle"), "posted": meta.get("posted"),
              "save_date": meta.get("saved"), "sidecar_sha256": meta.get("_sha256")}
    if meta.get("licence") in OPEN_LICENCES:
        common["licence"], common["licence_basis"] = meta["licence"], "sidecar licence field"
    items = []
    for name in meta.get("files") or []:
        fp = os.path.normpath(os.path.join(base, os.path.basename(str(name))))
        items.append(("file", fp, dict(common, source_path=fp, role="media")))
    if meta.get("_text"):
        items.append(("bytes", meta["_text"].encode("utf-8"),
                      dict(common, source_path=path, role="post-text", original_url=common["post"])))
    return items


def gather_items(corpus):
    """(kind, payload, vault meta) for each Gather catalog row whose body is present."""
    items = []
    with open(os.path.join(corpus, "catalog.jsonl"), encoding="utf-8") as f:
        for line in f:
            try:
                row = json.loads(line)
            except ValueError:
                continue
            sha = (row.get("storage") or {}).get("object_sha256") or row.get("sha256") or ""
            if not re.fullmatch(r"[0-9a-f]{64}", sha):
                continue
            body = os.path.join(corpus, "objects", sha[:2], sha[2:])
            if not os.path.isfile(body):
                continue
            ref = str(row.get("ref") or "")
            web = ref if ref.startswith("http") else None
            meta = row.get("meta") or {}
            items.append(("file", body, {
                "source_kind": "gather", "source_path": body, "original_url": web,
                "post": meta.get("page") or meta.get("url") or web, "save_date": _epoch(row.get("fetched_at")),
                "role": row.get("kind"), "media_type_hint": "text/markdown" if ref.endswith(".md") else None}))
    return items


def _epoch(t):
    try:
        return dt.datetime.fromtimestamp(float(t), dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    except (TypeError, ValueError):
        return None
