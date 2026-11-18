#pragma once
// Private to src/tools/lwshell/: the shell's frame on the RHI. One frame graph a frame:
//   scene  sky, terrain and capsule into a linear RGBA16Float target with a Depth32Float target
//   post   tone map into the swapchain's backbuffer, then Present
// with GPU timestamps around each draw, read back after the frame as per-pass zones.
#include "lw_game.h"
#include "raw/rhi/rhi.hpp"
#include <cstdint>
#include <string>
#include <vector>
namespace raw::lwshell {

struct GpuZone { const char* name; double startMs, durMs; };

class Renderer {
public:
    // Pipelines, the height buffer from the game's own vertex heights, and the size targets.
    bool init(rhi::Device& dev, rhi::TextureFormat backbuffer, ::Game* game, uint32_t w, uint32_t h, std::string& err);
    bool resize(rhi::Device& dev, uint32_t w, uint32_t h, std::string& err);
    void release(rhi::Device& dev);
    // Draw and present one frame from the view. When shotPath is set, the presented image is also
    // read back and written as a PNG. `zones` gets the GPU zones in ms from the first timestamp.
    bool frame(rhi::Device& dev, rhi::Swapchain& sc, const LwView& v, uint32_t syncInterval, const std::string& shotPath,
               std::vector<GpuZone>& zones, rhi::PresentStatus& status, std::string& err);
    uint64_t terrainTriangles() const { return uint64_t(gw_ - 1) * (gd_ - 1) * 2; }
private:
    bool makeTargets(rhi::Device& dev, uint32_t w, uint32_t h, std::string& err);
    void dropTargets(rhi::Device& dev);
    rhi::RasterPipelineHandle sky_, terrain_, capsule_, post_;
    rhi::BufferHandle heights_, uniform_, readback_;
    rhi::TextureHandle scene_, depth_;
    uint32_t w_{0}, h_{0}, gw_{0}, gd_{0};
    float cell_{64};
};

}  // namespace raw::lwshell
