# BuildLang Engine Kernels Batch 4

Four standalone, deterministic BuildLang (`*.bld`) biomechanics, photographic optics, ambient acoustics, and cinematography kernels staged under the `MIT` license for `packages/world/bld/` in `HarperZ9/superframe`. Together with the twelve kernels across `origin/main` and open Batch 2 and Batch 3 pull requests, this brings the planned pure-OSI `MIT` engine kernel suite to sixteen unique files with zero filename overlap and alignment to the clean-room rendering bridge (`N63`).

## Graduated Batch 4 Kernels

- `tree_wind_root_rot.bld` (`G4` Tree Wind Loading and Root Rot Biomechanics): Models cantilever wind drag torque (`53,746.9 N m`, tip deflection `0.0534 m`) across sheltered (`SF = 1.1536`, `uproot = 0`), wind-adapted (`SF = 1.5573`, `uproot = 0`), and 45 percent rotted (`SF = 0.4705`, `uproot = 1`) root plates. Catches 2/2 planted fail-closed controls (`bad_wind_rc = -201`, `bad_mod_rc = -202`).
- `camera_reciprocity_origami.bld` (`H8` Photographic Reciprocity and Flat-Fold Origami Geometry): Computes Schwarzschild long-exposure film compensation (`t_ideal = 40.0 s`, `t_film = 76.6967 s`, reciprocity residual `< 1e-12`) alongside Kawasaki alternating-angle sums (`180.0 deg` even and odd) and Maekawa crease parity (`mv_diff = 2`). Rejects a planted `172.0 deg` non-flat vertex fail-closed (`H8_TRAPS_CAUGHT = 1`).
- `ambient_jazz_waves.bld` (`H6` Voice-Led Ambient Jazz and Pink-Surf Acoustics): Verifies constrained voice leading (`ii-V = 1`, `V-I = 5`, `I-VI = 3`, total `9` transitions) and passive pink-noise ocean synthesis (`peak = 0.4238`, spectral low-to-high tilt `23.07x`, `rc = 0`). Catches 2/2 planted fail-closed controls for clipping (`clip_rc = -201`) and flat white noise (`white_rc = -202`).
- `cinematography_framing.bld` (`K2` Lens Field of View, Motion Jerk, and Film Grain): Evaluates full-frame horizontal FOV across `24`, `35`, `50`, and `85 mm` focal lengths (`f50 = 39.5978 deg`, golden-ratio framing error `< 1e-12`), smooth camera jerk (`13.8889`), and luminance-weighted grain (`g_mid = 0.04000`, `g_dark = 0.01149`). Catches 2/2 planted fail-closed controls for motion spike (`spike_jerk = 6311.11`, `spike_rc = -301`) and reduced-motion violation (`red_bad_rc = -302`).

## Verification

Run `buildc check`, `buildc lint`, and `buildc run` in release mode on each kernel in `packages/world/bld/`, or execute the known-answer, Python differential math, and fail-closed pytest suite:

```bash
NATIVE_BLD_REQUIRE=1 BUILDC=buildc python -m pytest -q packages/world/tests/test_wave85b_engine_batch4.py
```

## Limits

These kernels are self-contained CPU reference implementations compiled to native binaries by `buildc`. Real-time audio device output, GPU post-processing shader dispatch, and physical field pull-test sensors stay outside the kernel boundary.

License: MIT.
