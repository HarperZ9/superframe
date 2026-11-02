# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Publish gate. Other tools (superframe export, site deploy, study publishing) call `check(path)`.

Order of checks:
1. Exact copy: the file's sha256 equals a vault copy. Refused on every route to public.
2. Embedded copy: probe windows from a vault copy appear inside the file's bytes, or inside any
   member of a zip container. Refused.
3. Lineage: the file's lineage record, if present, must match the file's hash.
4. Difference report: always run for the public route and stored by its hash.
   - spec-derived: the report is a sanity check; only steps 1 and 2 can refuse it.
   - copy-derived: every threshold must pass, the report hash must be stored, and a human release
     note must name this output.
   - no lineage: treated as spec-derived for steps 1 and 2 unless strict=True, which refuses it.
The internal route never refuses; it records what the public route would decide.
"""
import os
import zipfile

from . import difference, release
from .vault import Vault, sha256_file
from .lineage import COPY, load as load_lineage

MAX_SCAN = 1 << 31


def _probe_index(vault):
    idx = []
    for rec in vault.records():
        ps = [bytes.fromhex(p) for p in rec.get("probes", [])]
        if ps:
            idx.append((rec["sha256"], ps))
    return idx


def _embedded_in(data, idx):
    hits = []
    for sha, ps in idx:
        found = sum(1 for p in ps if p and data.find(p) >= 0)
        if found and (found >= 2 or len(ps) == 1):
            hits.append(sha)
    return hits


def embedded(path, vault):
    idx = _probe_index(vault)
    if os.path.getsize(path) > MAX_SCAN:
        return [], "file larger than the 2 GiB scan cap; embedded check not run"
    with open(path, "rb") as f:
        data = f.read()
    hits = _embedded_in(data, idx)
    if data[:4] == b"PK\x03\x04":
        try:
            with zipfile.ZipFile(path) as z:
                for info in z.infolist():
                    if info.file_size <= MAX_SCAN:
                        hits += [h for h in _embedded_in(z.read(info), idx) if h not in hits]
        except zipfile.BadZipFile as e:
            return hits, f"zip members not scanned: {e}"
    return hits, None


def check(path, root=None, route="public", strict=False, T=None):
    vault = Vault(root)
    sha = sha256_file(path)
    d = {"file": path, "sha256": sha, "route": route, "reasons": [], "notes": []}
    exact = vault.record(sha) is not None
    hits, warn = embedded(path, vault)
    if warn:
        d["notes"].append(warn)
    d["exact_vault_copy"], d["embedded_vault_copies"] = exact, hits
    if exact:
        d["reasons"].append("file is a byte-identical vault copy")
    if hits:
        d["reasons"].append(f"file embeds {len(hits)} vault copy(ies): " + ", ".join(h[:12] for h in hits))
    lin = load_lineage(path)
    label = lin["label"] if lin else "unknown"
    d["label"] = label
    if lin and lin["output_sha256"] != sha:
        d["reasons"].append("lineage record does not match this file (output changed after it was recorded)")
    if lin is None:
        (d["reasons"] if strict else d["notes"]).append("no lineage record")
    rep = difference.run(path, root, T) if (route == "public" or label == COPY) else None
    if rep:
        d["report_sha256"], d["report_stored_at"] = rep["report_sha256"], rep.get("stored_at")
        d["report_passes_all"], d["report_failed"] = rep["passes_all"], rep["failed"]
        d["report_checks_run"] = rep["checks_run"]
        d["honesty"] = rep["honesty"]
    if label == COPY:
        if not rep["passes_all"]:
            d["reasons"].append(f"{len(rep['failed'])} difference check(s) failed")
        ok, why = release.verify(root, sha, rep["report_sha256"])
        d["release_note"] = why
        if not ok:
            d["reasons"].append(why)
    elif rep and not rep["passes_all"]:
        d["notes"].append(f"sanity: {len(rep['failed'])} difference check(s) failed on a {label} output")
    d["allowed"] = True if route == "internal" else not d["reasons"]
    if route == "internal" and d["reasons"]:
        d["notes"].append("internal route: recorded, not refused; the public route would refuse")
    return d
