# SPDX-License-Identifier: FSL-1.1-MIT
# The engine runs these tests from the repository root (python -m pytest packages) with no
# install step for this package. Put the package folder first on the import path so that
# `import build_color` and `import tools...` find this copy, and no other copy on the machine.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
