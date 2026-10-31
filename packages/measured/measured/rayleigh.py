# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Rayleigh scattering of dry air after Bodhaine et al. 1999 (JAOT 16, 1854).

sigma(lambda) = 24 pi^3 (n^2 - 1)^2 / (lambda^4 Ns^2 (n^2 + 2)^2) * F_air(lambda)        (their eq. 2)
n: Peck and Reeder 1972 for 300 ppm CO2, scaled to the CO2 fraction (eqs. 4 and 19);
F_air: Bates 1984 King factors of N2 and O2, Ar = 1.00, CO2 = 1.15 (eqs. 5, 6, 23);
Ns = 2.546899e19 cm^-3 at 288.15 K and 1013.25 hPa (their Table 1).
This reproduces their Table 3 at every row (see data/rayleigh_bodhaine1999.json, check block).
"""
import math

NS_CM3 = 2.546899e19


def n_air(lam_um, co2=360e-6):
    s2 = 1.0 / lam_um ** 2
    n300 = 1 + (8060.51 + 2480990 / (132.274 - s2) + 17455.7 / (39.32957 - s2)) * 1e-8
    return 1 + (n300 - 1) * (1 + 0.54 * (co2 - 0.0003))


def king(lam_um, co2=360e-6):
    s2 = 1.0 / lam_um ** 2
    fn2 = 1.034 + 3.17e-4 * s2
    fo2 = 1.096 + 1.385e-3 * s2 + 1.448e-4 * s2 * s2
    c = co2 * 100
    return (78.084 * fn2 + 20.946 * fo2 + 0.934 * 1.0 + c * 1.15) / (78.084 + 20.946 + 0.934 + c)


def sigma_cm2(lam_um, co2=360e-6):
    n = n_air(lam_um, co2)
    lam = lam_um * 1e-4
    return 24 * math.pi ** 3 * (n * n - 1) ** 2 / (lam ** 4 * NS_CM3 ** 2 * (n * n + 2) ** 2) * king(lam_um, co2)


def beta_per_m(lam_um, co2=360e-6, number_density_cm3=NS_CM3):
    """Volume scattering coefficient at sea-level standard density (288.15 K, 1013.25 hPa)."""
    return sigma_cm2(lam_um, co2) * number_density_cm3 * 100.0


def koschmieder(beta, contrast=0.02):
    """Visual range ln(1/contrast)/beta. contrast 0.02 is Koschmieder's threshold (3.912/beta);
    0.05 is the WMO meteorological optical range (2.996/beta), what a weather report quotes."""
    return math.log(1.0 / contrast) / beta
