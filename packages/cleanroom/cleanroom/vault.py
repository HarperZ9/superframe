# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The copy side: content-addressed copies of saved artifacts, one record per copy.

A record holds the sha256, the original URL and post, the save date, the media type, a licence tag
(unknown unless someone sets it), and the tier, which is always "copy". Copies are written read-only
and never leave the vault: no command here uploads, shares or publishes one.
"""
import datetime as _dt
import hashlib
import json
import os
import shutil
import stat
import tempfile

from . import safety
from .config import Layout

LICENCES = ("cc-by", "cc-by-sa", "cc0", "public-domain", "own", "permitted", "reference-only", "unknown")
PROBE_LEN = 64


def now():
    return _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sha256_file(path, chunk=1 << 20):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for b in iter(lambda: f.read(chunk), b""):
            h.update(b)
    return h.hexdigest()


def _probes(path, size):
    """Byte windows the publish gate uses to find this copy embedded inside another file."""
    if size <= PROBE_LEN * 4:
        with open(path, "rb") as f:
            return [f.read().hex()] if size >= 16 else []
    offs = sorted({size // 7, size // 3, size // 2, (2 * size) // 3, size - size // 7 - PROBE_LEN})
    out = []
    with open(path, "rb") as f:
        for o in offs:
            f.seek(o)
            out.append(f.read(PROBE_LEN).hex())
    return out


class Vault:
    def __init__(self, root=None):
        self.L = Layout(root).ensure()

    # -- records ---------------------------------------------------------------
    def record(self, sha):
        p = self.L.record_path(sha)
        if not os.path.exists(p):
            return None
        with open(p, encoding="utf-8") as f:
            return json.load(f)

    def _write_record(self, rec):
        p = self.L.record_path(rec["sha256"])
        os.makedirs(os.path.dirname(p), exist_ok=True)
        tmp = p + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(rec, f, indent=1, ensure_ascii=False, sort_keys=True)
        os.replace(tmp, p)

    def records(self):
        for d, _, files in os.walk(self.L.records):
            for n in sorted(files):
                if n.endswith(".json"):
                    with open(os.path.join(d, n), encoding="utf-8") as f:
                        yield json.load(f)

    def copy_file(self, sha):
        rec = self.record(sha)
        if rec is None:
            raise KeyError(f"no vault copy {sha}")
        return os.path.join(self.L.root, rec["path"])

    def set_licence(self, sha, tag, basis):
        if tag not in LICENCES:
            raise ValueError(f"licence tag must be one of {LICENCES}")
        rec = self.record(sha)
        if rec is None:
            raise KeyError(sha)
        rec["licence"], rec["licence_basis"], rec["licence_set_at"] = tag, basis, now()
        self._write_record(rec)
        return rec

    # -- ingest ----------------------------------------------------------------
    def ingest_file(self, src, meta=None):
        """Copy one file into the vault. Returns (record, status) or (None, reason)."""
        why = safety.refuse_reason(src)
        if why:
            return None, f"skipped: {why}"
        with open(src, "rb") as f:
            head = f.read(4096)
        return self._ingest(src, head, meta or {})

    def ingest_bytes(self, data, meta):
        """Store bytes held in memory (a post's text)."""
        fd, tmp = tempfile.mkstemp(prefix="cr-", dir=self.L.root)
        with os.fdopen(fd, "wb") as f:
            f.write(data)
        try:
            return self._ingest(tmp, data[:4096], meta)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    def _ingest(self, src, head, meta):
        mt, ext = safety.sniff(head)
        if meta.get("media_type_hint") == "text/markdown" and mt == "text/plain":
            mt, ext = "text/markdown", ".md"
        sha = sha256_file(src)
        dst = self.L.copy_path(sha, ext)
        size = os.path.getsize(src)
        keys = ("source_kind", "source_path", "original_url", "post", "site", "author", "handle", "posted",
                "save_date", "role", "sidecar_sha256")
        source = {k: meta.get(k) for k in keys if meta.get(k) is not None}
        rec = self.record(sha)
        if rec is not None:
            if source not in rec["sources"]:
                rec["sources"].append(source)
                self._write_record(rec)
                return rec, "merged"
            return rec, "duplicate"
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        tmp = dst + ".part"
        shutil.copyfile(src, tmp)
        if sha256_file(tmp) != sha:
            os.remove(tmp)
            raise IOError(f"hash changed while copying {src}")
        os.replace(tmp, dst)
        os.chmod(dst, stat.S_IREAD)
        rec = {
            "schema": "cleanroom.vault/1", "sha256": sha, "size": size, "media_type": mt,
            "path": os.path.relpath(dst, self.L.root).replace("\\", "/"),
            "original_url": meta.get("original_url"), "post": meta.get("post"),
            "save_date": meta.get("save_date"), "posted": meta.get("posted"),
            "licence": meta.get("licence", "unknown"), "licence_basis": meta.get("licence_basis"),
            "tier": "copy", "ingested_at": now(), "sources": [source], "probes": _probes(dst, size),
        }
        self._write_record(rec)
        with open(self.L.index, "a", encoding="utf-8") as f:
            f.write(json.dumps({"sha256": sha, "media_type": mt, "size": size, "at": rec["ingested_at"]}) + "\n")
        return rec, "new"
