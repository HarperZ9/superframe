- **Low Water hero frame, pass 3** (`src/tools/lwframe/lwframe_bc7.cpp`, `src/rhi/d3d12/hf_*`,
  `games/low-water/world/walk/build/hero`). A BC7 (mode 6) cook for the scanned textures, with
  snow and ice kept RGBA8; a procedural detail grain on textured surfaces near the camera; fog at
  160 x 96 x 96 froxels with three RIS lamp picks, jittered reads and temporal accumulation (0.95 ms,
  was 5.96); log ends with their own rings, checks and bark; smooth snow heaps; irregular
  half-timbering; softer door clearings; the moon behind the view so moonlit snow reads, thinner
  haze and a cooler white balance.
