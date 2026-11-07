# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Particle-mesh gravity in a periodic box, comoving coordinates, kick-drift-kick in the scale factor.

Equations (time in 1/H0, length in Mpc/h; p = a^2 dx/dt):
    dx/da = p / (a^3 E(a))
    dp/da = -grad Phi / (a^2 E(a)),   lap Phi = 1.5 Omega_m delta
Cloud-in-cell assignment and the same cloud-in-cell kernel for reading forces back, with an antisymmetric
gradient, so a particle exerts no net force on itself and total momentum is conserved to rounding
(Hockney and Eastwood 1988, ch. 5).
"""
import itertools

import numpy as np

from . import shortrange
from .backend import get_backend

CORNERS = list(itertools.product((0, 1), repeat=3))


class PMSolver:
    def __init__(self, cosmo, box, ng, n_particles, ops=None, gradient="fd4", deconvolve=False,
                 readback="cic", split=None):
        self.cosmo, self.box, self.ng, self.np_ = cosmo, float(box), int(ng), int(n_particles)
        self.split = split                     # r_s (Mpc/h): the mesh keeps only the long-range part
        self.ops = ops or get_backend("numpy")
        self.cell = self.box / self.ng
        self.gradient, self.deconvolve, self.readback = gradient, deconvolve, readback
        kx, ky, kz = self.ops.kgrid(self.ng, self.box)
        self._k = (kx, ky, kz)
        self._k2 = kx * kx + ky * ky + kz * kz

    # ---- assignment ------------------------------------------------------------------------------
    def _cell_coords(self, pos):
        g = self.ops.mod(pos / self.cell, self.ng)
        i0 = self.ops.floor_int(g)
        return i0, g - i0

    def _corner(self, i0, d, c):
        ng = self.ng
        ix = (i0[:, 0] + c[0]) % ng
        iy = (i0[:, 1] + c[1]) % ng
        iz = (i0[:, 2] + c[2]) % ng
        w = ((d[:, 0] if c[0] else 1 - d[:, 0]) * (d[:, 1] if c[1] else 1 - d[:, 1])
             * (d[:, 2] if c[2] else 1 - d[:, 2]))
        return (ix * ng + iy) * ng + iz, w

    def deposit(self, pos, mass=None):
        """Density contrast delta on the mesh by cloud in cell; mean particle mass 1 unless mass is given."""
        i0, d = self._cell_coords(pos)

        def corners():
            for c in CORNERS:
                idx, w = self._corner(i0, d, c)
                yield idx, (w if mass is None else w * mass)
        rho = self.ops.scatter_add_many(self.ng ** 3, corners()).reshape(self.ng, self.ng, self.ng)
        return rho * (self.ng ** 3 / self.np_) - 1.0

    def interpolate(self, mesh, pos):
        """Read a mesh field at particle positions with the cloud-in-cell kernel (or nearest grid point,
        kept only as a planted wrong readback for the momentum test)."""
        flat = mesh.reshape(-1)
        if self.readback == "ngp":
            g = self.ops.mod(pos / self.cell + 0.5, self.ng)
            i = self.ops.floor_int(g) % self.ng
            return flat[(i[:, 0] * self.ng + i[:, 1]) * self.ng + i[:, 2]]
        i0, d = self._cell_coords(pos)
        out = None
        for c in CORNERS:
            idx, w = self._corner(i0, d, c)
            v = flat[idx] * w
            out = v if out is None else out + v
        return out

    # ---- Poisson and forces ----------------------------------------------------------------------
    def _grad_k(self, axis):
        k = self._k[axis]
        h = self.cell
        if self.gradient == "fd4":
            # four-point finite difference, its Fourier symbol; odd in k, so the Nyquist term is zero
            return (8 * _sin(self.ops, k * h) - _sin(self.ops, 2 * k * h)) / (6 * h)
        kn = np.pi / h
        return k * (abs(k) < kn * (1 - 1e-9))          # spectral, Nyquist removed to keep it odd

    def potential_k(self, delta):
        dk = self.ops.rfftn(delta)
        k2 = self._k2
        inv = 1.0 / (k2 + (k2 == 0))
        phi = -1.5 * self.cosmo.omega_m * dk * inv * (k2 != 0)
        if self.deconvolve:
            w = 1.0
            for k in self._k:
                w = w * _sinc(self.ops, 0.5 * k * self.cell) ** 2
            phi = phi / w ** int(self.deconvolve)          # True or 2: both windows; 1: one
        if self.split:
            phi = phi * _exp(self.ops, -k2 * self.split ** 2)
        return phi

    def potential_at(self, pos, mass=None):
        """Phi at the particles, cloud in cell from the mesh (long-range part only when split is set)."""
        phi = self.ops.irfftn(self.potential_k(self.deposit(pos, mass)), (self.ng,) * 3)
        return self.interpolate(phi, pos)

    @property
    def gm(self):
        """G times one particle's mass in these units: lap Phi = 1.5 Omega_m delta, delta per particle V / N."""
        return 1.5 * self.cosmo.omega_m * self.box ** 3 / (4 * np.pi * self.np_)

    def force_meshes(self, delta):
        """g = -grad Phi on the mesh, one component at a time."""
        phi = self.potential_k(delta)
        shape = (self.ng,) * 3
        for axis in range(3):
            yield self.ops.irfftn(-1j * self._grad_k(axis) * phi, shape)

    def accel(self, pos, mass=None):
        delta = self.deposit(pos, mass)
        comps = [self.interpolate(g, pos) for g in self.force_meshes(delta)]
        return self.ops.stack(comps, axis=1)

    # ---- time stepping ---------------------------------------------------------------------------
    def run(self, pos, mom, a_steps, callback=None):
        """Kick-drift-kick across the scale-factor grid a_steps. pos, mom: (N, 3) backend arrays."""
        acc = self.accel(pos)
        for a0, a1 in zip(a_steps[:-1], a_steps[1:]):
            am = 0.5 * (a0 + a1)
            mom = mom + acc * self.cosmo.kick_factor(a0, am)
            pos = self.ops.mod(pos + mom * self.cosmo.drift_factor(a0, a1), self.box)
            acc = self.accel(pos)
            mom = mom + acc * self.cosmo.kick_factor(am, a1)
            if callback is not None:
                callback(a1, pos, mom)
        return pos, mom


def _sin(ops, x):
    return ops.torch.sin(x) if hasattr(ops, "torch") else np.sin(x)


def _exp(ops, x):
    return ops.torch.exp(x) if hasattr(ops, "torch") else np.exp(x)


def _sinc(ops, x):
    """sin(x)/x with sinc(0) = 1."""
    if hasattr(ops, "torch"):
        return ops.torch.sinc(x / np.pi)
    return np.sinc(x / np.pi)


class P3MSolver(PMSolver):
    """Particle-particle particle-mesh: the mesh carries the Gaussian-smoothed long-range force and a direct
    pair sum adds the rest inside r_cut (shortrange.py). r_s = rs_cells mesh cells; r_cut = rcut_rs r_s;
    eps is the Plummer softening in Mpc/h. Defaults follow Gadget-2's split (r_s = 1.25 cells,
    r_cut = 4.5 r_s). The mesh divides out both cloud-in-cell windows; the Gaussian keeps that finite."""

    def __init__(self, cosmo, box, ng, n_particles, ops=None, rs_cells=1.25, rcut_rs=4.5, eps=0.0,
                 gradient="fd4", short_rs=None, **kw):
        kw.setdefault("deconvolve", 2)
        super().__init__(cosmo, box, ng, n_particles, ops, gradient=gradient, split=rs_cells * box / ng, **kw)
        self.rs = self.split
        self.short_rs = short_rs or self.rs        # planted: a different scale on the pair side breaks the split
        self.rcut = rcut_rs * self.rs
        self.eps = float(eps)
        self._cuda = None
        if hasattr(self.ops, "torch") and self.ops.device.type == "cuda":
            self._cuda = shortrange.ShortRangeCuda(self.box, self.rcut)

    def short_accel(self, pos):
        if self._cuda is not None:
            return self._cuda(pos, self.gm, self.short_rs, self.eps)
        acc = shortrange.short_range_cpu(self.ops.to_numpy(pos), self.box, self.gm, self.short_rs, self.rcut, self.eps)
        return self.ops.asarray(acc)

    def accel(self, pos, mass=None):
        if mass is not None:
            raise ValueError("P3M runs use equal masses")
        return super().accel(pos) + self.short_accel(pos)

    def potential_at(self, pos, mass=None):
        """Long-range mesh potential plus the short-range pair potential (CPU pair sum)."""
        long = self.ops.to_numpy(super().potential_at(pos))
        _, pot = shortrange.short_range_cpu(self.ops.to_numpy(pos), self.box, self.gm, self.short_rs, self.rcut,
                                            self.eps, with_potential=True)
        return long + pot
