# The renderer in BuildLang

The renderer is moving from C++ to BuildLang one module at a time. A module counts as moved when
its BuildLang code reproduces a hash the C++ tests already pin, bit for bit. The C++ stays in
place as the reference until every caller of that module has moved.

## Run it

```bash
buildc build --release native/bld
```

```bash
native/bld/target/release/main
```

The runner prints one line a module, `same` or `DIFF`, then control lines, cross-engine parity
invariants, and a count. CI fails unless the count reads `9 of 9` today, and the number grows
with each module.

## Moved so far

| Module | C++ source | BuildLang | Pinned in |
|---|---|---|---|
| Art scene: ray caster, sun shadow, sky and ambient shading, four samples a pixel | `src/renderer/art_scene.cpp`, `art_scene_trace.cpp`, `art_scene_prims.hpp` | `art_scene.bld`, `art_prims.bld` | `tests/test_art_strokes.cpp`, lit buffer of frame 0 at 256 x 144, `0x8e70a9159d2007bf` on GCC and MSVC |
| World anchor: triplanar surface charts and sky cube-map coordinates in f32 canvas layout | `src/renderer/art_anchor.cpp`, `raw/renderer/art_anchor.hpp` | `art_anchor.bld` | `tests/test_art_strokes.cpp`, anchor buffer of frame 0 at 256 x 144, `0x364d778712fdc849` on GCC and MSVC |
| Three-quarter town ray caster and Scheimpflug tilt-shift CoC map (`town_map`) | `src/renderer/art_scene_town.cpp`, `src/renderer/art_tiltshift.cpp` | `art_town_coc.bld` | `tests/test_art_tiltshift.cpp`, CoC buffer at 256 x 144, `0x2c4cd941314f50b5` on GCC and MSVC |
| Three-quarter town night lighting, shadowed sodium spot lamp cone, and emissive sodium globes/window | `src/renderer/art_scene_town.cpp`, `src/renderer/art_scene.cpp` | `art_town_lit.bld` | `tests/test_art_tiltshift.cpp`, `townNight` lit buffer at 256 x 144, `0x91ee8ea81ab861f0` on GCC and MSVC |
| 8-bit sRGB encoder (`encode8`/`codes8`) and stylised-track metrics (`instability`, `splitmix`, `pairedBootstrap`) | `src/renderer/art_metrics.cpp`, `raw/renderer/art_metrics.hpp` | `art_metrics.bld` | `tests/test_art_strokes.cpp`, `codes8(lit)` at 256 x 144, `0xbf2cbc974ff8fcad` on GCC and MSVC |
| Stroke-orbit exposure tonemap reference (`paintReference`) and camera reprojection motion vectors (`motionTo`) | `src/renderer/art_strokes.cpp`, `src/renderer/art_scene.cpp` | `art_strokes_ref.bld` | `tests/test_art_strokes.cpp`, `paintReference(lit, 1.0)` `0x4add0d97495fd95d` and `motionTo(f1, v0)` `0x30d7597963cbf119` on GCC and MSVC |
| Half-resolution tilt-shift defocus, rim-guarded weight, and bilinear compose (`unlinedHalf`, `defocusWeight`, `paintDefocus`) | `src/renderer/art_tiltshift_paint.cpp`, `src/renderer/art_scene.cpp` | `art_tiltshift_defocus.bld` | `tests/test_art_tiltshift.cpp`, `codes8(paintDefocus(..., Gaussian))` at 256 x 144, `0x6d3f8b9acb221e67` on GCC and MSVC |
| Conversation room ray caster, group bounding slabs, burst drop-in animation, and studio key lighting (`SceneKind::Room`) | `src/renderer/art_scene_room.cpp`, `raw/renderer/art_room.hpp` | `art_scene_room.bld` | `tests/test_art_strokes.cpp`, `Room` lit buffer (`t=3.0`) at 256 x 144, `0xc99282210e56cf4a` on GCC and MSVC |
| P23 lens and print effect stack: quarter-res bright pass, 24-tap halation, 4-axis star, chromatic aberration, cat-eye vignette, and PCG film grain (`fxStack`) | `src/renderer/art_tiltshift_fx.cpp`, `src/renderer/style_image.cpp` | `art_tiltshift_fx.bld` | `tests/test_art_tiltshift.cpp`, `fxStack(night, townNight.lit)` at 256 x 144, `0x593c8ac027015c51` on GCC and MSVC |

`wave25f_parity.bld` also links Superframe's 100 Hz latency-faithful simulation mode and Deja-VAE
10-step Moore-Penrose null-space back-projection invariants directly to compiled BuildLang f64
arithmetic (`packages/world/tests/test_wave25f_buildlang_parity.py` and
`superframe/tests/wave25f_cross_engine_parity.test.mjs`).

`scene_parity_probe.bld` is a canonical 64 x 64 f32 compute probe compiled from one BuildLang
source to both `--target wgsl` (WebGPU) and `--target hlsl` (DX12) under the
`superframe.cross-api-parity/v1` certificate (`packages/world/physai/cross_api_parity.py`,
`superframe/lib/cross_api_parity.mjs`), pinning 0-bit quantized 100 Hz state hash parity,
PSNR >= 60 dB, and p99 OKLab DeltaE <= 0.002 with fail-closed planted controls.

During the first port all 110,592 colour floats of that frame were also compared one by one
against a C++ build and were equal.

## The parity kit

`kit.bld` holds what every port shares, so the next module starts from working parts:

- `V3` and its arithmetic, written in the C++'s order of operations.
- The renderer's FNV-1a over 32-bit floats and over bytes. It starts at 1469598103934665603, one
  digit short of the usual offset, because every pinned hash depends on that value.
- `report`, which compares a module's hash with the pin and prints the line.

`main.bld` is the runner. Adding a module is three steps: write `<module>.bld`, add `mod <module>;`
and add one `report` line with the hash copied from the C++ test.

Each module also gets a control: an input that must produce a different hash. A check that cannot
fail proves nothing.

## Method notes

- Keep every floating-point expression in the C++'s order. `a + b + c` and `a + (b + c)` differ in
  the last bit, and the hash sees it.
- A term the C++ multiplies by zero stays in the expression as a zero.
- Narrow to 32 bits only where the C++ does: `(v as f32).to_bits()` at the buffer write.
- When a hash differs, compare the two programs float by float before reading code. On the first
  port the floats were equal and the fault was the hash's starting value.

## Speed

The first draft kept each vector in a heap `Vec<f64>` and took 0.42 s for one frame. With `V3` as
a struct, the same frame and the control frame together take 0.08 s on the same machine, single
threaded. The C++ uses a row-parallel loop; a parallel loop here is the next measurement.

## Next modules

In order: the stroke and paint passes (`style_paint.cpp` oil and watercolour, whose pinned hashes
`0x3745369e1e2a4c6f` and `0x89864af512059e7c` live in `tests/test_art_strokes.cpp`) and the
half-resolution painted tilt-shift defocus pass (`0x1a208990a1cda158` in `tests/test_art_tiltshift.cpp`).
