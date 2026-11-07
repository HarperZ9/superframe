# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Matter power spectrum of a particle set: cloud-in-cell assignment, window deconvolution and the
cloud-in-cell shot-noise term of Jing (2005, ApJ 620, 559), binned in shells of the fundamental mode."""
import numpy as np

from .pm import PMSolver


def power_spectrum(pos, box, ng, ops, n_particles, cosmo=None, subtract_shot=True, dk=None, kmax=None, delta=None):
    """Returns (k_mean, P, n_modes) with k in h/Mpc and P in (Mpc/h)^3. delta: a cloud-in-cell density
    contrast already deposited on the ng^3 mesh (pos is then not read)."""
    if delta is None:
        delta = PMSolver(cosmo, box, ng, n_particles, ops).deposit(pos)
    dkm = ops.rfftn(delta)
    p_raw = ops.to_numpy((dkm * dkm.conj()).real if hasattr(dkm, "conj") else abs(dkm) ** 2).astype(np.float64)
    del dkm, delta
    vol = box ** 3
    p_raw *= vol / ng ** 6
    kf = 2 * np.pi / box
    k1 = 2 * np.pi * np.fft.fftfreq(ng, d=box / ng)
    kz1 = 2 * np.pi * np.fft.rfftfreq(ng, d=box / ng)
    h = box / ng
    s = [np.sin(0.5 * k1 * h) ** 2, np.sin(0.5 * k1 * h) ** 2, np.sin(0.5 * kz1 * h) ** 2]
    w = [np.sinc(0.5 * k1 * h / np.pi) ** 4, np.sinc(0.5 * k1 * h / np.pi) ** 4, np.sinc(0.5 * kz1 * h / np.pi) ** 4]
    w2 = w[0].reshape(-1, 1, 1) * w[1].reshape(1, -1, 1) * w[2].reshape(1, 1, -1)
    if subtract_shot:
        sh = ((1 - 2 / 3 * s[0]).reshape(-1, 1, 1) * (1 - 2 / 3 * s[1]).reshape(1, -1, 1)
              * (1 - 2 / 3 * s[2]).reshape(1, 1, -1)) * vol / n_particles
        p_raw -= sh
    p_raw /= w2
    kmag = np.sqrt(k1.reshape(-1, 1, 1) ** 2 + k1.reshape(1, -1, 1) ** 2 + kz1.reshape(1, 1, -1) ** 2)
    # rfft stores half the modes: every kz plane except 0 and Nyquist stands for two
    mult = np.full(kz1.shape, 2.0)
    mult[0] = 1.0
    if ng % 2 == 0:
        mult[-1] = 1.0
    mult = np.broadcast_to(mult.reshape(1, 1, -1), kmag.shape)
    dk = dk or kf
    kmax = kmax or np.pi * ng / box
    edges = np.arange(0.5 * kf, kmax + dk, dk)
    idx = np.digitize(kmag.ravel(), edges) - 1
    nb = len(edges) - 1
    ok = (idx >= 0) & (idx < nb)
    i, m = idx[ok], mult.ravel()[ok]
    nmodes = np.bincount(i, weights=m, minlength=nb)
    ksum = np.bincount(i, weights=m * kmag.ravel()[ok], minlength=nb)
    psum = np.bincount(i, weights=m * p_raw.ravel()[ok], minlength=nb)
    good = nmodes > 0
    return ksum[good] / nmodes[good], psum[good] / nmodes[good], nmodes[good]
