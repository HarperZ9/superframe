# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""physics.beverloo_rate/1: the reference, the known answers, the properties and the planted-bad controls.

W = C rho_b sqrt(g) (D - k d)^(5/2), the mass flow of dry grains through a circular orifice at the base of a
silo or hopper (Beverloo, Leniger and van de Velde 1961, as eq. 1 of Mankoc et al. 2007).
"""
import math

from ..core import Refusal, finite, positive, refused

D_MIN_GRAIN = 0.5e-3   # m. Below this the interstitial air adds a pressure term the law leaves out.

SPEC = {
    "id": "physics.beverloo_rate/1",
    "row": "PHY-006",
    "export": "fk_physics_beverloo_rate",
    "formula": "W = C rho_b sqrt(g) (D - k d)^(5/2), formed as ((C rho_b) sqrt(g)) ((e e) sqrt(e)), e = D - k d",
    "inputs": [("orifice_diameter", "m", "finite and > k d"),
               ("grain_diameter", "m", "finite and >= 0.0005"),
               ("bulk_density", "kg/m^3", "finite and > 0"),
               ("gravity", "m/s^2", "finite and > 0"),
               ("discharge_coefficient", "1", "finite, 0 < C <= 1"),
               ("shape_coefficient", "1", "finite, 0 <= k <= 4")],
    "outputs": [("mass_rate", "kg/s")],
    "loss": "Flow does not depend on fill height (true once the fill exceeds about 1.2 silo diameters, by the "
            "Janssen effect) or on silo diameter (when it exceeds 2.5 D and D + 30 d). C and k are fitted per "
            "material and must come with their source; the kernel has no default for either. Mono-sized dry "
            "grains above 0.5 mm. Near the jamming size (D a few grain diameters) flow is intermittent; over "
            "D / d from 2 to 100 the law misfits by up to about 10 percent (Mankoc et al. 2007, sec. III A). "
            "A slit outlet follows a 3/2 power instead and is a different kernel.",
    "mode": "bit-identical",
    "known_answers": [
        "Mankoc et al. 2007 fit, Wb = 50.5 (R - 1.16)^(5/2) beads per second with R = D / d: R 10 gives "
        "11733.35 per second when C rho_b sqrt(g) d^(5/2) / m_bead is set to 50.5",
        "C 0.58, rho_b 1500 kg/m^3, g 9.80665, D 20 mm, d 2 mm, k 1.5 gives 0.1026601 kg/s (computed from "
        "eq. 1 with C inside the range 0.55 to 0.65 that the source attributes to Beverloo et al.)"],
    "properties": ["doubling D - k d multiplies W by 2^(5/2) = 5.656854",
                   "W is linear in C, in rho_b and in sqrt(g)",
                   "units close: kg/m^3 * (m/s^2)^(1/2) * m^(5/2) = kg/s"],
    "controls": ["exponent 2 in place of 5/2", "the grain term k d dropped",
                 "zero returned where D <= k d instead of a refusal"],
    "provenance": {
        "source": "Mankoc, Janda, Arevalo, Pastor, Zuriguel, Garcimartin, Maza, 'The flow rate of granular "
                  "materials through an orifice', arXiv:0707.4550 (Granular Matter 9, 407, 2007), read "
                  "2026-11-15: eq. 1, C range 0.55 to 0.65 and k range 1 to 2 (sand 2.9) from the "
                  "introduction, fill-height and silo-diameter conditions, the fit 50.5 (R - 1.16)^(5/2) in "
                  "sec. III A. Beverloo, Leniger and van de Velde, Chem. Eng. Sci. 15, 260 (1961): unread "
                  "(Elsevier, subscriber only).",
        "body_from": "no implementation existed (registry row PHY-006 was DISCUSSED only: H36 in the "
                     "wavefunction-lens queue)",
        "checked_by": "formula-kernels worker 3, 2026-11-15",
    },
}

ORDER = ["orifice_diameter", "grain_diameter", "bulk_density", "gravity", "discharge_coefficient",
         "shape_coefficient"]


def reference(orifice_diameter, grain_diameter, bulk_density, gravity, discharge_coefficient,
              shape_coefficient):
    D, d, rho, g, C, k = (orifice_diameter, grain_diameter, bulk_density, gravity, discharge_coefficient,
                          shape_coefficient)
    if not finite(D):
        return Refusal("orifice_diameter", D, "finite and > k d")
    if not finite(d) or d < D_MIN_GRAIN:
        return Refusal("grain_diameter", d, "finite and >= 0.0005")
    if not positive(rho):
        return Refusal("bulk_density", rho, "finite and > 0")
    if not positive(g):
        return Refusal("gravity", g, "finite and > 0")
    if not positive(C) or C > 1.0:
        return Refusal("discharge_coefficient", C, "finite, 0 < C <= 1")
    if not finite(k) or k < 0.0 or k > 4.0:
        return Refusal("shape_coefficient", k, "finite, 0 <= k <= 4")
    e = float(D) - float(k) * float(d)
    if not e > 0.0:
        return Refusal("orifice_diameter", D, "finite and > k d")
    return (((float(C) * float(rho)) * math.sqrt(float(g))) * ((e * e) * math.sqrt(e)),)


BASE = {"orifice_diameter": 0.02, "grain_diameter": 0.002, "bulk_density": 1500.0, "gravity": 9.80665,
        "discharge_coefficient": 0.58, "shape_coefficient": 1.5}


def _grid():
    bad = (float("nan"), float("inf"), -1.0, 0.0)
    rows = [dict(BASE)]
    for name, goods in (("orifice_diameter", (0.003, 0.0031, 0.1, 2.0)),
                        ("grain_diameter", (0.0005, 0.001, 0.004, 0.0004)),
                        ("bulk_density", (600.0, 7000.0)), ("gravity", (1.62, 24.79)),
                        ("discharge_coefficient", (0.55, 0.65, 1.0, 1.0000001)),
                        ("shape_coefficient", (0.0, 1.0, 2.9, 4.0, 4.0000001))):
        for v in goods + bad:
            rows.append(dict(BASE, **{name: v}))
    return rows


GRID = _grid()


def checks(fn):
    """(name, passed) for every known answer, property and refusal, on any implementation."""
    def w(**kw):
        return fn(**dict(BASE, **kw))
    base = w()
    yield "known answer: 0.1026601 kg/s at C 0.58, D 20 mm, d 2 mm, k 1.5", abs(base[0] - 0.10266014985020208) < 1e-12
    # Mankoc et al. fit, in beads per second: choose C so that C rho_b sqrt(g) d^(5/2) / m_bead = 50.5.
    d, rho, g, m_bead = 1e-3, 1500.0, 9.80665, 1.3e-6
    c = 50.5 * m_bead / (rho * math.sqrt(g) * d ** 2.5)
    wb = fn(10 * d, d, rho, g, c, 1.16)[0] / m_bead
    yield "known answer: Mankoc fit 50.5 (R - 1.16)^(5/2) at R 10 is 11733.35 per second", abs(wb / 11733.350405194575 - 1) < 1e-12
    e = BASE["orifice_diameter"] - 1.5 * BASE["grain_diameter"]
    doubled = w(orifice_diameter=2 * e + 1.5 * BASE["grain_diameter"])
    yield "property: doubling D - k d multiplies W by 2^(5/2)", abs(doubled[0] / base[0] / 2 ** 2.5 - 1) < 1e-12
    yield "property: linear in C", abs(w(discharge_coefficient=0.29)[0] * 2 / base[0] - 1) < 1e-15
    yield "property: linear in bulk density", abs(w(bulk_density=4500.0)[0] / 3 / base[0] - 1) < 1e-15
    yield "property: W scales with sqrt(g)", abs(w(gravity=4 * 9.80665)[0] / 2 / base[0] - 1) < 1e-15
    for name, kw in (("orifice_diameter", {"orifice_diameter": 0.003}),        # D = k d exactly: no flow
                     ("orifice_diameter", {"orifice_diameter": 0.001}),
                     ("orifice_diameter", {"orifice_diameter": float("nan")}),
                     ("grain_diameter", {"grain_diameter": 0.0001}),
                     ("bulk_density", {"bulk_density": 0.0}),
                     ("gravity", {"gravity": -9.8}),
                     ("discharge_coefficient", {"discharge_coefficient": None}),
                     ("discharge_coefficient", {"discharge_coefficient": 1.5}),
                     ("shape_coefficient", {"shape_coefficient": None}),
                     ("shape_coefficient", {"shape_coefficient": -0.1})):
        got = w(**kw)
        yield f"refusal: {kw!r} names {name}", refused(got) and got.input == name


def _exponent_two(**kw):
    r = reference(**kw)
    if refused(r):
        return r
    e = kw["orifice_diameter"] - kw["shape_coefficient"] * kw["grain_diameter"]
    return (r[0] / math.sqrt(e),)


def _no_grain_term(**kw):
    return reference(**dict(kw, shape_coefficient=0.0)) if finite(kw.get("shape_coefficient")) \
        else reference(**kw)


def _zero_for_no_flow(**kw):
    r = reference(**kw)
    if refused(r) and r.input == "orifice_diameter" and finite(kw["orifice_diameter"]):
        return (0.0,)
    return r


def _positional(fn):
    def wrapped(*args, **kw):
        return fn(**dict(zip(ORDER, args), **kw))
    return wrapped


PLANTED = {"exponent 2 in place of 5/2": _positional(_exponent_two),
           "the grain term k d dropped": _positional(_no_grain_term),
           "zero returned where D <= k d instead of a refusal": _positional(_zero_for_no_flow)}
