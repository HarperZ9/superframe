# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Three historical colour-mixing systems as BuildLang kernels with a Python reference: the Mayer triangle
(1775), the Lambert pyramid (1772) and the Benson cube (1872). See README.md and docs/."""
from pathlib import Path

PKG = Path(__file__).resolve().parent.parent
VERSION = "0.1.0"
I64_MIN = -(1 << 63)
I64_MAX = (1 << 63) - 1
MAX_PARTS = 4096
