"""Comprehensive tests for spectral rendering."""

import numpy as np
import pytest

from build_color.spectral import (
    CMF_WAVELENGTHS,
    CMF_X,
    CMF_Y,
    CMF_Z,
    blackbody_chromaticity,
    cauchy_ior,
    daylight_chromaticity,
    dominant_wavelength,
    planck_radiation,
    spd_to_xyz,
)

# =========================================================================
# Planck blackbody
# =========================================================================


class TestPlanckRadiation:
    """Tests for blackbody spectral radiance."""

    def test_peak_at_5800k_near_500nm(self):
        """Planck at 5800K (sun-like) should peak around 500nm."""
        wavelengths = np.arange(300, 900, 1.0)
        spd = planck_radiation(wavelengths, 5800.0)
        peak_nm = wavelengths[np.argmax(spd)]
        # Wien's law: peak ~ 2898000/T nm => ~499nm at 5800K
        assert 470 <= peak_nm <= 530, f"Peak at {peak_nm}nm, expected ~500nm for 5800K"

    def test_peak_at_3000k(self):
        """Planck at 3000K (warm light) should peak around 966nm."""
        wavelengths = np.arange(300, 2000, 1.0)
        spd = planck_radiation(wavelengths, 3000.0)
        peak_nm = wavelengths[np.argmax(spd)]
        # Wien's law: 2898000/3000 ~ 966nm
        assert 900 <= peak_nm <= 1050, f"Peak at {peak_nm}nm, expected ~966nm for 3000K"

    def test_positive_values(self):
        """Spectral radiance must be positive for all visible wavelengths."""
        spd = planck_radiation(CMF_WAVELENGTHS, 6500.0)
        assert np.all(spd > 0)

    def test_higher_temp_higher_peak(self):
        """Higher temperature -> higher peak radiance."""
        wl = np.array([500.0])
        low = planck_radiation(wl, 3000.0)
        high = planck_radiation(wl, 10000.0)
        assert high[0] > low[0]


# =========================================================================
# SPD integration
# =========================================================================


class TestSPDIntegration:
    """Tests for spectral power distribution to XYZ integration."""

    def test_equal_energy_chromaticity(self):
        """Equal-energy illuminant should give chromaticity near (1/3, 1/3)."""
        # Equal energy: constant SPD across all wavelengths
        spd = np.ones_like(CMF_WAVELENGTHS)
        xyz = spd_to_xyz(CMF_WAVELENGTHS, spd)
        total = np.sum(xyz)
        x = xyz[0] / total
        y = xyz[1] / total
        assert x == pytest.approx(1.0 / 3.0, abs=0.02), f"Equal-energy x={x}, expected ~0.333"
        assert y == pytest.approx(1.0 / 3.0, abs=0.02), f"Equal-energy y={y}, expected ~0.333"

    def test_equal_energy_y_normalized(self):
        """With normalization, Y of equal-energy illuminant should be ~1.0."""
        spd = np.ones_like(CMF_WAVELENGTHS)
        xyz = spd_to_xyz(CMF_WAVELENGTHS, spd)
        assert xyz[1] == pytest.approx(1.0, abs=0.05)

    def test_spd_returns_3_element(self):
        spd = np.ones(len(CMF_WAVELENGTHS))
        xyz = spd_to_xyz(CMF_WAVELENGTHS, spd)
        assert xyz.shape == (3,)

    def test_blackbody_integration(self):
        """Integrating a blackbody SPD should give reasonable XYZ."""
        spd = planck_radiation(CMF_WAVELENGTHS, 6500.0)
        xyz = spd_to_xyz(CMF_WAVELENGTHS, spd)
        assert np.all(np.isfinite(xyz))
        assert np.all(xyz >= 0)


# =========================================================================
# CMF arrays
# =========================================================================


class TestCMFArrays:
    """Color matching function array dimensions."""

    def test_cmf_length_81(self):
        """380 to 780 at 5nm intervals = 81 samples."""
        assert len(CMF_WAVELENGTHS) == 81
        assert len(CMF_X) == 81
        assert len(CMF_Y) == 81
        assert len(CMF_Z) == 81

    def test_cmf_wavelength_range(self):
        assert CMF_WAVELENGTHS[0] == 380
        assert CMF_WAVELENGTHS[-1] == 780

    def test_cmf_non_negative(self):
        """CMFs should be non-negative."""
        assert np.all(CMF_X >= 0)
        assert np.all(CMF_Y >= 0)
        assert np.all(CMF_Z >= 0)

    def test_cmf_y_peaks_at_555nm(self):
        """y-bar peaks near 555nm (photopic peak)."""
        peak_idx = np.argmax(CMF_Y)
        peak_wl = CMF_WAVELENGTHS[peak_idx]
        assert 550 <= peak_wl <= 570, f"y-bar peak at {peak_wl}nm, expected ~555nm"


# =========================================================================
# Dominant wavelength
# =========================================================================


class TestDominantWavelength:
    """Tests for dominant wavelength calculation."""

    # Known answers: sRGB colours (IEC 61966-2-1 primaries, D65 white
    # 0.3127, 0.3290), chromaticity from colour-science 0.4.7
    # colour.XYZ_to_xy(colour.sRGB_to_XYZ(rgb)), wavelength from
    # colour.dominant_wavelength with the 1 nm CIE 1931 2 degree observer.
    # colour-science reports the nearest 1 nm sample, so the tolerance is 0.6 nm.
    # The old dot-product search returned 775, 520, 530, 420 and 775 nm for the
    # first five.
    KNOWN = [
        # hex,     x,       y,       nm
        ("ff0000", 0.64007, 0.32997, 611.0),
        ("00ff00", 0.30000, 0.60000, 549.0),
        ("ffff00", 0.41932, 0.50526, 570.0),
        ("0000ff", 0.15002, 0.06001, 464.0),
        ("b46f00", 0.50681, 0.43578, 585.0),
        ("00ffff", 0.22466, 0.32874, 491.0),
        ("ff8000", 0.54302, 0.40703, 591.0),
    ]

    @pytest.mark.parametrize("hex_, x, y, nm", KNOWN)
    def test_known_answers_match_colour_science(self, hex_, x, y, nm):
        lam = dominant_wavelength(x, y)
        assert abs(lam - nm) <= 0.6, f"#{hex_}: {lam:.2f} nm, reference {nm} nm"

    @pytest.mark.parametrize("hex_, x, y, nm", KNOWN)
    def test_locus_point_lies_on_the_ray_from_white(self, hex_, x, y, nm):
        """Independent of the reference: the locus point at the returned
        wavelength must sit on the ray from D65 through the sample."""
        lam = dominant_wavelength(x, y)
        tot = CMF_X + CMF_Y + CMF_Z
        lx = np.interp(lam, CMF_WAVELENGTHS, CMF_X / tot)
        ly = np.interp(lam, CMF_WAVELENGTHS, CMF_Y / tot)
        xw, yw = 0.3127, 0.3290
        sx, sy, ex, ey = x - xw, y - yw, lx - xw, ly - yw
        cross = sx * ey - sy * ex
        assert abs(cross) / (np.hypot(sx, sy) * np.hypot(ex, ey)) < 1e-3
        assert sx * ex + sy * ey > 0            # same side of the white point
        assert np.hypot(ex, ey) >= np.hypot(sx, sy)   # locus is outside the sample

    def test_purple_returns_negative_complementary(self):
        # sRGB magenta; colour-science gives complementary 549 nm (reported as -549).
        lam = dominant_wavelength(0.32092, 0.15415)
        assert abs(lam + 549.0) <= 0.6

    def test_white_point_has_no_dominant_wavelength(self):
        assert np.isnan(dominant_wavelength(0.3127, 0.3290))

    def test_returns_float(self):
        lam = dominant_wavelength(0.4, 0.4)
        assert isinstance(lam, (float, np.floating))


# =========================================================================
# Cauchy IOR
# =========================================================================


class TestCauchyIOR:
    """Tests for Cauchy dispersion model."""

    def test_visible_range_reasonable(self):
        """IOR at visible wavelengths should be between 1.3 and 1.8 for glass."""
        for wl in [400, 500, 600, 700]:
            n = cauchy_ior(wl, n0=1.5, B=0.004)
            assert 1.3 <= n <= 1.8, f"IOR at {wl}nm = {n}, expected 1.3-1.8"

    def test_shorter_wavelength_higher_ior(self):
        """Shorter wavelengths should have higher IOR (normal dispersion)."""
        n_blue = cauchy_ior(400.0, n0=1.5, B=0.004)
        n_red = cauchy_ior(700.0, n0=1.5, B=0.004)
        assert n_blue > n_red, "Blue should have higher IOR than red"

    def test_n0_baseline(self):
        """At very long wavelengths, IOR approaches n0."""
        n = cauchy_ior(100000.0, n0=1.5, B=0.004)
        assert n == pytest.approx(1.5, abs=0.001)

    def test_returns_float(self):
        n = cauchy_ior(550.0)
        assert isinstance(n, (float, np.floating))


# =========================================================================
# Blackbody chromaticity
# =========================================================================


class TestBlackbodyChromaticity:
    """Tests for blackbody_chromaticity."""

    def test_returns_tuple(self):
        result = blackbody_chromaticity(6500.0)
        assert len(result) == 2

    def test_d65_like_at_6500k(self):
        """6500K blackbody chromaticity should be near D65."""
        x, y = blackbody_chromaticity(6500.0)
        # D65 is at x=0.3127, y=0.3290 but blackbody deviates slightly
        assert 0.28 < x < 0.35
        assert 0.28 < y < 0.40

    def test_higher_temp_bluer(self):
        """Higher temperature -> smaller x (bluer)."""
        x_5000, _ = blackbody_chromaticity(5000.0)
        x_10000, _ = blackbody_chromaticity(10000.0)
        assert x_10000 < x_5000


# =========================================================================
# Daylight chromaticity
# =========================================================================


class TestDaylightChromaticity:
    """Tests for CIE daylight chromaticity."""

    def test_d65_chromaticity(self):
        """Daylight at 6500K should be close to D65 chromaticity."""
        x, y = daylight_chromaticity(6500.0)
        assert x == pytest.approx(0.3127, abs=0.01)
        assert y == pytest.approx(0.3290, abs=0.01)

    def test_returns_tuple(self):
        result = daylight_chromaticity(5500.0)
        assert len(result) == 2
