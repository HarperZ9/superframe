# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The tube in physical units: raster timing, face geometry, the aperture grille, the guns.

Lengths in millimetres, times in seconds, currents in amperes, voltages in volts, energies in
joules. Timing is NTSC 240p as game consoles drove it: 262 lines a field, no interlace.
"""
import math
from dataclasses import dataclass, field

import numpy as np

from . import phosphors
from .glass import Faceplate


@dataclass
class Tube:
    diagonal_in: float = 14.0
    aspect: float = 4.0 / 3.0
    overscan: float = 0.05            # raster larger than the visible face, each axis
    pitch_mm: float = 0.60            # aperture grille triad pitch on the face
    mask_transmission: float = 0.22   # fraction of each beam that passes the grille (low grade)
    anode_v: float = 25e3
    i_max_a: float = 0.35e-3          # peak current of the strongest gun at full drive (low grade)
    gamma: float = 2.4                # cathode current ~ drive^gamma (BT.1886 describes this law)
    spot_lo: float = 0.20             # gaussian sigma in line spacings at zero current
    spot_hi: float = 0.42             # ... and at full current (raw-native slot-tv preset)
    spot_exp: float = 0.5
    line_hz: float = 4.5e6 / 286.0    # NTSC horizontal rate, exact by definition
    lines_per_field: int = 262
    active_lines: int = 240
    first_active_line: int = 21
    active_s: float = 52.8556e-6      # active line time: 63.5556 - 1.5 (front porch) - 9.2 us (ITU-R BT.1700 Table 2, M/NTSC)
    active_start_s: float = 9.2e-6    # sync leading edge (time datum) to end of line blanking, BT.1700 nominal (+0.2/-0.1 us)
    src_w: int = 320
    src_h: int = 240
    decay: str = "kuhn2002"
    red_host: str = "Y2O2S:Eu"
    glass: Faceplate = field(default_factory=Faceplate)

    def __post_init__(self):
        d = self.diagonal_in * 25.4
        self.face_w = d * self.aspect / math.hypot(self.aspect, 1)
        self.face_h = d / math.hypot(self.aspect, 1)
        self.raster_w = self.face_w * (1 + self.overscan)
        self.raster_h = self.face_h * (1 + self.overscan)
        self.line_mm = self.raster_h / self.active_lines
        self.dx = self.pitch_mm / 3.0                       # one cell per phosphor stripe
        self.triads = int(round(self.face_w / self.pitch_mm))
        self.cols = 3 * self.triads
        self.rows = int(round(self.face_h / self.dx))
        self.H = 1.0 / self.line_hz
        self.T = self.lines_per_field * self.H              # field period
        self.v = self.raster_w / self.active_s              # beam speed on the face, mm/s
        self.ph = phosphors.p22(self.decay, self.red_host)
        self.gains = white_gains(self)

    # Face coordinates, centred, of cell centres.
    def x_cells(self):
        return (np.arange(self.cols) + 0.5) * self.dx - self.cols * self.dx / 2

    def y_rows(self):
        return (np.arange(self.rows) + 0.5) * self.dx - self.rows * self.dx / 2

    def beam_x(self):
        """Beam sample positions: the face cells extended across the overscanned raster."""
        m = int(math.ceil((self.raster_w - self.cols * self.dx) / 2 / self.dx))
        x = (np.arange(-m, self.cols + m) + 0.5) * self.dx - self.cols * self.dx / 2
        return x[np.abs(x) <= self.raster_w / 2], m

    def line_y(self):
        return -self.raster_h / 2 + (np.arange(self.active_lines) + 0.5) * self.line_mm

    def line_start(self, j, field_no=0):
        """Time of the sync edge of active line j in field field_no, from field 0's start."""
        return field_no * self.T + (self.first_active_line + j) * self.H

    def beam_time(self, field_no=0):
        """(lines, samples) time at which the beam centre crosses each sample position."""
        x, _ = self.beam_x()
        j = np.arange(self.active_lines)[:, None]
        return self.line_start(j, field_no) + self.active_start_s + (x[None, :] + self.raster_w / 2) / self.v

    def current(self, drive, gun):
        """Cathode current in A for a signal value in [0, 1]."""
        return self.i_max_a * self.gains[gun] * np.clip(drive, 0.0, 1.0) ** self.gamma

    def sigma(self, current):
        u = np.clip(current / self.i_max_a, 0.0, 1.5) ** self.spot_exp
        return self.line_mm * (self.spot_lo + (self.spot_hi - self.spot_lo) * u)

    def beam_energy(self, current):
        """Joules the beam carries while its centre crosses one sample (dx)."""
        return self.anode_v * current * self.dx / self.v

    def drive(self, src):
        """(lines, samples, 3) drive: each sample takes the source pixel under it (a video DAC
        holding each pixel; the spot is the only band limit)."""
        x, _ = self.beam_x()
        col = np.clip(((x + self.raster_w / 2) / self.raster_w * self.src_w).astype(int), 0, self.src_w - 1)
        return src[:, col, :]


def white_gains(tube):
    """Gun gains (strongest = 1) so that equal full drive gives D65, as a service setup does."""
    from .colour import phosphor_xyz, D65_XY
    M = np.stack([phosphor_xyz(tube, c) for c in range(3)], axis=1)
    x, y = D65_XY
    g = np.linalg.solve(M, np.array([x / y, 1.0, (1 - x - y) / y]))
    return g / g.max()
