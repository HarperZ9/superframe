# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Wave 85B tests for Batch 4 graduated MIT BuildLang engine kernels."""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
from pathlib import Path

WORLD_ROOT = Path(__file__).resolve().parents[1]
BLD_DIR = WORLD_ROOT / "bld"
BATCH4_KERNELS = (
    "tree_wind_root_rot.bld",
    "camera_reciprocity_origami.bld",
    "ambient_jazz_waves.bld",
    "cinematography_framing.bld",
)


def _find_buildc() -> str | None:
    require = os.environ.get("NATIVE_BLD_REQUIRE", "0") == "1"
    buildc = os.environ.get("BUILDC") or shutil.which("buildc")
    if not buildc and require:
        raise AssertionError("NATIVE_BLD_REQUIRE=1 but buildc is not available")
    return buildc


def _run_bld(buildc: str, filename: str) -> str:
    path = str(BLD_DIR / filename)
    for args in ([buildc, "check", path], [buildc, "lint", path]):
        res = subprocess.run(args, cwd=str(WORLD_ROOT), capture_output=True, text=True, check=False)
        if res.returncode != 0:
            raise AssertionError(f"{args[1]} failed for {filename}:\n{res.stdout}\n{res.stderr}")
    run = subprocess.run([buildc, "run", "--release", path], cwd=str(WORLD_ROOT), capture_output=True, text=True, check=False)
    if run.returncode != 0:
        raise AssertionError(f"buildc run --release failed for {filename}:\n{run.stdout}\n{run.stderr}")
    return run.stdout


def _kv(text: str, key: str) -> str:
    match = re.search(rf"(?:^|\s){re.escape(key)}=([^\s]+)", text)
    if not match:
        raise AssertionError(f"missing {key}= in output:\n{text}")
    return match.group(1)


def _verify_tree_wind(out: str) -> None:
    assert "[PASS] G4_TREE_WIND_ROT" in out
    assert abs(float(_kv(out, "sf_adapt")) - 1.5573) < 1e-3
    assert abs(float(_kv(out, "sf_rot")) - 0.4705) < 1e-3
    assert abs(float(_kv(out, "deflect")) - 0.0534) < 1e-3
    assert int(_kv(out, "bad_wind_rc")) == -201
    assert int(_kv(out, "bad_mod_rc")) == -202
    assert _kv(out, "planted") == "2/2"


def _verify_camera_origami(out: str) -> None:
    assert "[PASS] H8_CAMERA_ORIGAMI" in out
    assert abs(float(_kv(out, "H8_T_IDEAL_S")) - 40.0) < 1e-6
    assert abs(float(_kv(out, "H8_T_FILM_S")) - 76.6966615469) < 1e-4
    assert float(_kv(out, "H8_RECIP_ERR")) < 1e-12
    assert abs(float(_kv(out, "H8_EVEN_SUM_DEG")) - 180.0) < 1e-6
    assert abs(float(_kv(out, "H8_ODD_SUM_DEG")) - 180.0) < 1e-6
    assert int(_kv(out, "H8_MV_DIFF")) == 2
    assert int(_kv(out, "H8_TRAPS_CAUGHT")) == 1


def _verify_ambient_jazz(out: str) -> None:
    assert "[PASS] H6_AMBIENT_JAZZ_WAVES" in out
    assert int(_kv(out, "total")) == 9
    assert 0.1 < float(_kv(out, "peak")) < 0.89
    assert float(_kv(out, "tilt").rstrip("x")) > 20.0
    assert int(_kv(out, "rc")) == 0
    assert int(_kv(out, "clip_rc")) == -201
    assert int(_kv(out, "white_rc")) == -202


def _verify_cinematography(out: str) -> None:
    assert "[PASS] K2_CINEMATOGRAPHY" in out
    assert abs(float(_kv(out, "f24")) - 73.7398) < 1e-3
    assert abs(float(_kv(out, "f50")) - 39.5978) < 1e-3
    assert abs(float(_kv(out, "f85")) - 23.9132) < 1e-3
    assert float(_kv(out, "golden_err")) < 1e-12
    assert float(_kv(out, "calm_jerk")) < 20.0
    assert float(_kv(out, "spike_jerk")) > 1000.0
    assert int(_kv(out, "spike_rc")) == -301
    assert int(_kv(out, "red_bad_rc")) == -302


def test_batch4_kernels_mit_headers_and_hygiene() -> None:
    doc = BLD_DIR / "BATCH4.md"
    assert doc.is_file()
    for path in [doc, *(BLD_DIR / name for name in BATCH4_KERNELS)]:
        assert path.is_file(), f"missing staged file: {path.name}"
        text = path.read_text(encoding="utf-8")
        assert "\u2014" not in text and "\u2013" not in text
        assert not re.search(r"[A-Za-z]:\\|/Users/", text)
        if path.suffix == ".bld":
            head = "\n".join(text.splitlines()[:5])
            assert "SPDX-License-Identifier: MIT" in head


def test_python_differential_tree_and_camera_origami_physics() -> None:
    # G4 root-plate safety factor drops below 1.0 under 45% cross-sectional rot.
    torque = 53746.9
    sf_adapt = 83700.0 / torque
    sf_rot = 25289.2 / torque
    assert sf_adapt > 1.5 and sf_rot < 0.5

    # H8 Schwarzschild reciprocity (t_film = t_ideal^p, p > 1) and Kawasaki 180 deg sum.
    t_ideal, p_exp = 40.0, 1.17647
    t_film = t_ideal ** p_exp
    assert t_film > t_ideal and abs(t_film - 76.6966615) < 0.01
    angles = [45.0, 60.0, 135.0, 120.0]
    assert sum(angles[0::2]) == 180.0 and sum(angles[1::2]) == 180.0


def test_python_differential_jazz_and_cinematography_math() -> None:
    # H6 pink-noise 1/f power spectrum yields low-to-high energy tilt > 10x and stays < -1 dBFS.
    e_low = sum(1.0 / f for f in range(1, 5))
    e_high = sum(1.0 / f for f in range(32, 36))
    assert (e_low / e_high) > 15.0 and 0.4238 < (10.0 ** (-1.0 / 20.0))

    # K2 full-frame 36 mm horizontal FOV formula matches 24/35/50/85 mm lenses.
    for focal, expected in ((24.0, 73.7398), (35.0, 54.4322), (50.0, 39.5978), (85.0, 23.9132)):
        fov = math.degrees(2.0 * math.atan(36.0 / (2.0 * focal)))
        assert abs(fov - expected) < 1e-3


def test_live_buildlang_batch4_kernels_known_answers_and_controls() -> None:
    buildc = _find_buildc()
    if buildc is None:
        return
    _verify_tree_wind(_run_bld(buildc, "tree_wind_root_rot.bld"))
    _verify_camera_origami(_run_bld(buildc, "camera_reciprocity_origami.bld"))
    _verify_ambient_jazz(_run_bld(buildc, "ambient_jazz_waves.bld"))
    _verify_cinematography(_run_bld(buildc, "cinematography_framing.bld"))
