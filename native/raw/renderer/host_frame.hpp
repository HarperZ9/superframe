#pragma once
// The host-frame check (bounds in evidence/host-frame-bounds.json): the RHI renders inside a
// frame it does not own. A stand-in host (raw/rhi/host_rig.hpp) makes its own D3D12 device,
// queues, textures and fence and hands them over; the RHI adopts the device, imports the
// textures, runs post_gtao into the host's target between a wait and a signal on the host's
// fence, and the host reads its target back with its own commands. The comparison is
// post_parity's: raw::post::gtao on the same view G-buffer, 1e-3 a pixel, 0.1% of pixels.
// Controls that must fail: the target before the pass, a fence value nobody signals (a
// timeout, never a hang) and a wrong stated state on an imported texture.
// D3D12 only: the rig exists in the d3d12 backend.
#include <cstdint>
#include <string>
namespace raw::gpu_check {

struct HostFrame {
    std::string error;                 // a step that could not run; the check then fails
    std::string skipped;               // no adapter or no debug layer: nothing was checked
    std::string backend, adapter, hostAdapter;
    int size{0};
    // Adoption.
    bool adoptRefusesNothing{false};   // a host with no device is refused
    bool sameAdapter{false};           // the adopted device reports the host's adapter
    bool importRefusesWrongFormat{false};
    // The frame: the host's read-back of its target against raw::post::gtao.
    long pixels{0}, gtaoOutside{0};    // pixels with geometry; of those, |host - cpu| > 1e-3
    double gtaoWorst{0};
    bool fenceSignalled{false};        // the host's fence reached the value the frame signals
    bool targetBeforeDiffers{false};   // control: the target before the pass is outside the bound
    // Control: a wait on a value nobody signals.
    bool unsignalledTimesOut{false};   // retire() answered TimedOut and the fence had not moved
    uint32_t unsignalledWaitMs{0};     // how long that answer took (asked for 750 ms)
    bool unsignalledBlocksBegin{false};// begin() refused while the submission was pending
    bool releasedRetires{false};       // after the host signalled from the CPU the submission ended
    // Control: the stated state of an imported texture.
    bool rightStatePasses{false}, wrongStateFails{false};
    std::string wrongStateMessage;
    // Ownership after the RHI device is gone.
    bool texturesSurvive{false};       // reference counts as before the import; the target reads the same
    bool hostObjectsReleased{false};   // device, queue and fence reference counts as before adoption
    bool frame() const { return pixels > 0 && double(gtaoOutside) <= 1e-3 * double(pixels); }
    bool pass() const;
    std::string json() const;
};
// One run at size x size on the built-in test scene, post_parity's first scene.
HostFrame hostFrame(int size = 256);

}  // namespace raw::gpu_check
