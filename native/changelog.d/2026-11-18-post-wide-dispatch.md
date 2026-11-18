- **Post passes over more than 4.19 million pixels** (`src/renderer/gpu/shaders/post.wgsl`). `post_gtao`,
  `post_ssr` and `post_taa` now index `gid.x + gid.y * 2,097,152`, as the style and art passes do, and their
  callers dispatch rows of 32,768 groups (`postGroupsX`, `postGroupsY` in `post_params.hpp`). A 3840 x 2160
  frame is 8,294,400 pixels, which one row of 65,535 groups could not cover; RAW's bridge needs it to run
  `post_gtao` on a game frame. A frame of up to 2,097,152 pixels dispatches exactly as before. Rerun on WARP
  with the debug layer: `gpu_post_parity` passes with its controls, `gpu_host_frame` passes with the same
  numbers (0 of 37,996 pixels off by more than 1e-3, worst 4.5e-4). The second row was exercised on an
  RTX 4090 by RAW's `engine_gtao_check` at 3840 x 2160. There, on a captured game frame, 0.44 % of drawn
  pixels differ from `raw::post::gtao` by more than 1e-3, over the 0.1 % bound; the mean visibility agrees
  to four places. The suspected cause is float32 sample positions at large pixel coordinates: 960 x 540
  windows of the same buffers give 0.11 % and 0.19 %. Not fixed here.
