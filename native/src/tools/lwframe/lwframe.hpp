#pragma once
// Private to src/tools/lwframe/: the hero frame tool. It reads what the Low Water hero kit wrote
// (games/low-water/world/walk/build/hero/emit.mjs: a .glb and a .frame.json), binds its materials
// to scanned texture sets, reads a night sky, and drives raw/rhi/hw_frame.hpp.
#include "raw/rhi/hw_frame.hpp"
#include <string>
#include <vector>
namespace raw::lwframe {

struct MaterialSpec {
    std::string name, dir, color, normal, rough, ao, disp;   // folder and map file names
    bool normalDx{false};
    float uvScale{1}, heightScale{0}, tint[3]{1, 1, 1}, roughScale{1}, roughBias{0}, metal{0};
    uint32_t kind{0};
};
struct Cameras { rhi::hw::FrameCamera main, close; bool hasClose{false}; std::vector<rhi::hw::FrameCamera> walk; };

// The texture sets under the two CC0 folders (assetRoot holds cc0-ambientcg-* and cc0-polyhaven-*).
std::vector<MaterialSpec> materialSpecs(const std::string& assetRoot);
bool cookMaterials(const std::vector<MaterialSpec>& specs, std::vector<rhi::hw::FrameTexture>& out, std::string& err);
// BC7 (mode 6) in place of a texture's RGBA8 mips (lwframe_bc7.cpp)
void compressBc7(rhi::hw::FrameTexture& t);
// The scene from the kit's files; cameras from the frame file.
bool loadScene(const std::string& glb, const std::string& frameJson, const std::string& assetRoot, const std::string& hdr,
               rhi::hw::FrameScene& scene, Cameras& cams, std::string& err);
// A Radiance .hdr (RLE scanlines) as linear RGB; the moon found, measured and taken out.
bool loadSky(const std::string& path, float viewYaw, rhi::hw::FrameScene& scene, std::string& err);

}  // namespace raw::lwframe
