# WARP commits RayQuery hits below TMin: a one-triangle case

`CHANGELOG.md` records that the hardware ray query check (HW H1.1, described in `docs/hw-rt.md`) found 20 hits below TMin on WARP, Microsoft's software Direct3D 12 adapter, and none on an RTX 4090. This folder is the smallest case that shows it: one triangle, one instance with an identity transform, and a compute shader that traces eight rays with inline `RayQuery`.

## Run it now

On Windows, from a Developer Command Prompt for Visual Studio, with `dxc` on the PATH (the Windows SDK and the Vulkan SDK both ship it):

```
build.bat
repro.exe cs.cso warp        # the software adapter
repro.exe cs.cso hw          # a hardware adapter
repro.exe sweep.cso warp     # where the tolerance ends
```

Each line of output is one ray: its name, the committed hit distance, the float bits, and `(no hit)` when the query committed nothing. A third argument, `debug`, turns the D3D12 debug layer on. With `sweep.cso` the eight lines keep the names of the first shader's rays; read them in order as TMin 0.015, 0.02, and so on to 0.05.

## What it shows

Setup: opaque geometry, shader model `cs_6_5`, `RAY_FLAG_FORCE_OPAQUE`, instance mask 0xFF, TMax 1e30. A ray must report no hit when the hit distance is below its TMin.

Run of 2026-11-14 on Windows build 26320. WARP: Microsoft Basic Render Driver, d3d10warp.dll 10.0.26100.9871. Hardware: an RTX 4090.

| Ray | TMin | WARP committed | RTX 4090 committed |
|---|---|---|---|
| oblique, hit near 4.3e-5 | 1e-4 | 4.275013e-05 | no hit |
| oblique, same ray | 1e-3 | 4.275013e-05 | no hit |
| oblique, same ray (control) | 0 | 4.275013e-05 | 4.274723e-05 |
| straight down, hit at 5e-5 | 1e-4 | 4.992193e-05 | no hit |
| straight down, hit at 5e-3 | 1e-2 | 4.999969e-03 | no hit |
| straight down, hit at 0.5 | 1.0 | no hit | no hit |
| straight down, hit at 0.5 (control) | 0.49 | 0.5 | 0.5 |

The shader traces an eighth ray (oblique, hit near 0.5, TMin 1.0, expected to miss); its result from this run was not written down.

`sweep.hlsl` holds the hit at 0.01 and steps TMin from 0.015 to 0.05. In the same run WARP reported the hit for TMin up to 0.035 and no hit from 0.04; the RTX 4090 reported no hit at every step. WARP therefore kept a hit that fell up to about 0.025 short of TMin, on a triangle about 0.15 units across. A run on 2026-10-14 with d3d10warp.dll 10.0.26100.9587 gave the same numbers for the table above.

Not tested: the Microsoft.Direct3D.WARP NuGet package, and `TraceRay` pipelines. The debug layer made no difference in the October run and was not tried again in November.

## Files

| File | What it is |
|---|---|
| `repro.cpp` | a 109-line D3D12 host: picks the adapter, builds the two acceleration structures, runs the compute shader, prints eight floats |
| `cs.hlsl` | the eight rays of the table |
| `sweep.hlsl` | the TMin sweep |
| `build.bat` | compiles both shaders with `dxc` and the host with `cl` |

Nothing here runs in CI: it needs Windows, a D3D12 adapter with DXR 1.1 and the two compilers. The engine's own check of the same behaviour is `raw_native_cli hw-rayquery`, with its recorded runs in `../hw-h1-1-runs.json`.
