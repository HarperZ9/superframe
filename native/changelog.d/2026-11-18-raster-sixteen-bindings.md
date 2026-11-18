- **Raster pipelines take up to 16 bindings on D3D12** (`raw/rhi/rhi.hpp`, `src/rhi/d3d12/d3d12_raster.cpp`).
  `kMaxRasterBindings` names the limit, which was 8. Sixteen root parameters fit D3D12's 64-DWORD root
  signature: a table costs 1 DWORD, a root CBV or UAV 2. RAW's deferred lighting of a Skyrim frame binds a
  uniform and eight textures in one draw. It runs in game at 3840 x 2160 on an RTX 4090 in three cells. No
  superframe test uses more than 8 raster bindings yet. Compute pipelines keep their limit of 8.
