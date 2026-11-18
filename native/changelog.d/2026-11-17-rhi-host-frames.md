- **Host frames in the RHI** (`raw/rhi/host.hpp`, D3D12). The RHI can now render inside another application's
  frame: `adoptDevice` makes a device on a caller's `ID3D12Device` and command queue, `Device::importTexture`
  wraps a caller's `ID3D12Resource` with a stated state and never destroys it, and a submission splits into
  `endRecording`, `submit` (queue wait and signal on the caller's `ID3D12Fence`) and `retire` (a timed wait).
  `gpu_host_frame` plays the host on WARP with the debug layer: `post_gtao` into the host's own target matches
  the CPU reference at `post_parity`'s bound (0 of 37,996 pixels off by more than 1e-3, worst 4.5e-4), and
  three controls fail as they must: the target before the pass, a fence value nobody signals (a 750 ms timeout,
  no hang) and a wrong stated state. `post_gtao` needs position and normal as well as depth, so a depth-only
  GTAO is still to come. No hardware GPU run yet. ADR 0020; bounds in `evidence/host-frame-bounds.json`.
