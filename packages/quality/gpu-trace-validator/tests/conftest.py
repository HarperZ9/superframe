# SPDX-License-Identifier: MIT
# The engine runs these tests from the repository root (python -m pytest packages), where the
# pyproject.toml in this folder is not read. Two things that file and its folder used to give the
# tests are given here: src/ on the import path, and the package folder as the working directory,
# because the tests name their fixtures as tests/fixtures/<file>.
import sys
from pathlib import Path

import pytest

_PACKAGE = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_PACKAGE / "src"))


@pytest.fixture(autouse=True)
def _run_from_package_folder(monkeypatch):
    monkeypatch.chdir(_PACKAGE)
