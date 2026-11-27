# BuildLang Engine Kernels

Eight standalone, deterministic BuildLang (`*.bld`) engine, physics, and graphics kernels graduated into `packages/world/bld/` under the `MIT` license. Each kernel compiles and executes natively with `buildc` and embeds its own known-answer checks plus planted fail-closed controls.

## Graduated Kernels

- `gsplat_keepsake.bld` (`N18` 3D Gaussian Splatting): Deterministic tile-based 3DGS keepsake rasterizer implementing 3D-to-2D pinhole projection, 2D conic covariance inversion, and front-to-back volumetric alpha compositing. Achieves `61.78 dB` and `61.75 dB` multi-view PSNR, runs a 100k-splat tile-binned benchmark (`89,992` valid splats), and catches 3/3 planted fail-closed controls (depth-order flip error `0.140625`, non-PSD covariance, opacity outside `[0, 1]`).
- `ntc610_decoder.bld` (`OPT-052` `BuildLang-NTC610` Neural PBR Decoder): 4K PBR latent-grid plus inline MLP (`16` to `16` to `8`) material decoder. Compresses 4K material maps to `10.6675 MiB` versus `64.00 MiB` BC7 (`5.9995x`, `-83.33%` VRAM) and `170.6667 MiB` RGBA8 (`15.9987x`), decodes 4 multi-frequency PBR plates at `38.32` to `48.93 dB` PSNR (`SSIM >= 0.9948`), and catches 3/3 planted fail-closed controls (corrupt quantization scale, unnormalized normal, out-of-bounds mip or UV).
- `sensorless_display_cal.bld` (`N65` Sensorless Display Calibration): Zero-instrument 3-channel TRC gamma and whitepoint gain solver evaluated across drifted sRGB (`8.75` down to `0.188` median dE) and Display-P3 (`4.33` down to `0.222` median dE) panels, rejecting a planted inverted LUT fail-closed (`status = 1`).
- `buoy_ocean_field.bld` (`N38` JONSWAP Ocean and Gerstner Wave Field): 64-band JONSWAP spectrum synthesized from NOAA buoy parameters (`Hs = 2.40 m`, `Tp = 10.5 s`, Parseval error `0.0`) driving a 16x16 Gerstner elevation and unit slope-normal field (`max_norm_err = 0.0`), catching 2/2 planted fail-closed controls (`Hs <= 0` and breaking steepness `ak >= 1.0`).
- `low_water_combat_civ.bld` (`E2` Deterministic 120 Hz Combat and Settlement Loop): Fixed-timestep 120 Hz melee impulse and 12-node settlement supply loop achieving `0.0` drift across `60`, `144`, and `240 FPS` schedules (`1,200` ticks), while rejecting a planted variable-dt Euler loop (`4.2874 m` drift, `status = 1`).
- `low_water_lie_decay.bld` (`H1` World Corrosion and Witnessed Repair): Strict `8/8` monotonic world corrosion, boss distortion, and dissonance progression versus `4/4` witnessed structural repair preserving a non-zero scar floor, rejecting a planted negative-entropy cover-up defect (`status = 1`).
- `pbr_16archetype_rt.bld` (`N64` 16-Archetype PBR White-Furnace Conservation): Verifies 3-bounce directional energy conservation across `16/16` PBR material archetypes (`max_a1 = 0.9615 <= 1.0`, `sum_a3 = 4.8653`), catching a planted super-unitary albedo violation (`bad_a1 = 1.1640`, `rc_bad = -301`).
- `moat_indirect_draw_cull.bld` (`Moat 7` Frustum and Hi-Z Indirect-Draw Batcher): Processes `100,000` world instances into `32` indirect draw buckets (`3,125.0x` CPU draw-call reduction, `31,743` visible, `18,041` Hi-Z culled, `0` false culls), catching a planted inverted-frustum defect (`31,290` false culls, `bug_caught = 1`).

## Verification

Run `buildc check` and `buildc run` in release mode on each kernel in `packages/world/bld/`, or invoke both known-answer, Python differential math, and fail-closed pytest suites:

```bash
NATIVE_BLD_REQUIRE=1 BUILDC=buildc python -m pytest -q packages/world/tests/test_wave59d_engine_kernels.py packages/world/tests/test_wave80a_engine_batch2.py
```

## Limits

These kernels are self-contained CPU reference implementations compiled to native binaries by `buildc`. They validate deterministic numerics, memory budgets, spectral and energy conservation, visibility culling, and fail-closed guards; GPU shader dispatch and physical display I/O stay outside the kernel boundary.

License: MIT.
