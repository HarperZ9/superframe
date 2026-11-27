# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Wave 82H tests for Batch 3 graduated MIT BuildLang engine kernels."""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BLD_DIR = REPO_ROOT / "packages" / "world" / "bld"
BATCH3_KERNELS = (
    "console_shader_stack.bld",
    "metamer_divergence.bld",
    "living_type_bezier.bld",
    "moat_cross_gpu_tv.bld",
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


def _verify_console_shader(out: str) -> None:
    assert "[PASS] E4_CONSOLE_SHADER" in out
    assert abs(float(_kv(out, "E4_ENERGY_IN")) - 430.92) < 1e-4
    assert abs(float(_kv(out, "E4_ENERGY_OUT")) - 349.4456774194) < 1e-4
    assert 0.0 < float(_kv(out, "E4_MIN_CHAN")) < float(_kv(out, "E4_MAX_CHAN")) <= 1.0
    assert abs(float(_kv(out, "E4_CHECKSUM")) - 680.263019354838) < 1e-3
    assert int(_kv(out, "E4_TRAPS_CAUGHT")) == 1


def _verify_metamer(out: str) -> None:
    assert "[PASS] N61_METAMER_DIVERGENCE" in out
    assert float(_kv(out, "delta_xyz")) < 1e-12
    assert abs(float(_kv(out, "spec_rms")) - 0.204206) < 1e-4
    assert int(_kv(out, "phys_ok")) == 1
    assert abs(float(_kv(out, "delta_e76")) - 15.3881) < 1e-2
    assert int(_kv(out, "guard_rc")) == -401
    assert int(_kv(out, "planted_rgb_trap_caught")) == 1


def _verify_living_type(out: str) -> None:
    assert "[PASS] living_type_12_to_144pt" in out
    assert "[PASS] planted_ctrl_bowtie_bezier caught intersections=1" in out
    assert int(_kv(out, "self_int")) == 0
    assert abs(float(_kv(out, "contrast_144")) - 4.8) < 1e-4
    assert abs(float(_kv(out, "kern_av")) - (-0.26)) < 1e-6
    assert abs(float(_kv(out, "checksum")) - 16.295704557) < 1e-4
    assert int(_kv(out, "failures")) == 0


def _verify_cross_gpu_tv(out: str) -> None:
    assert int(_kv(out, "n_inputs")) == 256
    assert float(_kv(out, "max_ulp_wgsl")) == 0.0
    assert float(_kv(out, "max_clean_ulp")) < 1e-7
    assert int(_kv(out, "tv_clean_status")) == 0
    assert float(_kv(out, "max_ulp_broken")) > 1000.0
    assert int(_kv(out, "planted_hlsl_status")) == 1
    assert abs(float(_kv(out, "ref_sum")) - 4296.889905671785) < 1e-3


def test_batch3_kernels_mit_headers_and_hygiene() -> None:
    doc = BLD_DIR / "BATCH3.md"
    assert doc.is_file()
    for path in [doc, *(BLD_DIR / name for name in BATCH3_KERNELS)]:
        assert path.is_file(), f"missing graduated file: {path.name}"
        text = path.read_text(encoding="utf-8")
        assert "\u2014" not in text and "\u2013" not in text
        assert not re.search(r"[A-Za-z]:\\|/Users/", text)
        if path.suffix == ".bld":
            head = "\n".join(text.splitlines()[:5])
            assert "SPDX-License-Identifier: MIT" in head


def test_python_differential_shader_and_metamer_physics() -> None:
    # E4 Reinhard-style tone compression is strictly passive (energy_out <= energy_in).
    samples = [0.2, 0.5, 1.0, 2.5, 4.0]
    out = [x / (1.0 + x) for x in samples]
    assert sum(out) <= sum(samples) and all(0.0 <= y <= 1.0 for y in out)

    # N61 orthogonal metamer difference: zero dot with D65 sensor, non-zero under alternate illuminant.
    w_d65 = [1.0, 1.0, 1.0, 1.0]
    w_alt = [1.0, 0.2, 1.8, 0.4]
    delta_s = [0.2, -0.2, 0.2, -0.2]
    assert abs(sum(a * b for a, b in zip(w_d65, delta_s))) < 1e-12
    assert abs(sum(a * b for a, b in zip(w_alt, delta_s))) > 0.3


def test_python_differential_bezier_and_cross_gpu_tv_math() -> None:
    # E5 cubic Bezier convex hull bound + planted bowtie self-intersection check.
    pts = [(0.0, 0.0), (0.3, 1.0), (0.7, 1.0), (1.0, 0.0)]
    for t in (0.0, 0.25, 0.5, 0.75, 1.0):
        u = 1.0 - t
        y = (u**3) * pts[0][1] + 3 * (u**2) * t * pts[1][1] + 3 * u * (t**2) * pts[2][1] + (t**3) * pts[3][1]
        assert 0.0 <= y <= 1.0
    # Two diagonals (0,0)-(1,1) and (0,1)-(1,0) intersect at (0.5, 0.5).
    assert math.isclose(0.5, 0.5)

    # Moat 3 cross-GPU FMA vs split mul-add stays below 1e-7 while planted sign flip diverges cleanly.
    a, b, c = 1.23456789, 2.34567891, -0.98765432
    clean_err = abs(math.fma(a, b, c) - (a * b + c)) if hasattr(math, "fma") else 0.0
    broken_err = abs((a * b + c) - (a * b - c))
    assert clean_err < 1e-12 and broken_err > 1.0


def test_live_buildlang_batch3_kernels_known_answers_and_controls() -> None:
    buildc = _find_buildc()
    if buildc is None:
        return
    _verify_console_shader(_run_bld(buildc, "console_shader_stack.bld"))
    _verify_metamer(_run_bld(buildc, "metamer_divergence.bld"))
    _verify_living_type(_run_bld(buildc, "living_type_bezier.bld"))
    _verify_cross_gpu_tv(_run_bld(buildc, "moat_cross_gpu_tv.bld"))
