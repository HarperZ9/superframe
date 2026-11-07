# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Gravity on the twisted flat 3-manifolds E2 to E6: a deposit and Poisson solve that know only the generators.

A manifold M = R^3 / Gamma is covered by the torus T = R^3 / (translations in Gamma) (`topology.cover`). A
density on M lifts to a density on T that every element of the finite group G = Gamma / T leaves alone, so
each particle of M is deposited on T together with its images g(x) = R_g x + t_g. The periodic Poisson solve
on T then returns a potential that G also leaves alone, and its value at a particle is the potential on M.
The covering torus may be hexagonal (E4, E5): the mesh is laid along the torus's own lattice vectors and the
Laplacian's symbol comes from the reciprocal lattice, so one code serves all six.

`eigen_potential` is the independent route: the Green's function as a sum over M's eigenmodes, taken from
COMPACT's selection rules (`topology.analytic_modes`), each eigenfunction built as the orbit sum of plane
waves. A solve that dropped the images (the untwisted torus) or used another manifold's group disagrees.
Nothing here is a claim about the topology of our universe.
"""
import itertools

import numpy as np

from . import topology

CORNERS = list(itertools.product((0, 1), repeat=3))


def lattice(name, L):
    """Columns are the covering torus's lattice vectors (Cartesian)."""
    C = topology.cover(name, L)
    if name in topology.HEX:
        return np.array([[C[0], 0.5 * C[0], 0.0], [0.0, np.sqrt(3) / 2 * C[0], 0.0], [0.0, 0.0, C[2]]])
    return np.diag(C)


def _rot_z(deg):
    c, s = np.cos(np.radians(deg)), np.sin(np.radians(deg))
    return np.array([[c, -s, 0.0], [s, c, 0.0], [0.0, 0.0, 1.0]])


def generators(name, L):
    """The screw motions and glides that make M, as (R, t) with g(x) = R x + t (COMPACT section 3)."""
    L1, L2, L3 = map(float, L)
    if name == "E1":
        return []
    if name == "E6":
        return [(np.diag([1.0, -1.0, -1.0]), np.array([L1, L2, 0.0])),
                (np.diag([-1.0, 1.0, -1.0]), np.array([0.0, L2, L3])),
                (np.diag([-1.0, -1.0, 1.0]), np.array([L1, 0.0, L3]))]
    deg = {"E2": 180.0, "E3": 90.0, "E4": 120.0, "E5": 60.0}[name]
    return [(_rot_z(deg), np.array([0.0, 0.0, L3]))]


def group(name, L):
    """All elements of G = Gamma / T, closed under composition with translations reduced modulo T."""
    A = lattice(name, L)
    Ainv = np.linalg.inv(A)

    def key(R, t):
        u = np.round(np.mod(Ainv @ t, 1.0), 9) % 1.0
        return tuple(np.round(R, 9).ravel()) + tuple(u)

    def reduce(R, t):
        return R, A @ (np.mod(Ainv @ t + 1e-12, 1.0) - 1e-12)

    elems = {key(np.eye(3), np.zeros(3)): (np.eye(3), np.zeros(3))}
    gens = generators(name, L)
    frontier = list(elems.values())
    while frontier:
        new = []
        for R, t in frontier:
            for Rg, tg in gens:
                e = reduce(Rg @ R, Rg @ t + tg)
                k = key(*e)
                if k not in elems:
                    elems[k] = e
                    new.append(e)
        frontier = new
    return list(elems.values())


class TwistedPoisson:
    """Cloud-in-cell deposit of a particle set and its images on an N0 x N1 x N2 mesh along the covering
    torus's lattice vectors; FFT Poisson solve lap Phi = 4 pi G (rho - mean) with G m = gm per particle;
    cloud-in-cell readback of Phi or of g = -grad Phi (four-point difference along the lattice axes, or
    spectral with gradient="ik"). Both cloud-in-cell windows are
    divided out by default (deconvolve=2; 1 divides one, 0 none); smooth > 0 multiplies by a Gaussian
    exp(-k^2 smooth^2 / 2). images=False is the planted untwisted solve: the same particles on the bare
    covering torus."""

    def __init__(self, name, L, N, images=True, smooth=0.0, deconvolve=2, gradient="fd4"):
        self.name, self.L, self.N = name, tuple(map(float, L)), tuple(int(n) for n in N)
        self.A = lattice(name, L)
        self.Ainv = np.linalg.inv(self.A)
        self.volume = abs(np.linalg.det(self.A))
        self.group = group(name, L) if images else [(np.eye(3), np.zeros(3))]
        n = [np.fft.fftfreq(m, 1.0 / m) for m in self.N[:2]] + [np.fft.rfftfreq(self.N[2], 1.0 / self.N[2])]
        nn = np.stack(np.meshgrid(*n, indexing="ij"), axis=-1)
        self.kvec = 2 * np.pi * nn @ self.Ainv                 # k = 2 pi A^-T n, as rows
        if gradient == "fd4":
            # four-point difference along each lattice axis (odd, so no self-force), mapped by A^-T
            th = 2 * np.pi * nn / np.asarray(self.N, float)
            self.gvec = ((8 * np.sin(th) - np.sin(2 * th)) / 6 * np.asarray(self.N, float)) @ self.Ainv
        else:
            nyq = np.any(2 * np.abs(nn) == np.asarray(self.N), axis=-1)
            self.gvec = self.kvec * ~nyq[..., None]             # spectral, Nyquist removed to keep it odd
        self.k2 = np.sum(self.kvec ** 2, axis=-1)
        w = 1.0
        for ax in range(3):
            w = w * np.sinc(nn[..., ax] / self.N[ax]) ** 2      # cloud-in-cell window per axis
        self.window = w ** deconvolve
        self.smooth = smooth

    def images(self, pos):
        return np.concatenate([pos @ R.T + t for R, t in self.group])

    def _cells(self, pos):
        u = np.mod(pos @ self.Ainv.T, 1.0) * np.asarray(self.N)
        i0 = np.floor(u).astype(np.int64)
        return i0, u - i0

    def deposit(self, pos):
        """Mass per cell on the covering torus, images included (every image carries the particle's mass)."""
        i0, d = self._cells(self.images(pos))
        N = self.N
        out = np.zeros(np.prod(N))
        for c in CORNERS:
            idx = (((i0[:, 0] + c[0]) % N[0]) * N[1] + (i0[:, 1] + c[1]) % N[1]) * N[2] + (i0[:, 2] + c[2]) % N[2]
            w = np.prod([d[:, a] if c[a] else 1 - d[:, a] for a in range(3)], axis=0)
            out += np.bincount(idx, weights=w, minlength=out.size)
        return out.reshape(N)

    def potential_k(self, pos, gm=1.0):
        rho = self.deposit(pos) * gm / (self.volume / np.prod(self.N))
        rk = np.fft.rfftn(rho)
        k2 = self.k2
        phi = -4 * np.pi * rk / np.where(k2 > 0, k2, 1.0) * (k2 > 0) / self.window
        if self.smooth:
            phi = phi * np.exp(-0.5 * k2 * self.smooth ** 2)
        return phi

    def read(self, mesh, pts):
        i0, d = self._cells(np.atleast_2d(pts))
        N = self.N
        out = 0.0
        for c in CORNERS:
            w = np.prod([d[:, a] if c[a] else 1 - d[:, a] for a in range(3)], axis=0)
            out = out + mesh[(i0[:, 0] + c[0]) % N[0], (i0[:, 1] + c[1]) % N[1], (i0[:, 2] + c[2]) % N[2]] * w
        return out

    def potential(self, pos, pts, gm=1.0):
        return self.read(np.fft.irfftn(self.potential_k(pos, gm), s=self.N, axes=(0, 1, 2)), pts)

    def accel(self, pos, pts=None, gm=1.0):
        phi = self.potential_k(pos, gm)
        pts = pos if pts is None else pts
        meshes = (np.fft.irfftn(-1j * self.gvec[..., a] * phi, s=self.N, axes=(0, 1, 2)) for a in range(3))
        return np.stack([self.read(m, pts) for m in meshes], axis=1)


def eigen_potential(name, L, src, pts, smooth, nmax, gm=1.0):
    """Potential at pts of a Gaussian-smoothed point mass at src on M, summed over M's eigenmodes:
    Phi(x) = -4 pi G m sum_n psi_n(x) psi_n*(src) exp(-k^2 s^2 / 2) / k^2, the eigenmodes from COMPACT's
    selection rules and each eigenfunction the orbit sum over G of exp(i k . g(x)), normalised on M."""
    A = lattice(name, L)
    G = group(name, L)
    vol_m = abs(np.linalg.det(A)) / len(G)
    modes = topology.analytic_modes(name, nmax)
    modes = modes[np.any(modes != 0, axis=1)]
    kv = 2 * np.pi * modes @ np.linalg.inv(A)                  # rows: k for each representative
    k2 = np.sum(kv ** 2, axis=1)
    keep = np.exp(-0.5 * k2 * smooth ** 2) > 1e-12
    kv, k2 = kv[keep], k2[keep]
    pts = np.atleast_2d(pts)
    src = np.asarray(src, float)
    # orbit sum: psi(x) = sum_g exp(i k . (R_g x + t_g)) = sum_g c_g exp(i (R_g^T k) . x)
    qs = np.stack([kv @ R for R, _ in G], axis=1)              # (modes, |G|, 3): R_g^T k
    cs = np.exp(1j * np.stack([kv @ t for _, t in G], axis=1))
    # norm on M: group equal plane waves, sum |coefficient|^2, times V_M
    norm2 = np.empty(len(kv))
    for i in range(len(kv)):
        q = np.round(qs[i] @ A / (2 * np.pi)).astype(np.int64)
        _, inv = np.unique(q, axis=0, return_inverse=True)
        norm2[i] = vol_m * np.sum(np.abs(np.bincount(inv.ravel(), weights=cs[i].real)
                                         + 1j * np.bincount(inv.ravel(), weights=cs[i].imag)) ** 2)
    psi_src = np.sum(cs * np.exp(1j * qs @ src), axis=1)
    out = np.empty(len(pts))
    w = np.exp(-0.5 * k2 * smooth ** 2) / k2 / norm2
    for j, x in enumerate(pts):
        psi_x = np.sum(cs * np.exp(1j * qs @ x), axis=1)
        out[j] = -4 * np.pi * gm * np.real(np.sum(psi_x * np.conj(psi_src) * w))
    return out


class TwistedPM:
    """Particle-mesh N-body on a twisted manifold: kick-drift-kick in the scale factor (as pm.PMSolver), with
    forces from TwistedPoisson. Only the particles of M are evolved; their images are rebuilt each step."""

    def __init__(self, cosmo, name, L, N, n_particles, deconvolve=1):
        self.cosmo = cosmo
        self.poisson = TwistedPoisson(name, L, N, deconvolve=deconvolve)
        vol_m = self.poisson.volume / len(self.poisson.group)
        self.gm = 1.5 * cosmo.omega_m * vol_m / (4 * np.pi * n_particles)

    def wrap(self, pos):
        return np.mod(pos @ self.poisson.Ainv.T, 1.0) @ self.poisson.A.T

    def accel(self, pos):
        return self.poisson.accel(pos, gm=self.gm)

    def run(self, pos, mom, a_steps, callback=None):
        acc = self.accel(pos)
        for a0, a1 in zip(a_steps[:-1], a_steps[1:]):
            am = 0.5 * (a0 + a1)
            mom = mom + acc * self.cosmo.kick_factor(a0, am)
            pos = self.wrap(pos + mom * self.cosmo.drift_factor(a0, a1))
            acc = self.accel(pos)
            mom = mom + acc * self.cosmo.kick_factor(am, a1)
            if callback is not None:
                callback(a1, pos, mom)
        return pos, mom
