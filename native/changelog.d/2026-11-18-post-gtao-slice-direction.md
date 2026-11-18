- **`post_gtao` meets its bound on game buffers** (`src/renderer/gpu/shaders/post.wgsl`). On a captured
  3840 x 2160 game frame the GPU pass differed from `raw::post::gtao` by more than 1e-3 on 0.44 % of drawn
  pixels, over the 0.1 % bound. The cause was one stage: the slice's screen direction came from projecting the
  pixel and a point 1e-3 of its depth away and subtracting, which in f32 turns the direction by about 1e-4,
  enough to move a far sample into the next pixel. A copy of the pass with that stage alone in double
  agreed with the reference (0.011 % against 0.463 % all in f32); the sample coordinates and the rest in
  double changed nothing. The pass now takes the direction from the derivative of the projection along the
  slice, which points the same way as the finite step and subtracts no nearly equal numbers. Same frame
  after: 0.040 % at 16 slices and 16 steps, 0.013 % at 4 and 8. On WARP `gpu_post_parity` passes with its
  controls and the worst GTAO difference of the built-in scene fell from 4.5e-4 to 2.5e-5; `gpu_host_frame`
  passes (0 of 37,996 outside, worst 2.5e-5). The CPU reference is unchanged.
