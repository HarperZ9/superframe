# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Matter power spectrum of a particle set: cloud-in-cell assignment, window deconvolution and the
cloud-in-cell shot-noise term of Jing (2005, ApJ 620, 559), binned in shells of the fundamental mode.

Interlacing (Hockney and Eastwood 1981; Sefusatti et al. 2016, MNRAS 460, 3624): a second deposit with every
particle moved half a cell along each axis, phase-shifted back and averaged with the first, cancels the
aliased images whose index sum is odd. The shot-noise term then sums only the images that survive."""
import numpy as np

from .pm import PMSolver


def _alias_sums(x, images=24):
    """Per axis, over aliased images n: sum of the CIC power window W^2 = sinc^4(x + n pi), and the same sum
    with sign (-1)^n. x = k h / 2."""
    n = np.arange(-images, images + 1).reshape(-1, 1)
    w = np.sinc((x.reshape(1, -1) + n * np.pi) / np.pi) ** 4
    return w.sum(0), ((-1.0) ** n * w).sum(0)


def _interlace(ops, dkm, d2, box, ng):
    """(F1 + F2 exp(i k . h/2 (1, 1, 1))) / 2 for F2 the transform of the half-cell-shifted deposit."""
    h = box / ng
    ph = [np.exp(0.5j * h * 2 * np.pi * np.fft.fftfreq(ng, d=h)), None,
          np.exp(0.5j * h * 2 * np.pi * np.fft.rfftfreq(ng, d=h))]
    ph[1] = ph[0]
    if hasattr(ops, "torch"):
        ph = [ops.torch.as_tensor(p.astype(np.complex64), device=ops.device) for p in ph]
    d2 = d2 * ph[0].reshape(-1, 1, 1)
    d2 *= ph[1].reshape(1, -1, 1)
    d2 *= ph[2].reshape(1, 1, -1)
    d2 += dkm
    d2 *= 0.5
    return d2


def power_spectrum(pos, box, ng, ops, n_particles, cosmo=None, subtract_shot=True, dk=None, kmax=None, delta=None,
                   delta_half=None, interlace=False, return_shot=False):
    """Returns (k_mean, P, n_modes) with k in h/Mpc and P in (Mpc/h)^3. delta: a cloud-in-cell density
    contrast already deposited on the ng^3 mesh (pos is then not read). interlace: also deposit pos moved
    half a cell along every axis and average the two transforms; delta_half supplies that second deposit.
    return_shot: also return the binned shot-noise term (after window division), subtracted or not."""
    interlace = interlace or delta_half is not None
    if delta is None:
        delta = PMSolver(cosmo, box, ng, n_particles, ops).deposit(pos)
    if interlace and delta_half is None:
        delta_half = PMSolver(cosmo, box, ng, n_particles, ops).deposit(np.mod(np.asarray(pos) + 0.5 * box / ng, box))
    dkm = ops.rfftn(delta)
    if interlace:
        dkm = _interlace(ops, dkm, ops.rfftn(delta_half), box, ng)
        del delta_half
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
    sh = 0.0
    if (subtract_shot or return_shot) and not interlace:
        sh = ((1 - 2 / 3 * s[0]).reshape(-1, 1, 1) * (1 - 2 / 3 * s[1]).reshape(1, -1, 1)
              * (1 - 2 / 3 * s[2]).reshape(1, 1, -1)) * vol / n_particles
    elif subtract_shot or return_shot:
        # images survive when nx + ny + nz is even: (prod of plain sums + prod of signed sums) / 2
        (ax, sx), (az, sz) = _alias_sums(0.5 * k1 * h), _alias_sums(0.5 * kz1 * h)
        sh = 0.5 * (ax.reshape(-1, 1, 1) * ax.reshape(1, -1, 1) * az.reshape(1, 1, -1)
                    + sx.reshape(-1, 1, 1) * sx.reshape(1, -1, 1) * sz.reshape(1, 1, -1)) * vol / n_particles
    if subtract_shot:
        p_raw -= sh
    p_raw /= w2
    sh = sh / w2 if return_shot else None
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
    out = (ksum[good] / nmodes[good], psum[good] / nmodes[good], nmodes[good])
    if return_shot:
        ssum = np.bincount(i, weights=m * np.broadcast_to(sh, kmag.shape).ravel()[ok], minlength=nb)
        out += (ssum[good] / nmodes[good],)
    return out
