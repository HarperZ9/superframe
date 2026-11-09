# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Shared fixtures. Property tests run on the reference and on the compiled kernels; equality needs both."""
import os
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from colourmix import native, reference  # noqa: E402


def _native():
    why = native.unavailable()
    if why and os.environ.get("COLOURMIX_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    return native.kernels()


@pytest.fixture(scope="session")
def kernels():
    """The compiled BuildLang kernels. Skips with the reason when they cannot be built here."""
    return _native()


@pytest.fixture(scope="session", params=["reference", "buildlang"])
def impl(request):
    """Each implementation in turn, so a property is checked on both."""
    return reference if request.param == "reference" else _native()
