- **Scene files carry materials** (`raw_native_cli gi-reference --scene-file`). A second scene-file
  format, `RNGISC02`, adds roughness, metallic and specular to each triangle and the camera's up
  vector to the header, so a scene written outside the engine renders through the path tracer's GGX
  lobe (glossy water, varnished wood, satin) instead of pure Lambert. `RNGISC01` files load as
  before. `--pt` now also writes the tracer's albedo, normal and depth AOVs as PFMs beside radiance
  and variance, `--jitter` turns on sub-pixel jitter for anti-aliased frames, and `--threads` sets
  the CPU path's thread count (it was fixed at 3). Checked on this machine: an exported `RNGISC01`
  control sphere still loads and renders on the CPU path, and the same `RNGISC02` sphere rendered
  Lambert and as a rough-0.05 metal differs (mean absolute radiance difference 0.071 at 48 x 48,
  16 spp), so the new fields reach the shading.
