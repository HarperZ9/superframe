- **Low Water hero characters in the native frame** (`src/rhi/d3d12/hf_*`, `src/tools/lwframe/`,
  `src/assets/gltf.cpp`, `games/low-water/characters/hero`). GPU skinning: a compute pass skins the
  characters' bind-pose vertices by a joint palette into the vertex buffer each frame, keeps last
  frame's positions for motion vectors, and refits the skinned triangles' own BLAS under a
  two-instance TLAS; it matches `raw/scene/skin.hpp` on the same matrices to 1.4e-6 m over 436,076
  vertices. Character materials: skin (procedural pores and flush, a wrapped diffuse with
  transmission through thin parts, a separable screen-space profile blur, a random walk in the path
  tracer), cloth and leather on CC0 scans with Charlie sheen, eyes with a refracted iris, and hair
  strands in a Marschner-style approximation. The glTF loader reads JOINTS_0 and WEIGHTS_0.
  `lw_frame --chars LIST` places people and adds the street, portrait, charref, turn, cwalk and
  parity jobs. The characters are generated, not scanned or retopologised: see the findings for
  what still falls short.
