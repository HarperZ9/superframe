- **Low Water native shell, milestone N0** (`app/lw_shell_main.cpp`, `src/tools/lwshell/`,
  `cmake/lwshell.cmake`, `RAW_NATIVE_LW_SHELL=ON`). The first native frame of the game: BuildLang
  game code (`games/low-water/runtime/game`) through buildc's C backend, linked over its C ABI; a
  Win32 window, keyboard and XInput pad (`raw/platform/input.hpp`), D3D12 with a waitable
  swapchain, a 257 x 257 vertex tile of Thaw Country from the world generator and a walking
  capsule. A frame trace with CPU zones and per-pass GPU timestamps, input recording, and
  `lw_shell_replay`, which replays a trace to its state hash with no GPU. On the RTX 4090 (shared
  with another GPU job): cold start to walking 332 to 813 ms over six runs, present interval p50
  8.34 ms and p99 9.40 ms at 120 Hz; the committed trace replays to the same hash under MSVC and
  gcc, and a perturbed tick changes it. Graphics tier chosen at start-up (rt, raster, reduced)
  from the hardware probe, which now also reports variable-rate shading and adapter memory.
