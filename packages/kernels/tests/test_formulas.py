# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Formula kernels: every check on the reference, every planted-bad control caught, the BuildLang body equal
to the reference, and the kernels.json section in step with the specs.

The compiled bodies need buildc and a C compiler. Without them those tests skip with the reason; with
FORMULAS_REQUIRE_NATIVE set they fail instead (CI sets it).
"""
import json
import math
import os
import sys
from fractions import Fraction
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

import formulas  # noqa: E402
from formulas import check, native  # noqa: E402
from formulas.core import Refusal, refused, same  # noqa: E402

MODS = formulas.modules()
IDS = [m.SPEC["id"] for m in MODS]


def _native_or_skip(mod):
    if mod.SPEC.get("bld_pending"):
        pytest.skip(f"BuildLang body pending: {mod.SPEC['bld_pending']}")
    why = native.unavailable()
    if why and os.environ.get("FORMULAS_REQUIRE_NATIVE"):
        pytest.fail(why)
    if why:
        pytest.skip(why)
    return native.function(mod)


@pytest.mark.parametrize("mod", MODS, ids=IDS)
def test_reference_passes_every_check(mod):
    rows = check.run_checks(mod, mod.reference)
    assert len(rows) >= 3, "a kernel needs a known answer, a property and a refusal at least"
    assert [n for n, ok in rows if not ok] == []
    names = " ".join(n for n, _ in rows)
    assert "known answer" in names and "property" in names and "refusal" in names


@pytest.mark.parametrize("mod", MODS, ids=IDS)
def test_every_planted_control_is_caught(mod):
    assert mod.PLANTED, "a kernel needs at least one planted-bad control"
    for name, planted in mod.PLANTED.items():
        assert [n for n, ok in check.run_checks(mod, planted) if not ok], f"control passed: {name}"


@pytest.mark.parametrize("mod", MODS, ids=IDS)
def test_spec_states_units_range_loss_and_provenance(mod):
    s = mod.SPEC
    assert all(len(i) == 3 and i[1] and i[2] for i in s["inputs"])
    assert all(len(o) == 2 and o[1] for o in s["outputs"])
    assert s["loss"] and s["known_answers"] and s["properties"] and s["controls"]
    assert {"source", "body_from", "checked_by"} <= set(s["provenance"])
    assert s["mode"] in ("bit-identical",) or s["mode"].startswith("tolerance")


@pytest.mark.parametrize("mod", MODS, ids=IDS)
def test_buildlang_body_equals_the_reference(mod):
    fn = _native_or_skip(mod)
    assert [n for n, ok in check.run_checks(mod, fn) if not ok] == []
    differ = [g for g in mod.GRID if not same(mod.reference(**g), fn(**g))]
    assert differ == [], f"{len(differ)} of {len(mod.GRID)} grid points differ, first {differ[:1]}"


def _is_nearest_cube_root(y, t):
    """True when the double y is the double nearest the cube root of t, checked with exact fractions."""
    if y <= 0.0:
        return False
    lo = Fraction(y) - Fraction(y - math.nextafter(y, 0.0)) / 2
    hi = Fraction(y) + Fraction(math.nextafter(y, math.inf) - y) / 2
    return lo ** 3 <= Fraction(t) <= hi ** 3


def test_cielab_cube_root_is_exact_on_a_table_and_nearest_on_a_sweep():
    from formulas.colour_xyz_to_cielab import reference as lab
    table = {8.0: 2.0, 27.0: 3.0, 1000.0: 10.0, 0.125: 0.5, 3.375: 1.5, 2.0 ** -30: 2.0 ** -10,
             (2.0 ** 17 - 1) ** 3 * 2.0 ** 30: (2.0 ** 17 - 1) * 2.0 ** 10, 2.0: 1.2599210498948732,
             1.0: 1.0, -8.0: -2.0, 0.0: 0.0}
    assert {t: lab.cbrt(t) for t in table} == table
    ts = lab.SWEEP + [math.ldexp(1.0 + i / 997.0, e) for i in range(0, 997, 7) for e in (-1070, -7, 0, 1, 9, 1000)]
    assert [t for t in ts if not _is_nearest_cube_root(lab.cbrt(t), t)] == []
    # The control for the check itself: the old Newton cube root is not the nearest double everywhere.
    assert sum(not _is_nearest_cube_root(lab.newton_cbrt(t), t) for t in lab.SWEEP) > 0


def test_cielab_old_newton_cube_root_differs_from_the_kernel_on_the_grid():
    from formulas.colour_xyz_to_cielab import reference as lab
    mod = next(m for m in MODS if m.SPEC["id"] == "colour.xyz_to_cielab/1")
    fn = _native_or_skip(mod)
    newton = lab.PLANTED["the 64-step Newton cube root used until 2026-11-16 (1 ulp off at many points)"]
    differ = [g for g in mod.GRID if not same(fn(**g), newton(**g))]
    assert len(differ) >= 2, "the Newton cube root gives the kernel's bytes on the whole grid"
    sweep = [t for t in lab.SWEEP if not same(fn(1.0, t, 1.0, 1.0, 1.0, 1.0), newton(1.0, t, 1.0, 1.0, 1.0, 1.0))]
    assert len(sweep) >= 50


def test_call_refuses_a_wrong_unit_a_missing_input_and_an_extra_one():
    r = formulas.call("optics.airy_radius/1", wavelength=(550.0, "nm"), f_number=(2.0, "1"))
    assert refused(r) and r.input == "wavelength"
    r = formulas.call("optics.f_number/1", focal_length=(0.05, "m"))
    assert refused(r) and r.input == "aperture_diameter"
    r = formulas.call("optics.f_number/1", focal_length=(0.05, "m"), aperture_diameter=(0.025, "m"), k=(1, "1"))
    assert isinstance(r, Refusal) and r.input == "k"
    assert formulas.call("optics.f_number/1", focal_length=(0.05, "m"),
                         aperture_diameter=(0.025, "m")) == {"f_number": (2.0, "1")}


def test_kernels_json_formulas_section_matches_the_specs():
    reg = json.loads((ROOT / "kernels.json").read_text(encoding="utf-8"))
    stored = {e["id"]: {k: v for k, v in e.items() if k != "check"} for e in reg.get("formulas", [])}
    fresh = {e["id"]: json.loads(json.dumps(e)) for e in check.registry_entries()}
    assert stored == fresh, "run `python -B kernels.py formulas` in packages/kernels and commit kernels.json"
    assert all(e.get("check", {}).get("pass") for e in reg["formulas"]), "a stored check result is not a pass"


def test_call_carries_arrays_in_and_out():
    r = formulas.call("stats.benjamini_hochberg/1", p_values=([0.01, 0.04, 0.03], "probability"),
                      q=(0.05, "probability"))
    assert r["reject"] == ((1.0, 1.0, 1.0), "1")
    assert r["adjusted"][0] == (0.03, 0.04, 0.04)
    r = formulas.call("stats.auroc/1", positive=([0.35, 0.8], "1"), negative=([0.1, 0.4], "1"))
    assert r == {"auc": (0.75, "probability")}


def test_radiocarbon_curve_is_refused_when_its_hash_differs(tmp_path, monkeypatch):
    from formulas.chron_radiocarbon_calibrate import curves
    (tmp_path / "intcal20.14c").write_text("# not the curve\n0,199,11,-24.5,1.4\n", encoding="latin-1")
    monkeypatch.setenv("RADIOCARBON_CURVES", str(tmp_path))
    monkeypatch.setattr(curves, "_LOADED", {})
    with pytest.raises(curves.CurveError, match="SHA-256"):
        curves.load("intcal20")
    with pytest.raises(curves.CurveError, match="unknown curve id"):
        curves.load("intcal99")


def test_radiocarbon_call_refuses_a_calendar_unit_for_a_14c_age():
    from formulas.chron_radiocarbon_calibrate.reference import _straight, _years
    cal, mu, sg = _straight()
    q = dict(error=(30.0, "yr_14C"), grid=(_years(1500.0, 500.0), "yr_cal"), curve_cal_bp=(cal, "yr_cal"),
             curve_age=(mu, "yr_14C"), curve_error=(sg, "yr_14C"), level_inner=(0.683, "1"),
             level_outer=(0.954, "1"))
    r = formulas.call("chron.radiocarbon_calibrate/1", age=(1000.0, "yr_cal"), **q)
    assert refused(r) and r.input == "age"
    r = formulas.call("chron.radiocarbon_calibrate/1", age=(1000.0, "yr_14C"), **q)
    assert abs(sum(r["density"][0]) - 1.0) < 1e-12 and r["density"][1] == "1/yr_cal"
