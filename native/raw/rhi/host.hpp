#pragma once
// Host frames: the RHI rendering inside another application's frame (bounds in
// evidence/host-frame-bounds.json). The host keeps its device, its command queue, its
// textures and its fence; the RHI records passes against them and never owns them. The
// first host is RAW's D3D12 bridge, which runs beside a game's D3D11 device.
//
// The native objects cross this header as void pointers, so no caller needs an API header:
// on D3D12 they are ID3D12Device*, ID3D12CommandQueue*, ID3D12Resource* and ID3D12Fence*.
// The RHI takes a reference on each for as long as it uses it and releases only that
// reference.
//
// One frame, in the order a host with a second device needs:
//   begin(), record, endRecording()     the list is recorded and closed, nothing is queued
//   the host signals its fence and flushes
//   submit({fence, wait, signal})       queue Wait, the list, queue Signal
//   retire(timeoutMs)                   or the next begin(), which waits the same way
// Sending the list only after the host has signalled matters when the host signals from
// another device: D3D11 refused Signal(n) on a shared fence once D3D12 had a later value
// queued on it (RAW docs/D3D12_BRIDGE.md, 2026-11-17).
#include "raw/rhi/rhi.hpp"
namespace raw::rhi {

struct HostDevice {
    void* device{nullptr};   // ID3D12Device*
    void* queue{nullptr};    // ID3D12CommandQueue*: a direct queue of that device
    // Fail a submission when the device's debug layer stored an error. The host must have
    // enabled the layer before it made the device. The RHI reads and clears the stored
    // messages, so an error the host caused since the last submission fails it too.
    bool debugLayerErrorsFail{false};
    // How long begin() waits for a submission that is still pending before it refuses.
    uint32_t retireTimeoutMs{2000};
};
// A device of the linked backend on the host's device and queue. It creates no device and no
// queue; its own allocator, command list, heaps and fence live on the host's device. Null
// with the reason when the backend has no host frames. Defined by the d3d12 and null backends.
std::unique_ptr<Device> adoptDevice(const HostDevice& host, std::string& err);

// The state a host texture is in whenever the RHI is not inside a submission.
enum class TextureState : uint8_t { Common, ShaderResource, RenderTarget, CopySrc, CopyDst };
// A 2D texture of the host: one mip level, one sample. The RHI assumes `state` when a
// submission starts and returns the texture to it as the submission's last commands. A wrong
// `state` is a wrong barrier: the D3D12 debug layer reports it and nothing else does.
// Formats: every colour format of TextureFormat. Depth crosses as R32Float.
// Usage: Sampled makes it bindable to a draw, RenderTarget makes it a colour target (the
// resource must allow it); every imported texture can be copied into a buffer.
struct ExternalTextureDesc {
    void* resource{nullptr};   // ID3D12Resource*
    TextureFormat format{TextureFormat::RGBA8Unorm};
    TextureUsage usage{TextureUsage::None};
    TextureState state{TextureState::Common};
};

// How a submission is ordered against the host's fence. With `wait` the queue waits on the
// GPU until the fence reaches waitValue before it runs the list; with `signal` it sets the
// fence to signalValue after the list. A value nobody signals blocks the queue, which
// retire() reports as TimedOut.
struct FenceSync {
    void* fence{nullptr};   // ID3D12Fence*
    bool wait{false};
    uint64_t waitValue{0};
    bool signal{false};
    uint64_t signalValue{0};
};
}
