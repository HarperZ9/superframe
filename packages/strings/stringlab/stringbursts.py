# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: FSL-1.1-MIT
"""The burst recipe of the LIGO-Virgo-KAGRA cosmic-string searches: cusps, kinks and kink-kink collisions.

Following Abbott et al. 2021 (PRL 126 241102, section II and Supplemental Material) and Abbott et al. 2018:
    h_i = A_i f^-q_i,  A_i = g1_i G mu l^(2 - q_i) / ((1+z)^(q_i - 1) r),  q = 4/3, 5/3, 2 for c, k, kk;
    burst rate per loop length and proper volume: (2 N_i / l) n(l, t) Delta_i (1+z)^-1,
    Delta_i = (theta_m / 2)^(3 (2 - q_i)), theta_m = (g2 f (1+z) l)^(-1/3), theta_m < 1 for cusps and kinks;
    Omega(f) = (4 pi^2 / (3 H0^2)) f^3 sum_i int dz int dl h_i^2 d^2R_i/(dz dl).
With the proper volume dV = 4 pi r^2 dz / ((1+z)^3 H), r cancels:
    Omega_i(f) = (16 pi^3 / (3 H0^2)) N_i g1_i^2 (G mu)^2 f^(3 - 2 q_i) int dz / ((1+z)^(2 q_i + 2) H)
                 int dl 2 l^(3 - 2 q_i) n(l, t) Delta_i.
Loop decay constant: Gamma_d = N_c 3 pi^2 g1c^2 / ((2 delta)^(1/3) g2^(2/3)) + N_k 3 pi^2 g1k^2 / ((2 delta)^(2/3)
g2^(1/3)) + N_kk 2 pi^2 g1kk^2, delta = max(1, 1 / (2 g2)), N_kk = N_k^2 / 4.
Model A (Blanco-Pillado, Olum, Shlaer loops), as in the LVK Supplemental Material:
    radiation-born: n = 0.18 (2 H0 sqrt(Omega_r))^(3/2) (1+z)^3 / (l + Gamma_d G mu t)^(5/2),
        for t < t_eq: l < 0.18 t;  for t > t_eq: l < 0.18 t_eq - Gamma_d G mu (t - t_eq);
    matter-born: n = (0.27 - 0.45 (l/t)^0.31) / (t^2 (l + Gamma_d G mu t)^2), l/t < 0.18, l > 0.18 t_eq - Gamma_d G mu (t - t_eq).
"""
import math

import numpy as np
from scipy.special import gamma as Gfun

G1 = {"c": 8 / Gfun(1 / 3) ** 2 * (2 / 3) ** (2 / 3),
      "k": 2 * math.sqrt(2) / math.pi / Gfun(1 / 3) * (2 / 3) ** (2 / 3),
      "kk": 1 / math.pi ** 2}
Q = {"c": 4 / 3, "k": 5 / 3, "kk": 2.0}
G2 = math.sqrt(3) / 4
DELTA = max(1.0, 1 / (2 * G2))


def counts(Nk, Nc=1.0):
    return {"c": Nc, "k": Nk, "kk": Nk ** 2 / 4}


def gamma_d(Nk, Nc=1.0):
    N = counts(Nk, Nc)
    return (N["c"] * 3 * math.pi ** 2 * G1["c"] ** 2 / ((2 * DELTA) ** (1 / 3) * G2 ** (2 / 3))
            + N["k"] * 3 * math.pi ** 2 * G1["k"] ** 2 / ((2 * DELTA) ** (2 / 3) * G2 ** (1 / 3))
            + N["kk"] * 2 * math.pi ** 2 * G1["kk"] ** 2)


def t_equality(co):
    """Cosmic time when the radiation and matter densities are equal (interpolated on the grid)."""
    z = np.expm1(-co.N)
    r = co.orad * co.gfac * (1 + z) - co.om          # radiation over matter, minus one, times Omega_m
    hit = np.where(np.diff(np.sign(r)) != 0)[0]
    if hit.size == 0:                                   # no equality on the grid (a pure-radiation test universe)
        return float(co.t[-1] * 10) if r[-1] > 0 else float(co.t[0] / 10)
    i = hit[0]
    return float(np.interp(0.0, [r[i + 1], r[i]], [co.t[i + 1], co.t[i]]))


def density_model_a(l, t, z, gmu, Gd, co, teq, form="t", rad_cut=0.18):
    """BOS model A number density n(l, t), arrays broadcast; per proper volume and length (s^-4).
    form "t": radiation-born loops scale as 0.18 t^(-3/2) before t_eq and dilute as (1+z)^3 after it;
    form "z": the Supplemental-Material expression 0.18 (2 H0 sqrt(Omega_r))^(3/2) (1+z)^3 at all times."""
    dec = Gd * gmu
    if form == "z":
        pre = 0.18 * (2 * co.H0 * math.sqrt(co.orad)) ** 1.5 * (1 + z) ** 3
    else:
        zeq = float(np.interp(teq, co.t, np.expm1(-co.N)))
        pre = 0.18 * np.where(t < teq, t ** -1.5, teq ** -1.5 * ((1 + z) / (1 + zeq)) ** 3)
    rad = pre / (l + dec * t) ** 2.5
    lim = np.where(t < teq, rad_cut * t, rad_cut * teq - dec * (t - teq))
    rad = np.where(l < lim, rad, 0.0)
    g = l / t
    mat = (0.27 - 0.45 * np.clip(g, 0, None) ** 0.31) / (t ** 2 * (l + dec * t) ** 2)
    mat = np.where((t > teq) & (g < 0.18) & (l > 0.18 * teq - dec * (t - teq)), mat, 0.0)
    return rad + mat


def omega_components(co, f, gmu, Nk, Nc=1.0, n_gamma=240, hubble_ref=None, form="t", g1k=None, rad_cut=0.18,
                     lmin_rule="theta", gd_g1k=False):
    """Omega_i(f) for i in c, k, kk on the cosmology grid; returns dict of arrays over f.
    hubble_ref: report Omega normalised to this H0 (1/s) instead of the cosmology's (Omega scales as 1/H0^2).
    rad_cut: largest radiation-born loop in units of t (model A uses 0.18; the 2018 paper's eq. 8 uses 0.1).
    lmin_rule "theta" requires theta_m < 1 for cusps and kinks; "fundamental" only l > 2 / (f (1+z)).
    gd_g1k: use g1k (when given) in the decay constant as well as in the amplitude."""
    f = np.atleast_1d(np.asarray(f, dtype=float))
    Gd = gamma_d(Nk, Nc)
    if gd_g1k and g1k is not None:
        Gd += Nk * 3 * math.pi ** 2 * (g1k ** 2 - G1["k"] ** 2) / ((2 * DELTA) ** (2 / 3) * G2 ** (1 / 3))
    teq = t_equality(co)
    z = np.expm1(-co.N)
    t = co.t
    N = counts(Nk, Nc)
    out = {i: np.zeros(f.size) for i in Q}
    gmax = 0.18
    for j, fj in enumerate(f):
        for i, q in Q.items():
            if N[i] == 0:
                continue
            lmin = (1 / (G2 * fj * (1 + z))) if (i != "kk" and lmin_rule == "theta") else 2 / (fj * (1 + z))
            gmin = lmin / t
            ok = gmin < gmax
            if not ok.any():
                continue
            u = np.linspace(0, 1, n_gamma)
            gam = np.exp(np.log(gmin[ok, None]) + u[None, :] * (math.log(gmax) - np.log(gmin[ok, None])))
            l = gam * t[ok, None]
            n = density_model_a(l, t[ok, None], z[ok, None], gmu, Gd, co, teq, form, rad_cut)
            if i == "kk":
                Delta = 1.0
            else:
                Delta = ((G2 * fj * (1 + z[ok, None]) * l) ** (-1 / 3) / 2) ** (3 * (2 - q))
            integ_l = np.trapezoid(2 * l ** (3 - 2 * q) * n * Delta * l, u, axis=1) * (math.log(gmax) - np.log(gmin[ok]))
            wz = integ_l / ((1 + z[ok]) ** (2 * q + 2) * co.H[ok])
            # dz = (1+z) dN (N = ln a decreasing in z): integrate over N with |dz/dN| = 1 + z
            Iz = np.trapezoid(wz * (1 + z[ok]), co.N[ok])
            g1 = g1k if (i == "k" and g1k is not None) else G1[i]
            out[i][j] = 16 * math.pi ** 3 / (3 * co.H0 ** 2) * N[i] * g1 ** 2 * gmu ** 2 * fj ** (3 - 2 * q) * Iz
    if hubble_ref is not None:
        for i in out:
            out[i] *= (co.H0 / hubble_ref) ** 2
    return out


def omega(co, f, gmu, Nk, Nc=1.0, **kw):
    comp = omega_components(co, f, gmu, Nk, Nc, **kw)
    return comp["c"] + comp["k"] + comp["kk"]
