# SPDX-License-Identifier: FSL-1.1-MIT
# SPDX-FileCopyrightText: 2026 Zain Dana Harper
"""The canonical lattice bases, defined once for lattice and packing.

Each basis is a d x d matrix whose columns are the lattice vectors. The 2-D bases have unit
nearest-neighbour distance. The cubic bases describe a cubic cell of edge 1: SC has nearest
neighbour 1, FCC 1/sqrt(2), BCC sqrt(3)/2. lattice.lattices rescales them to a chosen density;
packing.algebra uses them as they are.

Before 2026-10-31 the two packages held separate copies (workstation-tools@d82f57f:
lattice/lattice/lattices.py GENERATORS and packing/lattice.py SQUARE..BCC). The BCC copies used
different primitive bases of the same lattice; this module keeps the symmetric one.
"""
import math

import numpy as np

SQ3 = math.sqrt(3.0)

SQUARE = np.eye(2)
HEX = np.array([[1.0, 0.5], [0.0, SQ3 / 2]])
SC = np.eye(3)
FCC = np.array([[0, 1, 1], [1, 0, 1], [1, 1, 0]], float) / 2
BCC = np.array([[-1, 1, 1], [1, -1, 1], [1, 1, -1]], float) / 2

BASES = {"square": SQUARE, "hex": HEX, "cubic": SC, "sc": SC, "fcc": FCC, "bcc": BCC}


def basis(name):
    """A fresh copy of the named basis, so callers cannot change the shared constants."""
    try:
        return BASES[name.lower()].copy()
    except KeyError:
        raise KeyError(f"unknown lattice {name!r}; known: {sorted(BASES)}") from None
