#pragma once
// Private to src/tools/lwframe/: the hero frame tool. It reads what the Low Water hero kit wrote
// (games/low-water/world/walk/build/hero/emit.mjs: a .glb and a .frame.json), binds its materials
// to scanned texture sets, reads a night sky, and drives raw/rhi/hw_frame.hpp.
#include "raw/rhi/hw_frame.hpp"
#include "raw/scene/skin.hpp"
#include <functional>
#include <map>
#include <string>
#include <utility>
#include <vector>
namespace raw::lwframe {

struct MaterialSpec {
    std::string name, dir, color, normal, rough, ao, disp;   // folder and map file names
    bool normalDx{false};
    float uvScale{1}, heightScale{0}, tint[3]{1, 1, 1}, roughScale{1}, roughBias{0}, metal{0};
    uint32_t kind{0};
};
struct Cameras { rhi::hw::FrameCamera main, close; bool hasClose{false}; std::vector<rhi::hw::FrameCamera> walk; std::map<std::string, rhi::hw::FrameCamera> views; };

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

// The hero characters (lwframe_chars.cpp): people placed from a list file
//   { "dir": DIR, "people": [{ "id", "lod", "x", "y", "z", "yaw", "clip", "phase", "walks" }] }
// each read from DIR/<id>.char.json and DIR/<id>.lod<N>.glb (games/low-water/characters/hero).
struct Clip { double fps{30}, speed{0}; uint32_t frames{1}; std::vector<anim::Quat> rot; std::vector<anim::Vec3d> root; };
struct Person {
    std::string id, clip; uint32_t lod{0};
    double x{0}, y{0}, z{0}, yaw{0}, phase{0}; bool walks{false};
    anim::Skeleton sk; std::map<std::string, Clip> clips;
    uint32_t jointBase{0}, firstVertex{0}, vertexCount{0}, firstTriangle{0}, triangles{0};
    std::vector<float> bindPos, weights; std::vector<uint16_t> joints;   // for the CPU parity check
    int light{-1}, lightJoint{-1}; anim::Vec3d lightOffset{}; rhi::hw::FrameLight lightProto{};
};
struct Cast { std::vector<Person> people; };
bool loadCharacters(const std::string& list, const std::string& assetRoot, rhi::hw::FrameScene& scene, Cast& cast, std::string& err);
// one person's skinning matrices (world from bind) at time t; the lantern's place if asked
std::vector<anim::Mat> skinAt(const Person& p, double t, double extraYaw, anim::Vec3d* lightPos);
// everyone's palette (12 floats a joint) and the lights that move with them; extraYaw turns the first
void castFrame(const Cast& cast, double t, std::vector<float>& palette, std::vector<std::pair<int, rhi::hw::FrameLight>>& lights, double extraYaw = 0);
// lwframe_shots.cpp: the jobs street, portrait, charref, turn, cwalk, parity
// lwframe_looks.cpp: the versions of one place from a looks file
//   { "looks": [{ "name", "camera": NAME | {eye, yaw, pitch, fov}, "ev", "frames", "time",
//                 "fog": [density, falloff, g, reach], "sky", "moon", "snow": false | [speed, wind x, wind z, flakes],
//                 "wb": [r, g, b], "saturation", "contrast", "lift": [r, g, b], "vignette",
//                 "lens": "tilt" | "oil" | "ink", "focus", "band", "strength", "fogAmbient", "skyTurn", "flip": SPP }] }
// NAME is main, close or one of the frame file's "views". Each look renders and saves as NAME.png.
bool runLooks(rhi::hw::FrameRenderer& R, const Cameras& cams, const rhi::hw::FrameOptions& base, const std::string& path,
              const std::function<bool(const char*, const rhi::hw::FrameResult&)>& save, std::string& err);
bool characterShots(rhi::hw::FrameRenderer& R, const Cast& cast, const rhi::hw::FrameOptions& base, const std::string& jobs, const std::string& out,
                    const std::function<bool(const char*, const rhi::hw::FrameResult&)>& save, std::string& log);

}  // namespace raw::lwframe
