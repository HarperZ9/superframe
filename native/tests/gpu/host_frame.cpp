// The host-frame check on the D3D12 backend (bounds in evidence/host-frame-bounds.json): the
// RHI on a host's device, queue, textures and fence, post_gtao into the host's target, and
// the controls. Without an adapter or the debug layer it exits 77 (skipped, never passed).
// CI runs it on WARP with RAW_NATIVE_D3D12_WARP=1, where 77 fails the step.
//   host_frame [out.json]
#include "raw/renderer/host_frame.hpp"
#include <cstdio>
#include <fstream>
int main(int argc, char** argv) {
    const raw::gpu_check::HostFrame r = raw::gpu_check::hostFrame();
    const std::string j = r.json();
    std::fputs(j.c_str(), stdout);
    if (argc > 1) std::ofstream(argv[1], std::ios::binary) << j;
    if (!r.skipped.empty()) { std::printf("skipped: %s\n", r.skipped.c_str()); return 77; }
    return r.pass() ? 0 : 1;
}
