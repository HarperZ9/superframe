# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Paths, sibling library locations and the preregistered thresholds.

The vault root comes from --vault or the CLEANROOM_VAULT environment variable. There is no default:
the vault holds copies of other people's work, so it must never be created in an arbitrary place.
Thresholds live in thresholds.json next to this package, so they are read, never typed inline.
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
PKG_ROOT = os.path.dirname(HERE)
PACKAGES = os.path.dirname(PKG_ROOT)
VAULT_ENV = "CLEANROOM_VAULT"
THRESHOLDS_FILE = os.path.join(PKG_ROOT, "thresholds.json")

# Sibling superframe packages reused in place, located from this file (never an input directory).
# Each entry is the folder that holds the importable package of the same import name.
LIBS = {
    "design-parts": os.path.join(PACKAGES, "decompose", "design_parts"),  # import design_parts
    "lattice": os.path.join(PACKAGES, "lattice"),  # import lattice
    "text-phase": os.path.join(PACKAGES, "decompose", "textphase"),  # import textphase
    "materials": os.path.join(PACKAGES, "materials"),  # import materials
    "packing": os.path.join(PACKAGES, "lattice", "packing"),  # import packing
}


def use_libs(*names):
    for n in names:
        p = LIBS[n]
        if p not in sys.path:
            sys.path.insert(0, p)


def vault_root(root=None):
    root = root or os.environ.get(VAULT_ENV)
    if not root:
        raise RuntimeError(f"no vault root: pass --vault DIR or set {VAULT_ENV}")
    return os.path.abspath(root)


class Layout:
    """Content-addressed layout under one vault root."""

    def __init__(self, root=None):
        self.root = vault_root(root)
        self.copies = os.path.join(self.root, "copies")
        self.records = os.path.join(self.root, "records")
        self.specs = os.path.join(self.root, "specs")
        self.reports = os.path.join(self.root, "reports")
        self.releases = os.path.join(self.root, "releases")
        self.index = os.path.join(self.root, "index.jsonl")

    def ensure(self):
        for d in (self.copies, self.records, self.specs, self.reports, self.releases):
            os.makedirs(d, exist_ok=True)
        return self

    def copy_path(self, sha, ext):
        return os.path.join(self.copies, sha[:2], sha[2:4], sha + ext)

    def record_path(self, sha):
        return os.path.join(self.records, sha[:2], sha + ".json")

    def spec_path(self, spec_id):
        return os.path.join(self.specs, spec_id + ".json")


def thresholds(path=None):
    with open(path or THRESHOLDS_FILE, encoding="utf-8") as f:
        return json.load(f)
