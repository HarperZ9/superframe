- **WARP TMin: a one-triangle case** (`evidence/warp-tmin-repro`). The WARP defect recorded under HW H1.1 now has
  its minimal case in the tree: a 109-line D3D12 host and a compute shader that traces eight rays at one triangle
  with inline `RayQuery`, plus a sweep shader. In the run of 2026-11-14, WARP (d3d10warp.dll 10.0.26100.9871)
  committed hits below TMin on four rays that must miss, and an RTX 4090 on none; the sweep puts
  WARP's tolerance near 0.025 on a triangle 0.15 units across. It needs Windows, `dxc` and `cl`, and runs in no CI job.
