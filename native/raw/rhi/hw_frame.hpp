#pragma once
// The hero frame: a night street rendered on DXR inline ray queries (HW workstream; the D3D12
// backend is src/rhi/d3d12/hf_*.cpp, its shaders src/rhi/d3d12/hw_shaders/hf_*.hlsl). The scene
// arrives as plain arrays, so the caller (src/tools/lwframe/) owns files and formats.
//
// Passes, in order, each timed on the GPU:
//   clusters   lights into a 32 x 18 x 48 froxel grid (the cluster list the direct, GI and fog passes read)
//   gbuffer    raster of every triangle, parallax occlusion mapping on height, wear from vertex data
//   gtao       GTAO (src/renderer/gpu/shaders/hlsl/post_gtao.hlsl, unchanged) on a packed view-space G-buffer
//   direct     moon by an RT cone shadow; lamps by ReSTIR DI (RIS over the cluster, temporal and
//              spatial reuse, one shadow ray); snow scattering and glints
//   gi         one diffuse RT bounce a pixel, lit at its hit by the moon and one lamp with shadow rays
//   reflect    one GGX RT ray a pixel for glossy surfaces (ice, wet stone, glass, iron)
//   fog        froxel scattering from the moon and the cluster's lamps, each with an RT shadow ray,
//              integrated front to back
//   denoise    temporal accumulation and an a-trous wavelet filter on diffuse and specular
//   composite  materials times lighting, fog, sky
//   snow       falling snow, lit by the moon and the nearest lamps
//   taa        reprojected history with neighbourhood clipping
//   post       bloom, exposure, filmic tone map
// `reference` replaces all of that with a path tracer over the same scene, materials and lights.
#include "raw/rhi/rhi.hpp"
#include <array>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>
namespace raw::rhi::hw {

struct FrameVertex { float p[3], n[3], t[4], uv[2], c[4]; };     // 64 bytes
struct FrameMaterial {
    // two RGBA8 textures (indices into FrameScene::textures, -1 none): albedo (sRGB) + height,
    // and normal xy (OpenGL convention) + roughness + ambient occlusion
    int32_t texA{-1}, texB{-1};
    float uvScale{1}, heightScale{0};    // uv units a texture repeat; parallax depth in metres
    float tint[3]{1, 1, 1};
    float roughScale{1}, roughBias{0}, metal{0};
    uint32_t kind{0};                    // see hf_common.hlsli: K_OPAQUE, K_SNOW, K_GROUND, K_GLASS, K_ICE, K_LAMP, K_SIGN
    float pad{0};
};
struct FrameTexture { uint32_t width{0}, height{0}, mips{0}; bool srgb{true}; std::vector<uint8_t> rgba; };  // all mips, largest first
struct FrameLight { float p[3], radius, col[3], power, aim[3], cone; };   // cone: cos of the half angle; 0 a full sphere
struct FrameCamera { float eye[3], yaw, pitch, fovDeg; };
struct FrameScene {
    std::vector<FrameVertex> vertices;
    std::vector<uint32_t> indices;          // triangles
    std::vector<uint32_t> triMaterial;      // a material a triangle
    std::vector<FrameMaterial> materials;
    std::vector<FrameTexture> textures;
    std::vector<FrameLight> lights;
    std::vector<std::array<float, 4>> smoke;   // chimney tops that draw: x y z, strength
    uint32_t skyW{0}, skyH{0};
    std::vector<float> sky;                 // equirectangular RGB radiance, the moon taken out
    float moonDir[3]{0, 1, 0}, moonRadiance[3]{0, 0, 0}, moonHalfAngle{0.0045f};
    float skyRotate{0};                     // radians about up
};

// Pass switches for the "each pass off" stills, and the frame's look.
struct FrameOptions {
    uint32_t width{3840}, height{2160};
    bool gi{true}, reflect{true}, gtao{true}, fog{true}, restir{true}, snow{true}, taa{true}, glints{true}, sss{true}, shadows{true}, pom{true}, bloom{true};
    uint32_t frames{64};          // frames accumulated before the still (a static camera converges)
    float exposureEV{0};          // added to the base exposure
    bool reference{false};        // the path tracer instead
    uint32_t referenceSpp{1024}, referenceBounces{6};
    float time{0};                // seconds, for the falling snow
    uint32_t debugView{0};        // 0 the frame; 1 GI irradiance, 2 direct irradiance, 3 albedo (each before the tone map)
};
struct PassTime { std::string name; double ms; };
struct FrameResult {
    bool ran{false};
    std::string error;
    std::vector<float> hdr;               // width * height * 4, linear, before tone mapping
    std::vector<uint8_t> ldr;             // width * height * 4, sRGB after post
    std::vector<PassTime> passes;         // GPU ms of each pass in the last frame (median over the last frames)
    double frameMs{0};                    // GPU ms of the whole last frame
    double buildMs{0};                    // acceleration structure builds
    uint64_t triangles{0}, blasBytes{0}, tlasBytes{0}, textureBytes{0}, targetBytes{0};
};

// One renderer that keeps its device resources across calls, so a camera move renders frame
// after frame without uploading the scene again.
class FrameRenderer {
public:
    virtual ~FrameRenderer() = default;
    // Render `opt.frames` frames at the camera (or the path tracer's samples) and read the last back.
    virtual FrameResult render(const FrameCamera& cam, const FrameOptions& opt) = 0;
    // A new camera without clearing the history (for a camera move), one frame, read back.
    virtual FrameResult step(const FrameCamera& cam, const FrameOptions& opt) = 0;
    static std::unique_ptr<FrameRenderer> create(Device& dev, const FrameScene& scene, uint32_t width, uint32_t height, std::string& err);
};

}  // namespace raw::rhi::hw
