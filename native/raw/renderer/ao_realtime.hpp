#pragma once
// Real-time ambient occlusion: the GTAO integral of post_gtao at a frame budget. It traces
// two noisy slices a pixel at half resolution, accumulates the result over frames
// along motion vectors, and resolves to full resolution with depth weights. post_gtao stays
// the reference; this pass is scored against it (evidence/ao-realtime-bounds.json).
//
// It records five full-screen raster passes through the RHI, so it runs on any device that
// takes its shaders (D3D12 today: src/rhi/d3d12/hw_shaders/ao_rt.hlsl) and inside a host
// frame (raw/rhi/host.hpp). The caller owns the inputs:
//   depth    R32Float, the depth buffer with depth = projA - projB / viewZ, 1 where empty
//   normal   RGBA8Unorm view-space normals, rgb * 2 - 1 or the spheremap form (Params)
//   motion   RG16Float, previous uv = uv + motion * mvScale; invalid means a still frame
//   frame    the image the visibility multiplies
//   target   a colour target of the frame's format, the same size
#include "raw/rhi/rhi.hpp"
#include <cstdint>
#include <string>
#include <vector>
namespace raw::ao_rt {

// Blue noise by void and cluster (Ulichney 1993), written here: a size x size torus of ranks
// 0 .. size*size-1, each once, where every prefix of the ranks is spread evenly. `size` is a
// power of two. Deterministic for a seed.
std::vector<uint16_t> blueNoise(uint32_t size, uint32_t seed);
// The variance of the 4 x 4 block means of rank / (size*size), over the white-noise value
// 1 / (12 * 16): well under 1 for blue noise, near 1 for white noise.
double lowFrequencyRatio(const std::vector<uint16_t>& ranks, uint32_t size);

struct Shaders { rhi::ShaderCode vs, prefilter, level, trace, resolve; };
struct Inputs { rhi::TextureHandle depth, normal, motion, frame, target; };
struct Params {
    float projA{1}, projB{1}, tanHalf{1}, aspect{1};
    float radius{0.5f}, strength{1};
    uint32_t slices{2}, steps{16};
    bool noise{true};        // per-pixel slice turn and step offset; off: the fixed slices of post_gtao
    bool temporal{true};     // accumulate over frames; also cycles which pixel of each 2 x 2 is traced
    bool levels{true};       // far steps read coarser levels of the depth hierarchy
    bool spheremap{false};   // normal = Lambert azimuthal xy with z into the screen
    bool srgb{true};         // the frame is sRGB-encoded: multiply in linear light
    uint32_t mode{1};        // 0 pass the frame through, 1 apply, 2 show the visibility
    float mvScale[2]{1, 1};
    float zTol{0.1f};        // a history texel further than this fraction of the depth is another surface
    float maxHistory{32};    // frames the running mean may hold
    float levelBias{1};      // level = log2(step spacing in half-resolution texels) - levelBias, clamped to 0 .. 3
    float upSharp{10000};    // depth weight of the upsample: exp2(-rel^2 * upSharp)
};

class Pass {
public:
    // Half-resolution levels, the history pair and the pipelines for a width x height frame.
    bool create(rhi::Device& dev, uint32_t width, uint32_t height, rhi::TextureFormat frameFormat, const Shaders& sh,
                std::string& err);
    // One frame into the open list. Writes timestamps firstSlot+1 (depth levels done),
    // +2 (trace done) and +3 (resolve done); the caller stamps firstSlot before.
    void record(rhi::CommandList& c, const Inputs& in, const Params& p, uint32_t firstSlot);
    // The frame record() last wrote: visibility in x, view depth in y, frames accumulated in z
    // (RGBA16Float, full size).
    rhi::TextureHandle history() const { return hist_[frames_ & 1u]; }
    void resetHistory() { frames_ = 0; }
    uint64_t frames() const { return frames_; }
    static constexpr uint32_t kNoiseSize = 64;
private:
    rhi::Device* dev_{nullptr};
    uint32_t w_{0}, h_{0}, hw_{0}, hh_{0};
    rhi::TextureHandle z_[4], ao_, hist_[2], noise_, still_;
    rhi::RasterPipelineHandle prefilter_, level_, trace_, resolve_;
    rhi::SamplerHandle point_;
    rhi::BufferHandle uniform_;
    uint64_t frames_{0}, clock_{0};
    bool sent_{false};
};
}
