# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The Lamb wave: the atmosphere's own guided acoustic mode, the one the 2022 Hunga eruption sent round the globe.

Linear, compressible, non-hydrostatic, windless and flat: for a horizontal wavenumber k the vertical structure
(vertical displacement zeta on cell faces, pressure on cell centres, zeta = 0 at the ground and the lid) is a
generalised eigenproblem in omega^2. The Lamb mode is the one whose kinetic energy is most horizontal.
Known answers: in an isothermal atmosphere the Lamb speed equals the adiabatic sound speed sqrt(gamma R T / M)
exactly; in the 1976 standard atmosphere it is near the 308 to 318 m/s measured for the Hunga wave.
"""
import numpy as np
from scipy.linalg import eig

from . import consts


def ussa_temperature(z):
    """1976 standard-atmosphere temperature (K) at geometric height z (m), extended isothermally above 86 km."""
    u = consts.media()["ussa1976"]
    r0 = u["r0_km"] * 1e3
    H = r0 * z / (r0 + z) / 1e3  # geopotential km'
    Hb, L = u["Hb_km"], u["LMb_K_per_km"]
    T = u["T0_K"]
    for i in range(len(L)):
        top = Hb[i + 1]
        if H <= top:
            return T + L[i] * (H - Hb[i])
        T = T + L[i] * (top - Hb[i])
    return T


def profile(T_of_z, ztop=120e3, n=480, g=None, M=None):
    """Hydrostatic profile on n cells: centres zc, faces zf, and T, p, rho at both."""
    g = consts.G_N if g is None else g
    M = consts.air_molar_mass() if M is None else M
    zf = np.linspace(0.0, ztop, n + 1)
    zfine = np.linspace(0.0, ztop, 20 * n + 1)
    Tf = np.array([T_of_z(z) for z in zfine])
    lnp = -np.concatenate([[0.0], np.cumsum(0.5 * (1 / Tf[1:] + 1 / Tf[:-1]) * np.diff(zfine))]) * g * M / consts.R_GAS
    p0 = consts.ATM

    def at(z):
        T = np.interp(z, zfine, Tf)
        p = p0 * np.exp(np.interp(z, zfine, lnp))
        return T, p, p * M / (consts.R_GAS * T)
    zc = 0.5 * (zf[1:] + zf[:-1])
    return {"zf": zf, "zc": zc, "g": g, "M": M, "face": at(zf), "cell": at(zc)}


def modes(prof, k, gamma=1.4):
    """All eigenpairs (omega^2, zeta on faces, p'/omega^2 on cells) for horizontal wavenumber k."""
    zf, zc, g = prof["zf"], prof["zc"], prof["g"]
    n, dz = len(zc), zf[1] - zf[0]
    _, pc, rc = prof["cell"]
    _, pf, rf = prof["face"]
    m = n - 1  # interior faces carry zeta; the ground and the lid have zeta = 0
    N = n + m
    A, B = np.zeros((N, N)), np.zeros((N, N))
    # cell rows: omega^2 pi = (gamma p k^2 / rho) pi - p' zeta - gamma p zeta_z
    for i in range(n):
        A[i, i] = gamma * pc[i] * k * k / rc[i]
        B[i, i] = 1.0
        dpdz = -rc[i] * g
        for j, w in ((i - 1, 0.5), (i, 0.5)):  # faces below (i) and above (i + 1): zeta index face - 1
            if 0 <= j < m:
                A[i, n + j] += -dpdz * w
        if 0 <= i - 1 < m:
            A[i, n + i - 1] += gamma * pc[i] / dz
        if 0 <= i < m:
            A[i, n + i] += -gamma * pc[i] / dz
    # face rows: omega^2 (rho zeta - pi_z) = -g rho' zeta - g rho zeta_z + g k^2 pi
    drho = np.gradient(rf, zf)
    for j in range(m):
        f = j + 1
        A[n + j, n + j] = -g * drho[f]
        B[n + j, n + j] = rf[f]
        B[n + j, f] += -1 / dz
        B[n + j, f - 1] += 1 / dz
        for jj, s in ((j - 1, -1), (j + 1, 1)):
            if 0 <= jj < m:
                A[n + j, n + jj] += -g * rf[f] * s / (2 * dz)
        A[n + j, f] += g * k * k * 0.5
        A[n + j, f - 1] += g * k * k * 0.5
    w2, vec = eig(A, B)
    return np.real(w2), np.real(vec[n:, :]), np.real(vec[:n, :])


def lamb_speed(prof, wavelength=2.0e6, gamma=1.4):
    """Phase speed of the mode with the smallest vertical-to-horizontal kinetic energy ratio among the
    acoustic branch (omega^2 > 0, speed 150 to 450 m/s)."""
    k = 2 * np.pi / wavelength
    w2, zeta, pi = modes(prof, k, gamma)
    _, _, rc = prof["cell"]
    _, _, rf = prof["face"]
    best, out = np.inf, None
    for i in np.flatnonzero(w2 > 0):
        c = np.sqrt(w2[i]) / k
        if not 150 < c < 450:
            continue
        ke_h = k * k * np.sum(pi[:, i] ** 2 / rc)  # u = k omega pi / rho; the common omega^2 cancels
        ke_v = np.sum(rf[1:-1] * zeta[:, i] ** 2)  # w = omega zeta
        ratio = ke_v / max(ke_h, 1e-300)
        if ratio < best:
            best, out = ratio, {"c": float(c), "vertical_fraction": float(ratio / (1 + ratio)), "index": int(i)}
    return out
