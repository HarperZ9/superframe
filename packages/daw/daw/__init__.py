# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A workstation whose instruments are physical models: objects of measured materials and real shapes,
struck, plucked or blown, ringing in a simulated room, arranged and mixed on a timeline, rendered
offline from a seed with a receipt. See DESIGN.md."""
import sys
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent
PACKAGES = PKG.parent
for _p in (PACKAGES / "measured", PACKAGES / "instruments" / "room"):
    if str(_p) not in sys.path:
        sys.path.insert(0, str(_p))

VERSION = "0.1.0"
