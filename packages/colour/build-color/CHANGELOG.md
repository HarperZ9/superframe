# Changelog

## Unreleased

### Fixes
- `dominant_wavelength` now follows the CIE construction: the ray from the
  white point through the sample, crossed with the spectral locus, with the
  wavelength interpolated along the crossed segment. The old search took the
  locus point with the largest dot product, which favoured the far red end:
  #ff0000 read 775 nm (reference 611), #b46f00 read 775 (585), #0000ff 420
  (464). Purples now return the complementary wavelength as a negative number,
  and the white point returns nan. `build-color info` and the GUI inspector
  print the corrected value; the inspector's separate angle formula is gone.

## v1.0.1 (2026-06-14)

### Release Surface
- Adds release-artifact packaging workflow and release checklist.
- Publishes package artifacts for the current public package state.
- Keeps registry publication separate from GitHub Release artifacts.

## v1.0.0 (2026-03-22)

### Features
- **15 color spaces**: sRGB, Display P3, Adobe RGB, Rec.2020, ACES AP0/AP1, CIE XYZ, CIE Lab, Oklab, Oklch, JzAzBz, ICtCp, HSV, HSL, LMS
- **12 tone mapping operators**: Reinhard, ACES filmic, Hable/Uncharted 2, AGX, Khronos PBR Neutral, HLG OETF/EOTF, PQ (ST.2084), and more
- **CIECAM02 and CAM16** color appearance models
- **Spectral rendering** with observer functions
- **Gamut mapping** with perceptual chroma compression
- **Color difference metrics**: CIEDE2000, CIE94, CMC
- **Color harmony generation**: complementary, triadic, analogous, split-complementary
- **3D LUT I/O**: .cube, .3dl import/export with tone mapping baking
- **ICC profile generation**: v4 profiles with D50/D65 adaptation
- **PyQt6 GUI**: color inspector, palette studio, LUT workshop, image analyzer
- **CLI**: 8 commands (info, convert, difference, harmony, spectrum, icc, gui)

### Tests
- 457 tests passing
