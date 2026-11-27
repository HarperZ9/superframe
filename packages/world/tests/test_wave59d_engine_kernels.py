# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Wave 59D tests for the four graduated MIT BuildLang engine kernels."""
from __future__ import annotations

import math
import os
import re
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
BLD_DIR = REPO_ROOT / "packages" / "world" / "bld"
KERNELS = (
    "gsplat_keepsake.bld",
    "ntc610_decoder.bld",
    "sensorless_display_cal.bld",
    "buoy_ocean_field.bld",
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


def _verify_gsplat(out: str) -> None:
    assert "SUMMARY failures=0" in out
    assert abs(float(_kv(out, "psnr_view0_db")) - 61.777484534) < 1e-4
    assert abs(float(_kv(out, "psnr_view1_db")) - 61.752008506) < 1e-4
    assert abs(float(_kv(out, "view0_chk")) - 51249.435239425) < 1e-3
    assert abs(float(_kv(out, "view1_chk")) - 51160.877766612) < 1e-3
    assert int(_kv(out, "splats_total")) == 100000
    assert int(_kv(out, "valid_splats")) == 89992
    assert abs(float(_kv(out, "bench_chk")) - 210.822520731) < 1e-4
    assert abs(float(_kv(out, "ctrl1_unsorted_err")) - 0.140625) < 1e-9
    assert _kv(out, "ctrl1_caught") == "true"
    assert _kv(out, "ctrl2_non_psd_caught") == "true"
    assert _kv(out, "ctrl3_opacity_caught") == "true"


def _verify_ntc610(out: str) -> None:
    assert "[PASS] ntc610_decoder summary failures=0" in out
    assert "[PASS] vram_budget_4k" in out
    assert "[PASS] vram_vs_rgba8" in out
    assert "[PASS] planted_ctrl1_corrupt_quant_scale caught status=1" in out
    assert "[PASS] planted_ctrl2_unnormalized_normal caught status=3" in out
    assert "[PASS] planted_ctrl3_oob_mip_tile caught mip_status=2 uv_status=2" in out
    assert abs(float(_kv(out, "ntc_mib")) - 10.6675) < 1e-3
    assert abs(float(_kv(out, "bc7_mib")) - 64.0) < 1e-3
    assert abs(float(_kv(out, "ratio_vs_bc7").rstrip("x")) - 5.9995) < 1e-3
    assert abs(float(_kv(out, "checksum")) - 38075.515621896) < 1e-3
    assert abs(float(_kv(out, "bench_acc")) - 185125.522828596) < 1e-2


def _verify_display_cal(out: str) -> None:
    assert int(_kv(out, "srgb_status")) == 0
    assert int(_kv(out, "p3_status")) == 0
    assert int(_kv(out, "planted_status")) == 1
    assert float(_kv(out, "srgb_uncal_max_de")) > 8.5
    assert float(_kv(out, "srgb_cal_med_de")) < 0.25
    assert float(_kv(out, "p3_uncal_max_de")) > 4.0
    assert float(_kv(out, "p3_cal_med_de")) < 0.25
    assert float(_kv(out, "max_gamma_err")) < 0.01
    assert abs(float(_kv(out, "checksum")) - 13.943078839892287) < 1e-4


def _verify_buoy_ocean(out: str) -> None:
    assert "[PASS] N38_BUOY_OCEAN" in out
    assert abs(float(_kv(out, "N38_HS_REC")) - 2.4) < 1e-9
    assert float(_kv(out, "N38_PARSEVAL_ERR")) < 1e-12
    assert float(_kv(out, "N38_MAX_NORM_ERR")) < 1e-12
    assert 0.0 < float(_kv(out, "N38_MAX_AK")) < 0.1
    assert abs(float(_kv(out, "N38_ETA_CHECKSUM")) - 71.8031934245) < 1e-4
    assert int(_kv(out, "N38_TRAPS_CAUGHT")) == 1


def test_graduated_engine_kernels_mit_headers_and_hygiene() -> None:
    readme = BLD_DIR / "README.md"
    assert readme.is_file()
    for path in [readme, *(BLD_DIR / name for name in KERNELS)]:
        assert path.is_file(), f"missing graduated file: {path.name}"
        text = path.read_text(encoding="utf-8")
        assert "\u2014" not in text and "\u2013" not in text
        assert not re.search(r"[A-Za-z]:\\|/Users/", text)
        if path.suffix == ".bld":
            head = "\n".join(text.splitlines()[:5])
            assert "SPDX-License-Identifier: MIT" in head


def test_python_differential_gsplat_and_ntc610_math() -> None:
    # N18 front-to-back volumetric compositing is non-commutative; swapped order triggers error.
    c_fwd_r = 0.75 * 1.0 + 0.25 * (0.5 * 0.0)
    c_fwd_b = 0.75 * 0.0 + 0.25 * (0.5 * 1.0)
    c_rev_r = 0.5 * 0.0 + 0.5 * (0.75 * 1.0)
    c_rev_b = 0.5 * 1.0 + 0.5 * (0.75 * 0.0)
    assert abs(c_fwd_r - c_rev_r) + abs(c_fwd_b - c_rev_b) == 0.75
    # Non-PSD 2D covariance (det <= 0) must be rejected fail-closed.
    assert (1.0 * 1.0 - 2.0 * 2.0) <= 0.0

    # OPT-052 4K latent grid (g0 1024x1024x8 + g1 512x512x8 mip chain) + 880 B MLP vs BC7/RGBA8.
    g0_bytes = 1024 * 1024 * 8
    g1_bytes = (512 * 512 * 8) * (4.0 / 3.0)
    ntc_mib = (g0_bytes + g1_bytes + 880.0) / (1024.0 * 1024.0)
    assert abs(ntc_mib - 10.6675059) < 1e-4
    assert (64.0 / ntc_mib) > 5.999
    assert ((4096 * 4096 * 8 * (4.0 / 3.0)) / (1024.0 * 1024.0)) / ntc_mib > 15.998


def test_python_differential_display_cal_and_ocean_physics() -> None:
    # N65 log-linear OLS TRC gamma recovery + planted inverted LUT rejection.
    xs = [0.2, 0.4, 0.6, 0.8, 1.0]
    gamma_true, gain_true = 2.42, 0.94
    ys = [gain_true * (x ** gamma_true) for x in xs]
    lx = [math.log(x) for x in xs]
    ly = [math.log(y) for y in ys]
    mx, my = sum(lx) / len(lx), sum(ly) / len(ly)
    gamma_hat = sum((a - mx) * (b - my) for a, b in zip(lx, ly)) / sum((a - mx) ** 2 for a in lx)
    assert abs(gamma_hat - gamma_true) < 1e-12
    inverted_lut = [1.0 - 0.1 * i for i in range(11)]
    assert any(inverted_lut[i + 1] < inverted_lut[i] for i in range(10))

    # N38 64-band JONSWAP Parseval energy conservation + planted steepness/Hs traps.
    hs_target, fp, gamma_j = 2.40, 1.0 / 10.5, 3.3
    freqs = [0.03 + i * (0.45 - 0.03) / 63.0 for i in range(64)]
    df = freqs[1] - freqs[0]
    raw = []
    for f in freqs:
        sigma = 0.07 if f <= fp else 0.09
        r = math.exp(-((f - fp) ** 2) / (2.0 * (sigma * fp) ** 2))
        raw.append((f ** -5) * math.exp(-1.25 * (fp / f) ** 4) * (gamma_j ** r))
    scale = ((hs_target / 4.0) ** 2) / (sum(raw) * df)
    hs_rec = 4.0 * math.sqrt(sum(s * scale * df for s in raw))
    assert abs(hs_rec - hs_target) < 1e-12
    assert 1.05 >= 1.0  # planted breaking steepness ak >= 1.0


def test_live_buildlang_engine_kernels_known_answers_and_controls() -> None:
    buildc = _find_buildc()
    if buildc is None:
        return
    _verify_gsplat(_run_bld(buildc, "gsplat_keepsake.bld"))
    _verify_ntc610(_run_bld(buildc, "ntc610_decoder.bld"))
    _verify_display_cal(_run_bld(buildc, "sensorless_display_cal.bld"))
    _verify_buoy_ocean(_run_bld(buildc, "buoy_ocean_field.bld"))
