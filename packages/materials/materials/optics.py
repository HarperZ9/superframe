# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Spectral shading from complex refractive index. Standard library only.

Fresnel equations with complex N = n + ik (one law for metals and dielectrics),
a GGX microfacet lobe with Smith masking, and a body term for light that enters
the material: a layer over a white ground (absorption from k), or the diffusion
dipole total reflectance when scattering is known.
"""
import cmath
import math

from .spectral import GRID


def fresnel(N, cos_i, n_out=1.0):
    """Unpolarised reflectance at a smooth interface from a medium of real index
    n_out into complex index N, for incidence cosine cos_i."""
    cos_i = min(max(cos_i, 0.0), 1.0)
    eta = complex(N) / n_out
    s2 = 1.0 - cos_i * cos_i
    w = cmath.sqrt(eta * eta - s2)
    rs = (cos_i - w) / (cos_i + w)
    rp = (eta * eta * cos_i - w) / (eta * eta * cos_i + w)
    return 0.5 * (abs(rs) ** 2 + abs(rp) ** 2)


def normal_reflectance(n, k):
    """((n-1)^2 + k^2) / ((n+1)^2 + k^2), the normal-incidence limit."""
    return ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k)


def ggx_d(cos_h, alpha):
    a2 = alpha * alpha
    d = cos_h * cos_h * (a2 - 1) + 1
    return a2 / (math.pi * d * d)


def smith_g1(cos_x, alpha):
    a2 = alpha * alpha
    return 2 * cos_x / (cos_x + math.sqrt(a2 + (1 - a2) * cos_x * cos_x))


def nk(material):
    """(n, k) lists on GRID; k defaults to 0 where only n is known."""
    opt = material.get("optics") or {}
    n = (opt.get("n") or {}).get("value")
    k = (opt.get("k") or {}).get("value")
    if n is None:
        return None, None
    return n, (k if k is not None else [0.0] * len(GRID))


def absorption_coefficient(k):
    """alpha = 4 pi k / lambda, in 1/m."""
    return [4 * math.pi * kk / (w * 1e-9) for kk, w in zip(k, GRID)]


def dipole_rd(mu_a, mu_s_prime, n_rel):
    """Total diffuse reflectance of a semi-infinite scattering medium
    (Jensen et al. 2001 dipole, with the Groenhuis/Egan internal-reflection fit)."""
    if mu_a + mu_s_prime <= 0:
        return 0.0
    a = mu_s_prime / (mu_a + mu_s_prime)
    fdr = -1.440 / n_rel ** 2 + 0.710 / n_rel + 0.668 + 0.0636 * n_rel
    A = (1 + fdr) / (1 - fdr)
    s = math.sqrt(3 * (1 - a))
    return 0.5 * a * (1 + math.exp(-4 / 3 * A * s)) * math.exp(-s)


def body_albedo(material, thickness_m=None):
    """Spectrum of light returned from below the surface, or None if unknown.
    Conductors return zeros. Scattering media use the dipole. Others use a layer of
    the given thickness over a white ground (render knob, not a material property)."""
    opt = material.get("optics") or {}
    n, k = nk(material)
    if n is None:
        return None
    if opt.get("conductor"):
        return [0.0] * len(GRID)
    sc = opt.get("scattering")
    if sc and sc.get("mu_a_per_mm") and sc.get("mu_s_prime_per_mm"):
        return [dipole_rd(a, s, nn) for a, s, nn in
                zip(sc["mu_a_per_mm"]["value"], sc["mu_s_prime_per_mm"]["value"], n)]
    d = thickness_m if thickness_m is not None else material.get("render", {}).get("layer_m", 0.01)
    return [math.exp(-2 * a * d) for a in absorption_coefficient(k)]


def shade(material, light, theta_view_deg, roughness=0.25, theta_light_deg=None, thickness_m=None):
    """Outgoing spectral radiance (per unit light irradiance) for a directional light.

    material: a library record. light: spectral power on GRID. theta_view_deg: view
    angle from the normal. The light sits in the same plane, mirrored about the
    normal unless theta_light_deg is given. Returns a list on GRID."""
    n, k = nk(material)
    if n is None:
        raise ValueError(f"{material.get('id')}: no spectral n, cannot shade")
    tv = math.radians(theta_view_deg)
    tl = math.radians(theta_view_deg if theta_light_deg is None else theta_light_deg)
    cv, cl = max(math.cos(tv), 1e-4), max(math.cos(tl), 1e-4)
    # half vector in the plane: view at +tv, light at -tl
    vx, vz = math.sin(tv), math.cos(tv)
    lx, lz = -math.sin(tl), math.cos(tl)
    hx, hz = vx + lx, vz + lz
    hn = math.hypot(hx, hz)
    cos_h, cos_d = hz / hn, (vx * hx + vz * hz) / hn
    alpha = max(roughness * roughness, 1e-3)
    spec_scalar = ggx_d(cos_h, alpha) * smith_g1(cv, alpha) * smith_g1(cl, alpha) / (4 * cv * cl)
    body = body_albedo(material, thickness_m)
    out = []
    for i in range(len(GRID)):
        N = complex(n[i], k[i])
        F = fresnel(N, cos_d)
        f = spec_scalar * F
        if body is not None:
            f += (1 - fresnel(N, cl)) * (1 - fresnel(N, cv)) * body[i] / math.pi
        out.append(light[i] * f * cl)
    return out
