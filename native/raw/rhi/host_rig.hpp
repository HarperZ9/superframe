#pragma once
// A stand-in for a host application, for the host-frame check (raw/renderer/host_frame.hpp;
// bounds in evidence/host-frame-bounds.json). It plays the part RAW's D3D12 bridge plays in
// a game: it makes its own D3D12 device with the debug layer on, a frame queue it hands to
// the RHI, a second queue that stands for the producer of the frame's inputs (the game's
// D3D11 device in the bridge), its own textures and one fence. It fills and reads its
// textures with its own command lists, so what the check compares is what a host would see.
// Defined by the d3d12 backend only; no D3D12 header is needed to use it.
#include "raw/rhi/host.hpp"
#include <cstdint>
#include <memory>
#include <string>
#include <vector>
namespace raw::rhi::host_rig {

class Rig {
public:
    // The adapter follows the backend's rule: WARP with RAW_NATIVE_D3D12_WARP=1, the first
    // hardware adapter otherwise. Null with the reason when there is no adapter or the debug
    // layer is not installed; the check then reports a skip, never a pass.
    static std::unique_ptr<Rig> create(std::string& err);
    ~Rig();
    HostDevice host() const;        // the device and the frame queue
    void* fence() const;            // the fence the producer signals and the RHI waits on
    std::string adapter() const;
    // A texture the rig owns, left in `state` holding `texels` (tight rows, top row first).
    // `target` allows render targets. Null with the reason on failure.
    void* texture(uint32_t w, uint32_t h, TextureFormat f, bool target, TextureState state, const void* texels, std::string& err);
    // The producer queue writes `texels` into a texture that is in `state` and leaves it there.
    bool fill(void* texture, TextureState state, const void* texels, std::string& err);
    // The frame queue copies a texture that is in `state` out as tight rows.
    bool readback(void* texture, TextureState state, std::vector<uint8_t>& out, std::string& err);
    // The producer queue signals the fence, after everything it was given before.
    bool producerSignal(uint64_t value, std::string& err);
    // Signal from the CPU: how a host releases a queue stuck on a value nobody signalled.
    void cpuSignal(uint64_t value);
    uint64_t completed() const;
    // COM references on the device, the frame queue, the fence or a texture of the rig.
    unsigned long references(void* object) const;
    struct Impl;
private:
    Rig() = default;
    std::unique_ptr<Impl> m;
};
// A hand-written shader of the host-frame check (src/rhi/d3d12/hw_shaders/host_*.hlsl).
ShaderCode shader(const char* name);

}  // namespace raw::rhi::host_rig
