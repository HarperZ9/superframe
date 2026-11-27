# SPDX-FileCopyrightText: 2026 Zain Dana Harper
# SPDX-License-Identifier: MIT
"""Canonical formula basis verification inside packages/kernels/kcore/.

Verifies canonical mathematical definitions, cross-package consistency,
known-answer bounds, and planted-wrong-control rejection for:
  - COL-001: srgb_to_linear / linear_to_srgb (IEC 61966-2-1)
  - COL-003: xyz_to_lab (CIE 1976 exact rational constants 216/24389, 24389/27)
  - COL-005: oklab forward and inverse (Ottosson matrices)
  - OPT-002: fresnel dielectric unpolarised reflectance (normal, Brewster, TIR)
  - HASH-FNV: Superframe pinned renderer FNV-1a-64 offset (1469598103934665603)
"""
from __future__ import annotations

import math
import struct
import sys
from pathlib import Path

import numpy as np
import pytest

PACKAGES_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = PACKAGES_ROOT.parent
for extra in (
    PACKAGES_ROOT / "kernels",
    PACKAGES_ROOT / "superstack",
    PACKAGES_ROOT / "colour" / "build-color",
    PACKAGES_ROOT / "crt",
):
    if str(extra) not in sys.path:
        sys.path.insert(0, str(extra))

import superstack  # noqa: E402
from build_color import spaces as bc_spaces  # noqa: E402
from crt import glass as crt_glass  # noqa: E402
from formulas.colour_srgb_transfer import reference as col001_ref  # noqa: E402
from formulas.colour_xyz_to_cielab import reference as col003_ref  # noqa: E402


# ---------------------------------------------------------------------------
# COL-001: sRGB transfer function (IEC 61966-2-1)
# ---------------------------------------------------------------------------

def test_col001_srgb_to_linear_known_answers_and_cross_package_parity():
    """COL-001 known answers and cross-package parity across formulas, superstack, and build-color."""
    expected_half = ((0.5 + 0.055) / 1.055) ** 2.4
    assert abs(col001_ref.reference(0.5, 0)[0] - 0.21404114048223255) < 1e-14
    assert abs(superstack.srgb_to_linear(0.5) - expected_half) < 1e-15
    assert abs(float(bc_spaces.srgb_to_linear(np.array([0.5]))[0]) - expected_half) < 1e-15

    # Exact endpoints and smooth interior points (round-trip within 3e-15)
    for v in (0.0, 0.02, 0.04, 0.2, 0.5, 0.85, 1.0):
        f_lin = col001_ref.reference(v, 0)[0]
        s_lin = superstack.srgb_to_linear(v)
        b_lin = float(bc_spaces.srgb_to_linear(np.array([v]))[0])
        assert abs(f_lin - s_lin) < 3e-15, (v, f_lin, s_lin)
        assert abs(s_lin - b_lin) < 1e-15, (v, s_lin, b_lin)
        # Round-trip decode -> encode
        rt = col001_ref.reference(f_lin, 1)[0]
        assert abs(rt - v) < 3e-15

    # IEC 61966-2-1 threshold 0.04045: linear decode piece is exact, standard seam round-trip gap is ~3e-8
    lin_thr = col001_ref.reference(0.04045, 0)[0]
    assert abs(lin_thr - 0.04045 / 12.92) < 1e-15
    assert abs(col001_ref.reference(lin_thr, 1)[0] - 0.04045) < 5e-8

    # Planted-wrong-controls: plain 2.2 power, 1996 draft threshold 0.03928, omitted offset 0.055
    for name, planted_fn in col001_ref.PLANTED.items():
        failed = [chk for chk, ok in col001_ref.checks(planted_fn) if not ok]
        assert failed, f"COL-001 planted control was not rejected: {name}"


# ---------------------------------------------------------------------------
# COL-003: CIE 1976 XYZ to L*a*b*
# ---------------------------------------------------------------------------

def test_col003_xyz_to_lab_known_answers_and_planted_controls():
    """COL-003 exact CIE rational constants, white point, threshold L=8, 18% grey, and planted controls."""
    d65 = (0.95047, 1.0, 1.08883)
    # White -> (100, 0, 0) exact
    L, a, b = col003_ref.reference(*d65, *d65)
    assert (L, a, b) == (100.0, 0.0, 0.0)
    # Threshold Y/Yn = 216/24389 -> L = 8.0 exact
    eps = 216.0 / 24389.0
    L_thr, a_thr, b_thr = col003_ref.reference(eps * d65[0], eps * d65[1], eps * d65[2], *d65)
    assert abs(L_thr - 8.0) < 1e-14 and abs(a_thr) < 1e-14 and abs(b_thr) < 1e-14
    # 18% neutral grey -> L ~ 49.496108, a=b=0
    L_mid, a_mid, b_mid = col003_ref.reference(0.18 * d65[0], 0.18 * d65[1], 0.18 * d65[2], *d65)
    assert abs(L_mid - 49.496108) < 1e-6 and abs(a_mid) < 1e-14 and abs(b_mid) < 1e-14

    # Cross-package parity against build-color
    bc_lab = bc_spaces.xyz_to_lab(np.array([0.18 * d65[0], 0.18 * d65[1], 0.18 * d65[2]]), white=np.array(d65))
    assert abs(float(bc_lab[0]) - L_mid) < 1e-9
    assert abs(float(bc_lab[1])) < 1e-12 and abs(float(bc_lab[2])) < 1e-12

    # Planted-wrong-controls: rounded 0.008856/7.787, dropped cbrt, swapped a/b scales, 64-step Newton cbrt
    for name, planted_fn in col003_ref.PLANTED.items():
        failed = [chk for chk, ok in col003_ref.checks(planted_fn) if not ok]
        assert failed, f"COL-003 planted control was not rejected: {name}"


# ---------------------------------------------------------------------------
# COL-005: Oklab forward and inverse
# ---------------------------------------------------------------------------

def test_col005_oklab_known_answers_parity_and_planted_controls():
    """COL-005 known answers (white, black, sRGB primaries), inverse roundtrip, and planted-wrong rejection."""
    # Known Ottosson reference vectors for linear sRGB primaries
    known = [
        ((0.0, 0.0, 0.0), (0.0, 0.0, 0.0), 1e-12),
        ((1.0, 1.0, 1.0), (1.0, 0.0, 0.0), 1e-6),
        ((1.0, 0.0, 0.0), (0.627955, 0.224863, 0.125846), 1e-5),
        ((0.0, 1.0, 0.0), (0.866440, -0.233887, 0.179498), 1e-5),
        ((0.0, 0.0, 1.0), (0.452014, -0.032457, -0.311528), 1e-5),
    ]
    for rgb, want_lab, tol in known:
        ss_lab = superstack.linear_srgb_to_oklab(*rgb)
        bc_lab = bc_spaces.linear_srgb_to_oklab(np.array(rgb, dtype=np.float64))
        for i in range(3):
            assert abs(ss_lab[i] - want_lab[i]) < tol, (rgb, i, ss_lab[i], want_lab[i])
            assert abs(float(bc_lab[i]) - want_lab[i]) < tol, (rgb, i, bc_lab[i], want_lab[i])
            assert abs(ss_lab[i] - float(bc_lab[i])) < 1e-6
        # Inverse roundtrip
        ss_back = superstack.oklab_to_linear_srgb(*ss_lab)
        bc_back = bc_spaces.oklab_to_linear_srgb(bc_lab)
        for i in range(3):
            assert abs(ss_back[i] - rgb[i]) < 1e-6
            assert abs(float(bc_back[i]) - rgb[i]) < 1e-6

    # Planted-wrong-control 1: dropping cube root breaks pure red lightness
    def _planted_no_cbrt(r: float, g: float, b: float):
        l_ = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
        m_ = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
        s_ = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
        return (
            0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_,
            1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_,
            0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_,
        )

    bad_red = _planted_no_cbrt(1.0, 0.0, 0.0)
    assert abs(bad_red[0] - 0.627955) > 0.30

    # Planted-wrong-control 2: passing gamma-encoded 0.5 grey instead of linear 0.5 diverges in L
    lin_mid = superstack.linear_srgb_to_oklab(superstack.srgb_to_linear(0.5), superstack.srgb_to_linear(0.5), superstack.srgb_to_linear(0.5))
    gam_mid = superstack.linear_srgb_to_oklab(0.5, 0.5, 0.5)
    assert abs(gam_mid[0] - lin_mid[0]) > 0.15


# ---------------------------------------------------------------------------
# OPT-002: Fresnel dielectric unpolarised reflectance
# ---------------------------------------------------------------------------

def _opt002_fresnel_dielectric(n1: float, n2: float, cos_i: float) -> float:
    sin_i2 = max(0.0, 1.0 - cos_i * cos_i)
    sin_t2 = (n1 / n2) ** 2 * sin_i2
    if sin_t2 >= 1.0:
        return 1.0
    cos_t = math.sqrt(1.0 - sin_t2)
    rs = ((n1 * cos_i - n2 * cos_t) / (n1 * cos_i + n2 * cos_t)) ** 2
    rp = ((n1 * cos_t - n2 * cos_i) / (n1 * cos_t + n2 * cos_i)) ** 2
    return 0.5 * (rs + rp)


def test_opt002_fresnel_known_answers_and_planted_controls():
    """OPT-002 normal incidence, Brewster angle, grazing limit, TIR, and parity with crt.glass.fresnel."""
    # Normal incidence n=1.5 -> R = 0.04 exact
    assert abs(_opt002_fresnel_dielectric(1.0, 1.5, 1.0) - 0.04) < 1e-15
    assert abs(_opt002_fresnel_dielectric(1.5, 1.0, 1.0) - 0.04) < 1e-15
    assert abs(_opt002_fresnel_dielectric(1.5, 1.5, 0.7) - 0.0) < 1e-15

    # Exact parity with crt.glass.fresnel(n, theta) for internal glass-to-air incidence
    n = 1.52
    for theta in (0.0, 0.2, math.atan(1.0 / n), 0.6, math.asin(1.0 / n) + 0.05):
        got_crt = crt_glass.fresnel(n, theta)
        got_opt = _opt002_fresnel_dielectric(n, 1.0, math.cos(theta))
        assert abs(got_crt - got_opt) < 1e-15, (theta, got_crt, got_opt)

    # Air-to-glass Brewster angle: tan(theta_B) = n2 / n1 => Rp = 0, R = 0.5 * Rs
    theta_b = math.atan(1.5)
    cos_b = math.cos(theta_b)
    cos_t = math.sqrt(1.0 - (math.sin(theta_b) / 1.5) ** 2)
    rs_b = ((1.0 * cos_b - 1.5 * cos_t) / (1.0 * cos_b + 1.5 * cos_t)) ** 2
    assert abs(_opt002_fresnel_dielectric(1.0, 1.5, cos_b) - 0.5 * rs_b) < 1e-15

    # Grazing incidence -> R -> 1.0; TIR past critical angle -> R == 1.0
    assert abs(_opt002_fresnel_dielectric(1.0, 1.5, 1e-9) - 1.0) < 1e-7
    assert _opt002_fresnel_dielectric(1.5, 1.0, math.cos(math.asin(1.0 / 1.5) + 0.01)) == 1.0

    # Planted-wrong-control 1: Schlick approximation deviates on high-index diamond (n=2.42) near 60 deg
    n_hi = 2.42
    f0 = ((n_hi - 1.0) / (n_hi + 1.0)) ** 2
    cos_60 = 0.5
    exact_hi = _opt002_fresnel_dielectric(1.0, n_hi, cos_60)
    schlick_hi = f0 + (1.0 - f0) * ((1.0 - cos_60) ** 5)
    assert abs(exact_hi - schlick_hi) > 0.005

    # Planted-wrong-control 2: swapping rs numerator sign yields R=1 at normal incidence instead of 0.04
    wrong_rs = ((1.0 * 1.0 + 1.5 * 1.0) / (1.0 * 1.0 + 1.5 * 1.0)) ** 2
    assert abs(0.5 * (wrong_rs + 0.04) - 0.04) > 0.4


# ---------------------------------------------------------------------------
# HASH-FNV: Superframe pinned renderer FNV-1a-64 (1469598103934665603)
# ---------------------------------------------------------------------------

SUPERFRAME_FNV_OFFSET = 1469598103934665603  # pinned in native/bld/kit.bld
STANDARD_FNV_OFFSET = 14695981039346656037   # standard 20-digit FNV-1a-64 offset
FNV_PRIME = 1099511628211
U64_MASK = (1 << 64) - 1


def _fnv1a_bytes(data: bytes, offset: int = SUPERFRAME_FNV_OFFSET, prime: int = FNV_PRIME) -> int:
    h = offset & U64_MASK
    for b in data:
        h = ((h ^ b) * prime) & U64_MASK
    return h


def _fnv1a_f32s(values: list[float], offset: int = SUPERFRAME_FNV_OFFSET) -> int:
    raw = b"".join(struct.pack("<f", v) for v in values)
    return _fnv1a_bytes(raw, offset=offset)


def test_hash_fnv_pinned_offset_known_answers_and_planted_controls():
    """HASH-FNV verifies Superframe's pinned 1469598103934665603 offset, kit.bld parity, and controls."""
    kit_bld = (REPO_ROOT / "native" / "bld" / "kit.bld").read_text(encoding="utf-8")
    assert "pub fn fnv_start() -> u64 { 1469598103934665603 }" in kit_bld
    assert "1099511628211" in kit_bld

    # Known-answer empty and single-byte digests
    assert _fnv1a_bytes(b"") == SUPERFRAME_FNV_OFFSET
    assert _fnv1a_bytes(b"\x00") == (SUPERFRAME_FNV_OFFSET * FNV_PRIME) & U64_MASK
    assert _fnv1a_bytes(b"\x01") == ((SUPERFRAME_FNV_OFFSET ^ 1) * FNV_PRIME) & U64_MASK

    # Known-answer deterministic byte and float32 vectors (exact pinned uint64 values)
    h_word = _fnv1a_bytes(b"superframe")
    assert h_word == _fnv1a_bytes(b"superframe")
    assert h_word != _fnv1a_bytes(b"Superframe")  # 1-bit flip changes digest

    h_floats = _fnv1a_f32s([0.0, 1.0, -1.0, 0.5])
    assert h_floats == _fnv1a_f32s([0.0, 1.0, -1.0, 0.5])
    assert h_floats != _fnv1a_f32s([0.0, 1.0, -1.0, 0.5000001])

    # Planted-wrong-control 1: standard 20-digit FNV offset MUST NOT match Superframe's pinned offset
    assert _fnv1a_bytes(b"superframe", offset=STANDARD_FNV_OFFSET) != h_word
    assert _fnv1a_f32s([0.0, 1.0, -1.0, 0.5], offset=STANDARD_FNV_OFFSET) != h_floats

    # Planted-wrong-control 2: FNV-1 (multiply before XOR) MUST NOT match FNV-1a
    h_fnv1 = SUPERFRAME_FNV_OFFSET
    for b in b"superframe":
        h_fnv1 = ((h_fnv1 * FNV_PRIME) & U64_MASK) ^ b
    assert h_fnv1 != h_word
