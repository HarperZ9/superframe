# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""A CRT as a physical simulation: beam, grille, phosphor, glass, in time and in spectrum."""
from .tube import Tube  # noqa: F401
from . import beam, colour, glass, phosphors, scene, screen  # noqa: F401

VERSION = "0.1.0"
