# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Wet darkening after Lekner and Dorf 1988 (Appl. Opt. 27, 1278), equations read from the author scan.

  A = (1 - R_l) a / (1 - p (1 - a))                          eq. 1, total absorption under a liquid film
  p = 1 - [1 - Rbar(n_l)] / n_l^2                            eq. 9, internal reflection at liquid-air
  Rbar(n): Stern's average reflectance of an isotropically illuminated interface        eq. 8
  a_w = (1 - a_d) a_d [1 - Rbar(n_r/n_l)] / [1 - Rbar(n_r)] + a_d^2                      eq. 11
Dry albedo is 1 - a_d; wet albedo is 1 - A with a = a_w.
Known answers printed in the paper: p(water) = 0.475 (Angstrom's 1 - 1/n^2 gives 0.437); for small a_d
and n_l = 4/3, a_w/a_d = 1.07, 1.08, 1.10 at n_r = 1.5, 2, 2.5.
Counter-evidence to keep beside it: Zhang and Voss 2006 (Appl. Opt.) measured wet and dry albedo and
report that no single theory fits; that paper is not yet held (its host's TLS chain failed).
"""
import math


def rbar(n):
    """Stern's hemispherical average reflectance, unpolarised, for relative index n > 1 (eq. 8)."""
    if abs(n - 1) < 1e-9:
        return 0.0
    if n < 1:
        raise ValueError("eq. 8 holds for n > 1")
    n2 = n * n
    return ((3 * n2 + 2 * n + 1) / (3 * (n + 1) ** 2)
            - 2 * n ** 3 * (n2 + 2 * n - 1) / ((n2 + 1) ** 2 * (n2 - 1))
            + n2 * (n2 + 1) / (n2 - 1) ** 2 * math.log(n)
            - n2 * (n2 - 1) ** 2 / (n2 + 1) ** 3 * math.log(n * (n + 1) / (n - 1)))


def p_internal(n_l):
    return 1 - (1 - rbar(n_l)) / n_l ** 2


def a_wet(a_d, n_r, n_l=4 / 3):
    return (1 - a_d) * a_d * (1 - rbar(n_r / n_l)) / (1 - rbar(n_r)) + a_d * a_d


def wet_albedo(dry_albedo, n_r=1.5, n_l=4 / 3, r_l=None):
    """Albedo of the wetted surface. r_l defaults to Rbar(n_l), reflectance of the film for diffuse light."""
    a_d = 1 - dry_albedo
    a = a_wet(a_d, n_r, n_l)
    rl = rbar(n_l) if r_l is None else r_l
    A = (1 - rl) * a / (1 - p_internal(n_l) * (1 - a))
    return 1 - A
