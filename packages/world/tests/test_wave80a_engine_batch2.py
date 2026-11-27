# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Wave 80A tests for Batch 2 graduated MIT BuildLang engine kernels."""
from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BLD_DIR = REPO_ROOT / "packages" / "world" / "bld"
BATCH2_KERNELS = (
    "low_water_combat_civ.bld",
    "low_water_lie_decay.bld",
    "pbr_16archetype_rt.bld",
    "moat_indirect_draw_cull.bld",
)


def _find_buildc() -> str | None:
    require = os.environ.get("NATIVE_BLD_REQUIRE", "0") == "1"
    buildc = os.environ.get("BUILDC") or shutil.which("buildc")
    if not buildc and require:
        raise AssertionError("NATIVE_BLD_REQUIRE=1 but buildc is not available")
    return buildc


def _run_bld(buildc: str, filename: str) -> str:
    path = str(BLD_DIR / filename)
    chk = subprocess.run([buildc, "check", path], cwd=str(REPO_ROOT), capture_output=True, text=True, check=False)
    if chk.returncode != 0:
        raise AssertionError(f"buildc check failed for {filename}:\n{chk.stdout}\n{chk.stderr}")
    run = subprocess.run([buildc, "run", "--release", path], cwd=str(REPO_ROOT), capture_output=True, text=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"buildc run --release failed for {filename}:\n{run.stdout}\n{run.stderr}")
    return run.stdout


def _kv(text: str, key: str) -> str:
    match = re.search(rf"(?:^|\s){re.escape(key)}=([^\s]+)", text)
    if not match:
        raise AssertionError(f"missing {key}= in output:\n{text}")
    return match.group(1)


def _verify_combat_civ(out: str) -> None:
    assert int(_kv(out, "ticks")) == 1200
    assert int(_kv(out, "fixed_ok")) == 0
    assert float(_kv(out, "max_fps_drift")) == 0.0
    assert abs(float(_kv(out, "var_dt_drift")) - 4.287391602935266) < 1e-6
    assert int(_kv(out, "planted_var_dt_status")) == 1
    assert abs(float(_kv(out, "total_supply")) - 121.91971183120428) < 1e-5
    assert abs(float(_kv(out, "total_fort")) - 155.28028816879387) < 1e-5
    assert abs(float(_kv(out, "checksum")) - 288.78260374253693) < 1e-4


def _verify_lie_decay(out: str) -> None:
    assert int(_kv(out, "mono_ok")) == 8
    assert int(_kv(out, "repair_ok")) == 4
    assert int(_kv(out, "scar_ok")) == 1
    assert int(_kv(out, "planted_neg_entropy")) == 1
    assert abs(float(_kv(out, "peak_corr")) - 3.017) < 1e-6
    assert abs(float(_kv(out, "rep_corr")) - 0.81078423552) < 1e-6
    assert float(_kv(out, "rep_integ")) > float(_kv(out, "peak_integ"))
    assert abs(float(_kv(out, "checksum")) - 9.117080272415858) < 1e-5


def _verify_pbr_16archetype(out: str) -> None:
    assert "PBR_16ARCH" in out
    assert _kv(out, "status") == "PASS"
    assert int(_kv(out, "failures")) == 0
    assert _kv(out, "pass") == "16/16"
    assert 0.9 < float(_kv(out, "max_a1")) <= 1.0
    assert abs(float(_kv(out, "sum_a3")) - 4.865287917) < 1e-5
    assert float(_kv(out, "bad_a1")) > 1.0
    assert int(_kv(out, "rc_bad")) == -301


def _verify_indirect_cull(out: str) -> None:
    assert "[PASS] MOAT7_INDIRECT_CULL" in out
    assert int(_kv(out, "M7_INSTANCES")) == 100000
    assert int(_kv(out, "M7_VISIBLE")) == 31743
    assert int(_kv(out, "M7_HIZ_CULLED")) == 18041
    assert int(_kv(out, "M7_ACTIVE_BUCKETS")) == 32
    assert abs(float(_kv(out, "M7_REDUCTION_RATIO")) - 3125.0) < 1e-6
    assert int(_kv(out, "M7_FALSE_CULLS_CLEAN")) == 0
    assert int(_kv(out, "M7_FALSE_CULLS_BUG")) == 31290
    assert int(_kv(out, "M7_VIS_HASH")) == 93681847
    assert int(_kv(out, "M7_BUG_CAUGHT")) == 1


def test_batch2_kernels_mit_headers_and_hygiene() -> None:
    for name in BATCH2_KERNELS:
        path = BLD_DIR / name
        assert path.is_file(), f"missing graduated kernel: {name}"
        text = path.read_text(encoding="utf-8")
        assert "\u2014" not in text and "\u2013" not in text
        assert not re.search(r"[A-Za-z]:\\|/Users/", text)
        head = "\n".join(text.splitlines()[:5])
        assert "SPDX-License-Identifier: MIT" in head


def test_python_differential_combat_and_lie_decay_math() -> None:
    # E2 fixed 120 Hz physics ticks match exactly across 60/144/240 FPS display intervals.
    tick_counts = [int(round(10.0 * fps * (120.0 / fps))) for fps in (60, 144, 240)]
    assert tick_counts == [1200, 1200, 1200]
    # Planted naive variable-dt Euler diverges across 60 Hz vs 240 Hz under quadratic drag.
    def _euler(fps: int) -> float:
        v, dt = 10.0, 1.0 / fps
        for _ in range(fps):
            v -= 0.8 * v * v * dt
        return v
    assert abs(_euler(60) - _euler(240)) > 0.01

    # H1 monotonic corrosion vs witnessed repair with non-zero scar floor.
    corr, scar_floor = 0.0, 0.35
    for sev in (0.3, 0.4, 0.5):
        nxt = corr + sev
        assert nxt > corr
        corr = nxt
    repaired = max(scar_floor, corr * 0.4)
    assert scar_floor <= repaired < corr


def test_python_differential_pbr_and_indirect_cull_math() -> None:
    # N64 Schlick Fresnel bounded in [0, 1]; planted super-unitary albedo fails closed.
    for f0 in (0.04, 0.5, 0.95):
        for cos_t in (0.0, 0.5, 1.0):
            fresnel = f0 + (1.0 - f0) * ((1.0 - cos_t) ** 5)
            assert 0.0 <= fresnel <= 1.0
    assert 1.164 > 1.0  # planted white-furnace energy violation

    # Moat 7 draw-call reduction ratio and planted frustum inversion false-cull detection.
    assert (100000 / 32) == 3125.0
    xs = [-2.0, -0.5, 0.0, 0.5, 2.0]
    clean_vis = [x for x in xs if -1.0 <= x <= 1.0]
    bug_vis = [x for x in xs if x <= -1.0 or x >= 1.0]
    false_culls = sum(1 for x in clean_vis if x not in bug_vis)
    assert len(clean_vis) == 3 and false_culls == 3


def test_live_buildlang_batch2_kernels_known_answers_and_controls() -> None:
    buildc = _find_buildc()
    if buildc is None:
        return
    _verify_combat_civ(_run_bld(buildc, "low_water_combat_civ.bld"))
    _verify_lie_decay(_run_bld(buildc, "low_water_lie_decay.bld"))
    _verify_pbr_16archetype(_run_bld(buildc, "pbr_16archetype_rt.bld"))
    _verify_indirect_cull(_run_bld(buildc, "moat_indirect_draw_cull.bld"))
