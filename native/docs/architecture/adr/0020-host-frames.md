# ADR 0020: host frames, the RHI inside another application's frame

**Status:** Accepted for the D3D12 backend. **Date:** 2026-11-17. **Builds on:** 0002 (the RHI),
N2 (devices the caller owns).

## Context

RAW's D3D12 bridge (HarperZ9/raw, `docs/D3D12_BRIDGE.md`) runs a D3D12 pass inside Skyrim's
D3D11 frame. The bridge owns a D3D12 device on the game's adapter, a queue, textures shared
with D3D11 and one fence shared with D3D11. Its pass seam is meant for this renderer.

The RHI could not sit behind that seam. It always made its own device and queue, every texture
was one it had created, and its only submission was `submitAndWait`, which blocks the caller
until the GPU is done.

The bridge's first in-game runs also found an ordering rule. D3D11 rejected `Signal(n)` on the
shared fence once D3D12 had a later value queued on it. The fix was to record the D3D12 list
first and send it only after D3D11 has signalled and flushed.

## Decision

Three additions to the RHI, declared in `raw/rhi/host.hpp` and implemented in
`src/rhi/d3d12/d3d12_host.cpp`. Native objects cross the interface as `void*`, so the rule that
only a backend includes an API header still holds.

1. **`adoptDevice(HostDevice)`** makes a device on the host's `ID3D12Device` and direct
   `ID3D12CommandQueue`. It creates no device and no queue. Its allocator, command list,
   descriptor heaps and private fence live on the host's device.
2. **`Device::importTexture(ExternalTextureDesc)`** wraps a host `ID3D12Resource` as a
   `TextureHandle`. The description states the state the texture is in outside a submission. The
   backend assumes that state at `begin()` and returns the texture to it as the last commands of
   the list. `destroyTexture` forgets the record and releases one reference. Colour formats
   only: depth crosses as `R32Float`, which is what the bridge shares.
3. **A submission in three steps.** `endRecording()` closes the list and queues nothing.
   `submit(FenceSync)` issues queue `Wait` on the host's fence, the list, then queue `Signal`,
   and returns at once. `retire(timeoutMs)` waits on the device's private fence and answers
   `Done`, `TimedOut` or `Failed`. `begin()` retires a pending submission first and refuses
   when it does not end in `HostDevice::retireTimeoutMs`. `submitAndWait` is now these three
   calls with no host fence and no timeout.

The split puts the bridge's ordering rule in the caller's hands: record, let the host signal
and flush, then `submit`.

## Consequences

- A wrong stated state on an imported texture is a wrong barrier. D3D12 offers no way to ask a
  resource for its state, so only the debug layer reports it. `HostDevice::debugLayerErrorsFail`
  turns its errors into failed submissions.
- A fence value nobody signals blocks the host's queue. `retire` reports it as `TimedOut`; the
  host releases the queue by signalling from the CPU.
- View slots of forgotten host textures are reused, so a host that re-imports on every resize
  does not run out of descriptors.
- The check is `gpu_host_frame` (`raw/renderer/host_frame.hpp`, bounds in
  `evidence/host-frame-bounds.json`). A stand-in host makes the device, queues, textures and
  fence; `post_gtao` runs into its target; the host reads the target back with its own commands.
- `post_gtao` reads view position and normal as well as depth. The check's host therefore hands
  over a depth texture (`R32Float`), a position texture and a normal texture. A GTAO that works
  from depth alone has no reference here yet.
- Vulkan and WebGPU refuse the four calls with a reason.

## Alternatives

- **An LUID constructor** (the RHI opens its own device on the host's adapter). A D3D12
  resource belongs to one device, so each texture would need a second shared handle and each
  frame a second fence crossing between the bridge's device and the RHI's.
- **A callback into the host for barriers.** The host would need to know the RHI's internal
  states. One stated boundary state per texture keeps the contract in one field.
- **`copyBufferToTexture` on the command list**, to move a compute pass's output into a host
  texture. A draw with the existing storage-buffer binding does it with no interface change.

## Reversal signal

A second host whose queue cannot be shared (a host that submits from several threads without a
lock the RHI can take) would call for the RHI to hand back a closed command list for the host
to execute, in place of `submit`.
