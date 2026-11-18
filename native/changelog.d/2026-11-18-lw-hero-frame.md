- **Low Water hero frame** (`raw/rhi/hw_frame.hpp`, `src/rhi/d3d12/hf_*`, `app/lw_frame.cpp`,
  `-DRAW_NATIVE_LW_FRAME=ON`). The Hoarstead main street at night on D3D12 with DXR inline
  ray queries at 3840 x 2160 on an RTX 4090: clustered lights, ReSTIR DI with RT shadows from
  sphere lights and the moon, one-bounce RT GI with screen feedback, GGX RT reflections, the
  fast GTAO from `bench/ao` unchanged, lit froxel fog, falling snow, an SVGF-style denoiser,
  TAA, bloom and an ACES tone map, over 2.44 million triangles from the hero kit
  (`games/low-water/world/walk/build/hero`) with ten ambientCG and three Poly Haven CC0 scans.
  14.0 ms GPU a frame at native 4K (median of 16 frames, no upscaling). A path tracer over the
  same scene is the reference: FLIP mean 0.215 at 4096 samples a pixel (median 0.209, p95
  0.362; 1920 x 1080 after a 2 x 2 box). glTF import now reads `TEXCOORD_0`, `TANGENT`,
  `COLOR_0` and material names. Textures are uncompressed RGBA8 (no BC7 encoder yet).
