# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Lineage: what every build-side output read and did.

The build side may open vault copies directly (copy-derived work: derivative works and
transformations) or open only SPEC records (spec-derived work: new pieces built from measurements).
Both are first class. The Workspace records every read and every transform, and writes
`<output>.lineage.json` beside the output. An output that read any vault copy is labelled
copy-derived; one that read only specs, or our own generated material, is labelled spec-derived.
Default routing: copy-derived goes to internal use, spec-derived goes to public use.
"""
import json
import os

from .config import Layout
from .decompose import load_spec
from .vault import Vault, now, sha256_file

COPY, SPEC = "copy-derived", "spec-derived"
DEFAULT_ROUTE = {COPY: "internal", SPEC: "public"}


def lineage_path(output):
    return output + ".lineage.json"


class Workspace:
    """Build-side handle. Every open is recorded; nothing is refused."""

    def __init__(self, root=None):
        self.root = root
        self.vault = Vault(root)
        self.copies, self.specs, self.generated, self.transforms = [], [], [], []

    def open_copy(self, sha):
        """Path of a vault copy, opened for reading. Marks the output copy-derived."""
        rec = self.vault.record(sha)
        if rec is None:
            raise KeyError(f"no vault copy {sha}")
        if sha not in [c["sha256"] for c in self.copies]:
            self.copies.append({"sha256": sha, "licence": rec.get("licence", "unknown"),
                                "media_type": rec["media_type"]})
        return self.vault.copy_file(sha)

    def open_spec(self, spec_id):
        spec = load_spec(self.root, spec_id)
        if spec_id not in [s["spec_id"] for s in self.specs]:
            self.specs.append({"spec_id": spec_id, "vault_sha256": spec["vault_sha256"],
                               "content_sha256": spec.get("content_sha256")})
        return spec

    def note_generated(self, name, params_sha256):
        self.generated.append({"name": name, "params_sha256": params_sha256})

    def transform(self, name, **params):
        self.transforms.append({"name": name, "params": params})

    @property
    def label(self):
        return COPY if self.copies else SPEC

    def write(self, output, extra=None):
        rec = {"schema": "cleanroom.lineage/1", "output": os.path.basename(output),
               "output_sha256": sha256_file(output), "label": self.label,
               "default_route": DEFAULT_ROUTE[self.label], "created_at": now(),
               "reads": {"vault_copies": self.copies, "specs": self.specs, "generated": self.generated},
               "transforms": self.transforms}
        rec.update(extra or {})
        with open(lineage_path(output), "w", encoding="utf-8") as f:
            json.dump(rec, f, indent=1, sort_keys=True)
        return rec


def load(output):
    p = lineage_path(output)
    if not os.path.exists(p):
        return None
    with open(p, encoding="utf-8") as f:
        return json.load(f)


def report(output, root=None):
    """Reporting view used by `cleanroom lineage`: label, every source, and whether the record
    still matches the file on disk."""
    lin = load(output)
    if lin is None:
        return {"output": output, "lineage": None, "label": "unknown",
                "note": "no lineage record; the gate treats this file as outside the cleanroom"}
    sha = sha256_file(output)
    L = Layout(root)
    lin["matches_file"] = sha == lin["output_sha256"]
    lin["vault_sources_present"] = [os.path.exists(L.record_path(c["sha256"])) for c in lin["reads"]["vault_copies"]]
    spec_shas = {s["vault_sha256"] for s in lin["reads"]["specs"]}
    lin["upstream_vault_sha256_via_specs"] = sorted(spec_shas)
    return lin
