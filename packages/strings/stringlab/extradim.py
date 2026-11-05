# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""Large extra dimensions against inverse-square-law data.

Gravity in 4 + n dimensions with n of them on a torus of radius R. Between two point masses on the brane,
    V(r) = V_N(r) [1 + c sum_{k in Z^n, k != 0} exp(-|k| r / R)],
the Kaluza-Klein tower summed exactly (masses |k|/R). c = 1 for the scalar Green's function (Kehagias and
Sfetsos 1999: alpha = 2n on the torus); c = 4/3 for massive spin-2 modes, whose longitudinal polarisation
does not decouple from a static source (Adelberger, Heckel, Nelson 2003: alpha = 8n/3). At r >> R the
lightest 2n modes dominate: a Yukawa term with alpha = 2n c and lambda = R. At r << R the sum turns into
the (4+n)-dimensional law V ~ 1/r^{1+n}. The same potential is computed a second way, by the image sum of the
(3+n)-dimensional Green's function over the periodic copies, which agrees with the KK sum only through
Poisson resummation.

The data side: an exclusion curve |alpha|(lambda) at 95% confidence. lambda_at_alpha reads the curve;
add_scale turns a radius bound into the unification scale M* by AHN eq. 6,
    G = (hbar c / M*^2) (hbar / M* c)^n / (2 pi R)^n,
and radion_scale uses lambda_radion = hbar c M_Pl / M*^2 (Adelberger et al. 2007 eq. 8, about 2.4 mm at 1 TeV).
"""
import math

import numpy as np

# CODATA 2022 (the hbar, c and e values match packages/measured/generated/constants.py; G is CODATA 2022 too)
HBAR = 1.054571817e-34
C = 299792458.0
E = 1.602176634e-19
G = 6.67430e-11
HBARC_GEV_M = HBAR * C / E / 1e9                 # 1.9733e-16 GeV m
M_PLANCK_GEV = math.sqrt(HBAR * C / G) * C ** 2 / E / 1e9   # 1.2209e19 GeV (unreduced)


def _shell_counts(n, kmax):
    """Multiplicity of each |k|^2 for k in Z^n, |k_i| <= kmax, excluding 0."""
    ax = np.arange(-kmax, kmax + 1, dtype=np.int64) ** 2
    s2 = ax
    for _ in range(n - 1):
        s2 = (s2[..., None] + ax).reshape(-1)
    vals, cnt = np.unique(s2[s2 > 0], return_counts=True)
    return dict(zip(vals.tolist(), cnt.tolist()))


def kk_ratio(r_over_R, n, c=1.0, kmax=None, excess=False):
    """V/V_N from the Kaluza-Klein sum (or V/V_N - 1 with excess=True). kmax defaults to enough shells that the tail is below 1e-16."""
    x = np.atleast_1d(np.asarray(r_over_R, dtype=float))
    if kmax is None:
        kmax = int(math.ceil(40.0 / x.min())) + 2
        kmax = min(kmax, {1: 200000, 2: 1500, 3: 120}.get(n, 40))
    counts = _shell_counts(n, kmax) if n > 1 else {k * k: 2 for k in range(1, kmax + 1)}
    s2 = np.array(sorted(counts))
    mult = np.array([counts[k] for k in s2], dtype=float)
    norm = np.sqrt(s2)
    if n > 1:  # keep only complete spheres |k| <= kmax
        keep = norm <= kmax
        norm, mult = norm[keep], mult[keep]
    out = c * (mult[None, :] * np.exp(-np.outer(x, norm))).sum(1)
    if not excess:
        out = 1.0 + out
    return out if out.size > 1 else float(out[0])


def image_ratio(r_over_R, n, images=4000):
    """V/V_N from the image sum of the (3+n)-dimensional Green's function, scalar coupling (c = 1).

    Brane separation r, periodic directions of circumference 2 pi R. Normalised so that V/V_N -> 1 at large r:
    Units R = 1, L = 2 pi. n = 1: V/V_N = (L r / pi) sum_m 1/(r^2 + (L m)^2); n = 2: V/V_N = (L^2 r / 2 pi)
    sum_m (r^2 + L^2 |m|^2)^(-3/2). The far tail is added as an integral.
    """
    x = float(r_over_R)
    L = 2 * math.pi
    if n == 1:
        m = np.arange(-images, images + 1, dtype=float)
        s = (1.0 / (x * x + (L * m) ** 2)).sum()
        tail = 2.0 / (L * L * (images + 0.5))   # sum_{|m|>images} 1/(L m)^2, by the integral
        return x * L / math.pi * (s + tail)
    if n == 2:
        m = np.arange(-images // 20, images // 20 + 1, dtype=float)
        mx, my = np.meshgrid(m, m, indexing="ij")
        d2 = x * x + (L * mx) ** 2 + (L * my) ** 2
        s = (d2 ** -1.5).sum()
        M = images // 20 + 0.5
        tail = 4 * math.sqrt(2) / (L ** 3 * M)  # integral of rho^-3 outside a square of half-width L M is 4 sqrt(2) / (L M)
        return x * L * L / (2 * math.pi) * (s + tail)
    raise ValueError("image sum implemented for n = 1, 2")


def yukawa_alpha(n, c=1.0, r_over_R=80.0):
    """Read alpha from the KK sum at large r: (V/V_N - 1) exp(r/R)."""
    return kk_ratio(r_over_R, n, c, excess=True) * math.exp(r_over_R)


def log_slope(n, r_over_R=1e-3, c=1.0):
    """d log(V) / d log r at small r; tends to -(1 + n)."""
    h = 1e-3
    a = kk_ratio(r_over_R * (1 - h), n, c) / (r_over_R * (1 - h))
    b = kk_ratio(r_over_R * (1 + h), n, c) / (r_over_R * (1 + h))
    return (math.log(b) - math.log(a)) / (math.log(1 + h) - math.log(1 - h))


def lambda_at_alpha(curve, alpha):
    """lambda where the exclusion curve crosses |alpha|, log-log interpolation; curve = [(lambda, alpha), ...]."""
    p = np.asarray(sorted(curve))
    la, aa = np.log10(p[:, 0]), np.log10(p[:, 1])
    t = math.log10(alpha)
    idx = np.where(np.diff(np.sign(aa - t)) != 0)[0]
    if idx.size == 0:
        return None
    i = idx[0]
    f = (t - aa[i]) / (aa[i + 1] - aa[i])
    return float(10 ** (la[i] + f * (la[i + 1] - la[i])))


def excluded(curve, lam, alpha):
    """True when (lambda, |alpha|) lies above the curve, i.e. excluded."""
    p = np.asarray(sorted(curve))
    if not p[0, 0] <= lam <= p[-1, 0]:
        return None
    a = 10 ** np.interp(math.log10(lam), np.log10(p[:, 0]), np.log10(p[:, 1]))
    return bool(abs(alpha) > a)


def add_scale(R_m, n):
    """M* in GeV from AHN eq. 6 for n extra dimensions of radius R."""
    return (M_PLANCK_GEV ** 2 * (HBARC_GEV_M / (2 * math.pi * R_m)) ** n) ** (1.0 / (n + 2))


def radion_scale(lam_m):
    """M* in GeV from lambda_radion = hbar c M_Pl / M*^2."""
    return math.sqrt(HBARC_GEV_M * M_PLANCK_GEV / lam_m)


def boson_mass_eV(lam_m):
    """Mass whose Compton wavelength is lambda: m = hbar c / lambda, in eV."""
    return HBARC_GEV_M * 1e9 / lam_m


def bounds(curve):
    """Every bound this module derives from one exclusion curve."""
    out = {"lambda_alpha1_m": lambda_at_alpha(curve, 1.0)}
    for n in (1, 2, 3):
        for c, tag in ((4.0 / 3.0, "graviton"), (1.0, "scalar")):
            a = 2 * n * c
            lam = lambda_at_alpha(curve, a)
            out[f"R_max_n{n}_{tag}_m"] = lam
            out[f"Mstar_min_n{n}_{tag}_GeV"] = add_scale(lam, n) if lam else None
    for n in (1, 6):
        lam = lambda_at_alpha(curve, n / (n + 2))
        out[f"radion_n{n}_lambda_m"] = lam
        out[f"radion_n{n}_Mstar_GeV"] = radion_scale(lam) if lam else None
    out["dilaton_mass_min_eV"] = boson_mass_eV(out["lambda_alpha1_m"])
    return out
