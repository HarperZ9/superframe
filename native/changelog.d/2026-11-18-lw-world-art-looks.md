- **Low Water hero frame: looks, lenses, the town in its land, and the works** (`lw_frame --looks`,
  `src/tools/lwframe/lwframe_looks.cpp`, `raw/rhi/hw_frame.hpp` `FrameOptions`). One scene now gives
  many versions of a place: a looks file sets each version's camera, haze (density, falloff,
  anisotropy, reach, the sky's share in its light), sky and moon scale, falling snow (speed, wind,
  count), white balance, saturation, contrast, lift and vignette. Three camera modes run over the
  physical frame in a new lens pass (`hf_post.hlsl` MODE 6): a tilt-shift miniature (a disc blur
  that grows from a focus band, bright points opening into bokeh), oil (an anisotropic Kuwahara
  over the structure tensor) and oil and ink (oil with contour lines from the luma gradient). The
  path tracer never takes a lens, so FLIP still compares physical frames. Night defaults are
  unchanged. A new water kind (`K_WATER`) doubles what stands over it, with a cross-view swell
  that stretches lights into streaks. glTF import accepts buffers up to the GLB container's own
  32-bit bound (a whole town and its land passes 1 GiB). The hero kit gains `--wide` (the whole
  town, a frozen pond, a knoll to see it from, bare trees and spruce, six vantage views) and
  `emit-works.mjs` (region 8 at night over water).
