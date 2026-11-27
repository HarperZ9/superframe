# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Formula kernels: small scalar formulas held to one contract. See README.md in this folder.

    from formulas import call
    call("optics.airy_radius/1", wavelength=(550e-9, "m"), f_number=(2.0, "1"))
    -> {"radius": (1.3416368803931549e-06, "m")}

Each kernel lives in a folder named after its id, with the BuildLang body (kernel.bld) and the slow
reference with its checks (reference.py).
"""
import importlib
from pathlib import Path

from . import core
from .core import Refusal, refused  # noqa: F401

PKG = Path(__file__).resolve().parent
FOLDERS = ["optics_f_number", "optics_airy_radius", "physics_beverloo_rate", "colour_srgb_transfer",
           "colour_xyz_to_cielab", "stats_wilson_interval", "stats_benjamini_hochberg", "stats_spearman",
           "stats_auroc", "chron_radiocarbon_calibrate"]


def modules():
    """Every kernel's reference module, in registry order."""
    return [importlib.import_module(f"{__name__}.{folder}.reference") for folder in FOLDERS]


def by_id():
    return {m.SPEC["id"]: m for m in modules()}


def call(kernel_id, **quantities):
    """Evaluate a kernel by id with (value, unit) pairs. Uses the compiled BuildLang body when it can be
    built here, else the reference; the two are held bit-identical by the check."""
    from . import native
    mod = by_id()[kernel_id]
    fn = mod.reference if native.unavailable() else native.function(mod)
    return core.call(mod.SPEC, fn, quantities)
