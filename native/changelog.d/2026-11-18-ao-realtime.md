- **Real-time ambient occlusion** (`raw/renderer/ao_realtime.hpp`, `src/rhi/d3d12/hw_shaders/ao_rt.hlsl`). The
  GTAO integral of `post_gtao` at a frame budget: a half-resolution trace of 2 blue-noise slices by 16 steps
  over a four-level view-depth hierarchy, a running mean along motion vectors with rejection of uncovered
  pixels, and a depth-weighted resolve to full resolution that also writes the composite. Five raster passes
  over textures through the RHI, usable inside a host frame. The RHI gains `TextureFormat::RG16Float` and
  sampled R32Float and RG16Float textures on D3D12. The blue noise is generated at start by void and cluster
  (`src/renderer/ao_noise.cpp`). Against `raw::post::gtao` at 16 x 16 on the analytic scene of
  `gpu_ao_realtime` (480 x 270, RTX 4090 and WARP alike): mean difference 0.0051 after 32 frames, 0.0049 on the
  first frame, 0.0062 while the scene slides with the right motion vectors; twice the radius gives 0.031 and
  zero motion vectors during the slide give 0.130 where the reference is occluded, against 0.027 with the right
  ones. On a captured 3840 x 2160 game frame behind RAW's D3D12 bridge the pass takes 0.66 ms on an RTX 4090
  (another process held the GPU at 100 % during the run) and lands 0.050 from the 16 x 16 reference; that
  reference is itself 0.062 from a 48 x 48 one, and the pass is 0.060 from the 48 x 48 one. Not done: a Vulkan
  or WebGPU form of the shaders, and a check on a real camera pan.
