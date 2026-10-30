# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: AGPL-3.0-only
"""Record assembly helpers: one field = value + unit + source + licence + confidence."""
import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from materials import optics, spectral  # noqa: E402

from constants import LICENCES  # noqa: E402

GRID = spectral.GRID


def field(value, unit, source, confidence, **extra):
    if value is None:
        return None
    lic_key = source.split(":")[0]
    lic = LICENCES.get(lic_key, ("unknown", None))[0]
    out = {"value": value, "unit": unit, "source": source, "licence": lic, "confidence": confidence}
    out.update({k: v for k, v in extra.items() if v is not None})
    return out


def sig(x, digits=5):
    if x is None:
        return None
    if x == 0:
        return 0.0
    return float(f"{x:.{digits}g}")


def spectral_field(values, ext_flags, source, page_name):
    if values is None or any(v is None for v in values):
        return None
    ext = [GRID[i] for i, e in enumerate(ext_flags) if e]
    frac = len(ext) / len(GRID)
    conf = "high" if frac == 0 else ("moderate" if frac <= 0.25 else "low")
    note = page_name + ("" if not ext else
                        f"; {len(ext)} of {len(GRID)} grid points lie outside the source range "
                        f"({ext[0]}-{ext[-1]} nm) and are extrapolated")
    # Gases: n - 1 is about 1e-4, so keep 9 significant digits or the refraction rounds away.
    return field([sig(v, 9 if abs(v - 1) < 0.01 else 5) for v in values], "1", source, conf,
                 extrapolated_nm=[ext[0], ext[-1]] if ext else None, note=note)


def pb_typical(values):
    """physicallybased lists: one value, [min, max], or [min, max, typical]."""
    if values is None:
        return None, None
    if not isinstance(values, list):
        return float(values), None
    if len(values) == 1:
        return float(values[0]), None
    if len(values) == 3:
        return float(values[2]), [float(values[0]), float(values[1])]
    return (float(values[0]) + float(values[1])) / 2, [float(values[0]), float(values[1])]


def derived_optics(rec):
    """Normal reflectance, absorption coefficient, optical permittivity, sRGB preview."""
    opt = rec["optics"]
    n, k = optics.nk(rec)
    if n is None:
        return
    has_k = opt.get("k") is not None
    R = [optics.normal_reflectance(a, b) for a, b in zip(n, k)]
    opt["reflectance_normal"] = field([sig(r, 4) for r in R], "1", "derived:fresnel(n,k) at 0 deg",
                                      opt["n"]["confidence"])
    if has_k:
        opt["absorption_coefficient"] = field([sig(a, 4) for a in optics.absorption_coefficient(k)],
                                              "1/m", "derived:4*pi*k/lambda", opt["k"]["confidence"])
    i590 = GRID.index(590)
    eps = complex(n[i590], k[i590]) ** 2
    rec["electromagnetic"]["optical_permittivity_590nm"] = field(
        [sig(eps.real, 5), sig(eps.imag, 5)], "1 (real, imag)", "derived:(n+ik)^2 at 590 nm",
        opt["n"]["confidence"], note="optical frequency; the static permittivity can differ by orders of magnitude")
    body = optics.body_albedo(rec)
    look = [r + (1 - r) ** 2 * (b if body else 0.0) for r, b in zip(R, body or [0.0] * len(GRID))]
    rgb = spectral.reflectance_to_srgb(look, "D65")
    layer = rec["render"]["layer_m"]
    method = ("normal-incidence Fresnel reflectance" if opt["conductor"] else
              f"Fresnel reflectance plus a {layer:g} m layer over a white ground (Beer-Lambert from k)"
              if has_k else "Fresnel reflectance plus a clear layer over a white ground (k unknown, taken as 0)")
    opt["srgb_preview"] = field([round(c, 4) for c in rgb], "sRGB encoded, D65",
                                "derived:spectral to CIE 1931 XYZ to sRGB", opt["n"]["confidence"],
                                method=method)


def drude_block(rec, molar_mass, valence):
    from materials import drude
    rho = (rec["thermal"].get("density") or {}).get("value")
    sigma = (rec["electromagnetic"].get("electrical_conductivity") or {}).get("value")
    if not rho or not sigma:
        return None
    ne = drude.electron_density(rho, molar_mass, valence)
    out = {"electron_density_per_m3": sig(ne), "plasma_frequency_rad_s": sig(drude.plasma_frequency(ne)),
           "collision_time_s": sig(drude.tau_from_sigma(sigma, ne)), "k_drude": {}, "k_measured": {}}
    n, k = optics.nk(rec)
    for w in (450, 550, 650, 750):
        out["k_drude"][str(w)] = sig(drude.nk(w, sigma, ne)[1], 4)
        out["k_measured"][str(w)] = sig(k[GRID.index(w)], 4) if k else None
    return field(out, "mixed SI", "derived:drude(sigma, density, molar mass, valence)", "moderate",
                 note="free-electron model; interband transitions (gold and copper below about 600 nm) are outside it")


def finite(x):
    return x is not None and not (isinstance(x, float) and (math.isnan(x) or math.isinf(x)))
