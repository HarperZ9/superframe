- **Low Water hero frame, pass 2** (`src/rhi/d3d12/hf_*`, `games/low-water/world/walk/build/hero`).
  ReSTIR DI keeps each pixel's contribution weight for temporal reuse, which ends a bias that
  lit plaster walls 7.5 times the path tracer under TAA. Surfaces are rebuilt through the
  jittered pixel, with the geometric normal stored for ray offsets. Fog lamps are chosen by RIS
  over every light, as the path tracer does, at 240 x 136 x 128 froxels with chimney smoke in
  the shared medium. GTAO runs at half resolution. Houses vary in style, upper floors, dormers,
  porches, balconies, sheds, fences, gable windows, roofs, lean and sag; drifts are smooth and
  wind-shaped; windows show furnished rooms and signs carry lettering. FLIP mean 0.127 against
  2048 spp (was 0.215); 17.6 ms GPU a frame at native 4K on an RTX 4090; fog 5.96 ms is over budget.
