# BuildLang Engine Kernels Batch 3

Four additional standalone, deterministic BuildLang (`*.bld`) shader, spectral optics, typography, and cross-GPU validation kernels graduated into `packages/world/bld/` under the `MIT` license.

## Graduated Batch 3 Kernels

- `console_shader_stack.bld` (`E4` Multi-Gen Console and Film Linear-Light Shader Stack): Runs a deterministic multi-pass linear-light console and film shader stack (`energy_in = 430.92`, `energy_out = 349.4457`, ratio `0.8109`, max channel `0.8807 <= 1.0`, `checksum = 680.2630`), catching planted energy-creation and clipping traps fail-closed (`traps_caught = 1`).
- `metamer_divergence.bld` (`N61` 31-Band Spectral Metamer Divergence Stress Test): Constructs two distinct 31-band reflectance spectra (`spec_rms = 0.2042`) that match under D65 (`delta_xyz < 1e-12`) yet diverge sharply under an alternate illuminant (`delta_e76 = 15.3881`), rejecting a naive RGB summary collapse fail-closed (`guard_rc = -401`, `planted_rgb_trap_caught = 1`).
- `living_type_bezier.bld` (`E5` Parametric Cubic-Bezier Living Type and Optical Kerning): Evaluates parametric cubic-Bezier glyph outlines across `12 pt` to `144 pt` (`self_int = 0`, `contrast_144 = 4.8000`, `kern_AV = -0.2600`, `kern_HH = 0.0`, `checksum = 16.2957`), catching a planted bowtie self-intersection control fail-closed (`intersections = 1`).
- `moat_cross_gpu_tv.bld` (`Moat 3` Cross-GPU Shader Translation Validator): Cross-checks 256 shader inputs across WGSL, HLSL, MSL, and SPIR-V reference paths (`max_clean_ulp < 1e-8`, `tv_clean_status = 0`, `ref_sum = 4296.8899`), catching a planted HLSL divergence fault fail-closed (`max_ulp_broken = 11715.2381`, `planted_hlsl_status = 1`).

## Verification

```bash
NATIVE_BLD_REQUIRE=1 BUILDC=buildc python -m pytest -q packages/world/tests/test_wave82h_engine_batch3.py
```

## Limits

These kernels are self-contained CPU reference implementations compiled to native binaries by `buildc`. Hardware GPU driver dispatch, display calibration I/O, and font file serialization remain outside the kernel boundary.

License: MIT.
