# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Remastering suite: decode any audio, read its condition, split it into stems and layers, refine, restore,
resynthesize, remix and master, with a receipt for every stage and a provenance map for every sample.
See ../README.md. The DSP core reuses the superframe DAW (packages/daw) for its instruments and limiter."""
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent
PACKAGES = PKG.parent
DAW = PACKAGES / "daw"
if str(DAW) not in sys.path:
    sys.path.insert(0, str(DAW))

VERSION = "0.1.0"
