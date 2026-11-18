# Low Water, native

The game's native code, in BuildLang. Milestone N0 of the ship plan: one terrain tile from the world generator, a capsule that walks on it, a D3D12 window with paced presentation, a frame trace with per-pass GPU and CPU zones, and input recording that replays to the same state hash.

| Folder | What it is |
|---|---|
| `game/` | The game code. `main.bld` exports `lw_game_*` over the C ABI: load a tile, step a tick, hash the state, give the view. |
| `tilecut/` | Cuts one tile out of the generator's `height.pgm` as plain PGM text. |
| `traces/` | Input traces recorded from real runs, with the state hash each one must replay to. |

The engine's side is in `native/`: `app/lw_shell_main.cpp`, `app/lw_shell_replay.cpp` and `src/tools/lwshell/`. The engine owns the window, the devices, the GPU and the clock. The game owns everything the player's state depends on.

## Build and run (Windows)

You need buildc 1.15.0 or later with binary file I/O and the MSVC runtime fix (buildlang PR 325), the Windows SDK and Visual Studio.

```bash
buildc build --release games/low-water/world/gen
games/low-water/world/gen/target/release/main 20261118 games/low-water/world/out/20261118
buildc build --release games/low-water/runtime/tilecut
games/low-water/runtime/tilecut/target/release/main games/low-water/world/out/20261118/height.pgm 3 1 256 t_3_1.pgm

cmake -S native -B native/build -DRAW_NATIVE_GPU_D3D12=ON -DRAW_NATIVE_LW_SHELL=ON
cmake --build native/build --config Release --target lw_shell lw_shell_replay
native/build/Release/lw_shell.exe --tile t_3_1.pgm --record run.lwin --trace frames.json
```

Tile `3 1` holds Thaw Country, 16.4 km on a side at 64 m a cell. The capsule starts at its centre.

**Controls.** W and S walk, A and D step sideways, Q and E or the arrow keys turn, Shift runs, Space jumps, Escape quits. A pad works through XInput: the left stick moves, the right stick turns, A jumps, the right trigger or a left-stick click runs, Back quits. F11 or Alt+Enter toggles fullscreen.

**Options.** `--record` writes the input trace, `--replay` drives the run from one, `--trace` writes the frame trace, `--shot` with `--shot-frame` writes a PNG, `--autowalk` plays a fixed scripted walk, `--frames` and `--ticks` stop the run, `--vsync off` presents with tearing allowed, `--hidden` runs with no visible window.

## The checks

**Replay.** Every tick's input is recorded as four integers. `lw_shell_replay` runs the trace on the tile with no window or GPU and compares the state hash with the recorded one. The control changes the input of one tick and must change the hash.

```bash
native/build/Release/lw_shell_replay games/low-water/runtime/traces/n0-autowalk.lwin --tile t_3_1.pgm
native/build/Release/lw_shell_replay games/low-water/runtime/traces/n0-autowalk.lwin --tile t_3_1.pgm --perturb 100
```

The game uses `+ - * / sqrt floor` and comparisons only, the rule of `design/DETMATH.md`, so a trace recorded with MSVC on Windows replays to the same hash with gcc on Linux. CI checks both.

**Cold start.** The shell measures from the process's creation time (`GetProcessTimes`) to its first present and to the first presented frame in which the capsule has moved. Both are in the frame trace's summary.

**Frame trace.** Chrome trace events: `chrome://tracing` or Perfetto open the file. CPU zones are `cpu.wait` (the swapchain's frame latency object), `cpu.input`, `cpu.sim` and `cpu.render_submit_present`. GPU zones are `gpu.sky`, `gpu.terrain`, `gpu.capsule` and `gpu.post`, from D3D12 timestamps. GPU zone lengths are on the GPU clock; their placement on the CPU timeline is at the start of the frame's render zone, because the RHI has no clock calibration yet. The summary holds the present-to-present interval's mean, variance, p50, p99 and maximum.

## The graphics tier

At start-up the shell asks the adapter what it offers (`raw/rhi/hw.hpp`: DXR tier, ray queries, mesh shaders, variable-rate shading, wave sizes, bindless, work graphs, vendor, driver, dedicated and shared memory) and picks one tier, which every later system branches on. The author's ruling of 2026-11-18: hardware ray tracing on PC, a full path for cards without it, a reduced path for the Steam Deck.

| Tier | Chosen when |
|---|---|
| `rt` | DXR 1.1 ray queries and the ray tracing pipeline, and at least 6 GiB of dedicated video memory |
| `raster` | any other discrete adapter with 2 GiB or more |
| `reduced` | the Steam Deck, a software adapter (WARP), or under 2 GiB of dedicated video memory |

`--tier rt|raster|reduced` or `LW_TIER` overrides the choice. A request the adapter cannot run (rt without ray tracing) is refused and the refusal is logged. The console prints the choice and its reason; `--caps` writes the probe and the choice as JSON, and the frame trace carries the same object. N0 draws the same frame on every tier. The Deck match is by adapter name, written from memory and not yet checked on a Deck.

## Measured

On the reference machine, an RTX 4090 at 120 Hz, 1280 x 720, with another job's SkyrimSE.exe running on the same GPU through every run (`evidence/` (`evidence/`; that frame trace predates the `graphics` key, and the same run's tier choice is in `n0-rtx4090-caps.json`):

- **Cold start to walking**: 332, 342, 393, 430, 438 and 813 ms over six runs; the 813 ms run was the first after a build. The bound is 5 s.
- **Present interval** over 1,767 frames after 30 warm-up frames: mean 8.35 ms, p50 8.34 ms, p99 9.40 ms, standard deviation 0.97 ms, maximum 43.8 ms. The maximum is frame 200, the frame that wrote the screenshot. An earlier run of the same walk had two stalls of 323 and 263 ms at frames 442 and 456, with the window's message pump stalled 84 ms beside them; the cause was not isolated.
- **GPU zones** (means): sky 0.010 ms, terrain 0.014 ms, capsule 0.001 ms, post 0.007 ms. The scene is far too small to load this GPU; the numbers show the timestamps work.
- **Replay**: `traces/n0-autowalk.lwin` (900 ticks) replays to `f719a29f107d7549` with MSVC and with gcc 13.2 (MinGW); perturbing tick 100 gives `f734ccca66ec6004` and tick 850 gives `2f19a902a0dd2c04`. Replaying it through the shell itself with vsync off, at about 2,000 frames a second, gives the same hash, so the state does not depend on frame timing.
- **WARP** (software, for CI): a 240-tick walk at 320 x 180 records and replays to its own hash; cold start to walking 147 ms.

## The ground

Vertex `(i, j)` of the tile stands at `(i x 64 m, height, j x 64 m)`. Each cell is two triangles split on the diagonal from `(i + 1, j)` to `(i, j + 1)`. `lw_game_ground` interpolates on that triangle, and the terrain's vertex shader draws the same triangles from the heights the game hands it, so the feet stand on the surface that is drawn.

The capsule walks at 2.2 m/s and runs at 7 m/s. It refuses a step where the ground rises more than 1.2 m a metre (about 50 degrees) and slides along whichever axis still stands. It keeps to the ground within 0.6 m when walking downhill, and falls under gravity otherwise.

## What N0 leaves for later

- The camera is a stub: behind and above the capsule along its heading. The engine-independent camera and player work under `world/` replaces it when it lands.
- The shaders are HLSL (see the gaps below).
- The tile is text and the surface is the 64 m raster with no detail noise. Binary tiles are task N1's prerequisite.
- Rendering is one draw of 131,072 terrain triangles with no culling or level of detail, a sky gradient and a sun term. Terrain, sky and lighting are N1.

## Compiler gaps found

- **Generated C did not build with MSVC.** The C runtime used `__int128` everywhere and wrote infinity as `1.0 / 0.0`. Fixed in buildlang PR 325 (which carries PR 324); CI here pins its commit until it merges.
- **No `Vec::as_ptr` in the C backend.** Added in buildlang PR 325.
- **The generated header dropped `const`.** Fixed in buildlang PR 325.
- **No binary file I/O.** `tilecut` first went through the C library's stdio from `extern "C"` declarations, which assigned `FILE *` to `uint8_t *` and failed under the CI's gcc. It now uses `read_file_bytes` and `write_file_bytes` from buildlang PR 325, and writes the same bytes as before.
- **Shaders, not tried.** The four passes are HLSL. BuildLang's shader examples show no vertex stage that reads a storage buffer by vertex index or a constant buffer with a matrix; porting the passes is the test of whether it can.
