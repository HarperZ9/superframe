# BuildLang Engine Kernels

Four standalone, deterministic BuildLang (`*.bld`) engine and graphics kernels graduated into `packages/world/bld/` under the `MIT` license. Each kernel compiles and executes natively with `buildc` and embeds its own known-answer checks plus planted fail-closed controls.

## Graduated Kernels

- `gsplat_keepsake.bld` (`N18` 3D Gaussian Splatting): Deterministic tile-based 3DGS keepsake rasterizer implementing 3D-to-2D pinhole projection, 2D conic covariance inversion, and front-to-back volumetric alpha compositing. Achieves `61.78 dB` and `61.75 dB` multi-view PSNR, runs a 100k-splat tile-binned benchmark (`89,992` valid splats), and catches 3/3 planted fail-closed controls (depth-order flip error `0.140625`, non-PSD covariance, opacity outside `[0, 1]`).
- `ntc610_decoder.bld` (`OPT-052` `BuildLang-NTC610` Neural PBR Decoder): 4K PBR latent-grid plus inline MLP (`16` to `16` to `8`) material decoder. Compresses 4K material maps to `10.6675 MiB` versus `64.00 MiB` BC7 (`5.9995x`, `-83.33%` VRAM) and `170.6667 MiB` RGBA8 (`15.9987x`), decodes 4 multi-frequency PBR plates at `38.32` to `48.93 dB` PSNR (`SSIM >= 0.9948`), and catches 3/3 planted fail-closed controls (corrupt quantization scale, unnormalized normal, out-of-bounds mip or UV).
- `sensorless_display_cal.bld` (`N65` Sensorless Display Calibration): Zero-instrument 3-channel TRC gamma and whitepoint gain solver evaluated across drifted sRGB (`8.75` down to `0.188` median dE) and Display-P3 (`4.33` down to `0.222` median dE) panels, rejecting a planted inverted LUT fail-closed (`status = 1`).
- `buoy_ocean_field.bld` (`N38` JONSWAP Ocean and Gerstner Wave Field): 64-band JONSWAP spectrum synthesized from NOAA buoy parameters (`Hs = 2.40 m`, `Tp = 10.5 s`, Parseval error `0.0`) driving a 16x16 Gerstner elevation and unit slope-normal field (`max_norm_err = 0.0`), catching 2/2 planted fail-closed controls (`Hs <= 0` and breaking steepness `ak >= 1.0`).

## Verification

Run `buildc check` and `buildc run` in release mode on each kernel in `packages/world/bld/`, or invoke the full known-answer, Python differential math, and fail-closed pytest suite:

```bash
NATIVE_BLD_REQUIRE=1 BUILDC=buildc python -m pytest -q packages/world/tests/test_wave59d_engine_kernels.py
```

## Limits

These kernels are self-contained CPU reference implementations compiled to native binaries by `buildc`. They validate deterministic numerics, memory budgets, spectral energy conservation, and fail-closed guards; GPU shader dispatch and physical display I/O stay outside the kernel boundary.

License: MIT.
