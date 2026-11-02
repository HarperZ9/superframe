# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Human release notes for copy-derived outputs.

A note binds who approved, why, the output's sha256 and the difference report's sha256. Its own
sha256 is stored inside it; when CLEANROOM_RELEASE_KEY is set, an HMAC-SHA256 over the same body is
added. A note records a claim of human approval. It does not prove a human wrote it: anyone with
write access to the vault can create one, and the HMAC only shows the key holder signed it.
"""
import hashlib
import hmac
import json
import os

from .config import Layout
from .vault import now


def _body(n):
    return json.dumps({k: n[k] for k in ("output_sha256", "report_sha256", "by", "why", "at", "route")},
                      sort_keys=True).encode()


def note_path(root, output_sha):
    return os.path.join(Layout(root).ensure().releases, output_sha + ".json")


def record(root, output_sha, report_sha, by, why, route="public"):
    if not by or not by.strip() or not why or not why.strip():
        raise ValueError("a release note needs who approved (--by) and why (--why)")
    n = {"schema": "cleanroom.release/1", "output_sha256": output_sha, "report_sha256": report_sha,
         "by": by.strip(), "why": why.strip(), "at": now(), "route": route}
    n["note_sha256"] = hashlib.sha256(_body(n)).hexdigest()
    key = os.environ.get("CLEANROOM_RELEASE_KEY")
    if key:
        n["hmac_sha256"] = hmac.new(key.encode(), _body(n), hashlib.sha256).hexdigest()
    with open(note_path(root, output_sha), "w", encoding="utf-8") as f:
        json.dump(n, f, indent=1, sort_keys=True)
    return n


def verify(root, output_sha, report_sha):
    """(ok, reason). The note must exist, hash to itself, and name this output and this report."""
    p = note_path(root, output_sha)
    if not os.path.exists(p):
        return False, "no release note recorded for this output"
    with open(p, encoding="utf-8") as f:
        n = json.load(f)
    if hashlib.sha256(_body(n)).hexdigest() != n.get("note_sha256"):
        return False, "release note body does not match its hash"
    if n["output_sha256"] != output_sha:
        return False, "release note names a different output"
    rp = os.path.join(Layout(root).reports, n["report_sha256"] + ".json")
    if not os.path.exists(rp):
        return False, "the report this note was made against is not stored"
    with open(rp, encoding="utf-8") as f:
        rep = json.load(f)
    if rep.get("output_sha256") != output_sha:
        return False, "the note's report describes a different output"
    if report_sha and not rep.get("passes_all"):
        return False, "the note was made against a report that did not pass"
    key = os.environ.get("CLEANROOM_RELEASE_KEY")
    if key and not hmac.compare_digest(n.get("hmac_sha256", ""),
                                       hmac.new(key.encode(), _body(n), hashlib.sha256).hexdigest()):
        return False, "release note HMAC does not verify"
    return True, f"approved by {n['by']} at {n['at']}"
