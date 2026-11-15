# SPDX-License-Identifier: AGPL-3.0-only
# The engine runs these tests from the repository root with pytest and no install step.
# Put the package folder first on the import path so `import openarchives` finds this copy.
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
