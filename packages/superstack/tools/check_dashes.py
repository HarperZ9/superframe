# SPDX-License-Identifier: MIT
"""Fail when any Markdown file in the repository contains an em or en dash.
Usage: python tools/check_dashes.py"""
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DASHES = ("—", "–")
bad = [f"{p.relative_to(ROOT)}:{i}" for p in sorted(ROOT.rglob("*.md")) if "node_modules" not in p.parts
       for i, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1) if any(d in line for d in DASHES)]
print("\n".join(bad) if bad else "no em or en dashes in Markdown")
sys.exit(1 if bad else 0)
