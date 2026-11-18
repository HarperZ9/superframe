// The real-time AO pass on the RHI (raw/renderer/ao_realtime.hpp): textures, pipelines and
// the five passes of one frame. Shaders: src/rhi/d3d12/hw_shaders/ao_rt.hlsl.
#include "raw/renderer/ao_realtime.hpp"
#include <algorithm>
namespace raw::ao_rt {
namespace {
using namespace rhi;
struct Uniform {   // cbuffer P of ao_rt.hlsl
    uint32_t W, H, hw, hh;
    float projA, projB, tanHalf, aspect;
    float radius, strength; uint32_t slices, steps;
    uint32_t frame, flags, subX, subY;
    float mvScale[2], zTol, maxHistory;
    uint32_t mode, noiseSize; float upSharp, levelBias;
};
static_assert(sizeof(Uniform) == 96);
constexpr uint32_t kNoise = 1, kTemporal = 2, kLevels = 4, kSpheremap = 8, kSrgb = 16;
constexpr RasterBinding kOneTexture[2] = {RasterBinding::Uniform, RasterBinding::Texture};
constexpr RasterBinding kTrace[8] = {RasterBinding::Uniform, RasterBinding::Texture, RasterBinding::Texture, RasterBinding::Texture,
                                     RasterBinding::Texture, RasterBinding::Texture, RasterBinding::Texture, RasterBinding::Sampler};
constexpr RasterBinding kSixTextures[7] = {RasterBinding::Uniform, RasterBinding::Texture, RasterBinding::Texture, RasterBinding::Texture,
                                           RasterBinding::Texture, RasterBinding::Texture, RasterBinding::Texture};

RasterPipelineHandle pipeline(Device& dev, const char* label, const ShaderCode& vs, const ShaderCode& fs,
                              std::span<const RasterBinding> layout, TextureFormat t0, const TextureFormat* t1, std::string& err) {
    RasterPipelineDesc d;
    d.label = label; d.vertex = vs; d.fragment = fs; d.layout = layout;
    d.targets[0] = t0;
    if (t1) { d.targets[1] = *t1; d.targetCount = 2; }
    return dev.createRasterPipeline(d, err);
}
}  // namespace

bool Pass::create(Device& dev, uint32_t width, uint32_t height, TextureFormat frameFormat, const Shaders& sh, std::string& err) {
    if (width < 32 || height < 32) { err = "ao_rt: the frame is at least 32 x 32"; return false; }
    dev_ = &dev; w_ = width; h_ = height; hw_ = (width + 1) / 2; hh_ = (height + 1) / 2;
    const TextureUsage target = TextureUsage::RenderTarget | TextureUsage::Sampled;
    static const char* const kLevelName[4] = {"ao_rt z0", "ao_rt z1", "ao_rt z2", "ao_rt z3"};
    for (uint32_t l = 0; l < 4; ++l) {
        z_[l] = dev.createTexture({std::max(hw_ >> l, 1u), std::max(hh_ >> l, 1u), TextureFormat::R32Float, target, kLevelName[l]}, err);
        if (!z_[l].valid()) return false;
    }
    ao_ = dev.createTexture({hw_, hh_, TextureFormat::R32Float, target, "ao_rt trace"}, err);
    for (auto& h : hist_)
        h = dev.createTexture({w_, h_, TextureFormat::RGBA16Float, target | TextureUsage::CopySrc, "ao_rt history"}, err);
    noise_ = dev.createTexture({kNoiseSize, kNoiseSize, TextureFormat::RGBA8Unorm, TextureUsage::Sampled | TextureUsage::CopyDst, "ao_rt noise"}, err);
    still_ = dev.createTexture({1, 1, TextureFormat::RG16Float, TextureUsage::Sampled | TextureUsage::CopyDst, "ao_rt still"}, err);
    point_ = dev.createSampler({Filter::Nearest, AddressMode::ClampToEdge, "ao_rt point"}, err);
    uniform_ = dev.createBuffer({sizeof(Uniform), BufferUsage::Uniform, "ao_rt params"}, err);
    if (!ao_.valid() || !hist_[0].valid() || !hist_[1].valid() || !noise_.valid() || !still_.valid() || !point_.valid() || !uniform_.valid()) return false;
    const TextureFormat r32 = TextureFormat::R32Float;
    prefilter_ = pipeline(dev, "ao_rt_prefilter", sh.vs, sh.prefilter, kOneTexture, r32, nullptr, err);
    level_ = pipeline(dev, "ao_rt_level", sh.vs, sh.level, kOneTexture, r32, nullptr, err);
    trace_ = pipeline(dev, "ao_rt_trace", sh.vs, sh.trace, kTrace, r32, nullptr, err);
    resolve_ = pipeline(dev, "ao_rt_resolve", sh.vs, sh.resolve, kSixTextures, TextureFormat::RGBA16Float, &frameFormat, err);
    sent_ = false; frames_ = 0; clock_ = 0;
    return prefilter_.valid() && level_.valid() && trace_.valid() && resolve_.valid();
}

void Pass::record(CommandList& c, const Inputs& in, const Params& p, uint32_t firstSlot) {
    if (!sent_) {
        // Ranks as 16 bits in two bytes; the still texture is one texel of zero motion (reads
        // outside it return zero too).
        const std::vector<uint16_t> ranks = blueNoise(kNoiseSize, 1);
        std::vector<uint8_t> texels(size_t(kNoiseSize) * kNoiseSize * 4, 0);
        for (size_t i = 0; i < ranks.size(); ++i) {
            const uint32_t v = uint32_t(ranks[i]) * (65536u / (kNoiseSize * kNoiseSize));
            texels[i * 4] = uint8_t(v >> 8); texels[i * 4 + 1] = uint8_t(v & 255u);
        }
        c.uploadTexture(noise_, texels.data(), kNoiseSize, kNoiseSize);
        const uint32_t zero = 0;
        c.uploadTexture(still_, &zero, 1, 1);
        sent_ = true;
    }
    // With accumulation on, the traced pixel of each 2 x 2 block moves through all four in
    // four frames, so the history gathers full-resolution detail.
    static constexpr uint32_t kSub[4][2] = {{0, 0}, {1, 1}, {1, 0}, {0, 1}};
    const bool history = p.temporal && frames_ > 0;
    const uint32_t sub = p.temporal ? uint32_t(clock_ & 3u) : 0u;
    Uniform u{};
    u.W = w_; u.H = h_; u.hw = hw_; u.hh = hh_;
    u.projA = p.projA; u.projB = p.projB; u.tanHalf = p.tanHalf; u.aspect = p.aspect;
    u.radius = p.radius; u.strength = p.strength; u.slices = std::max(p.slices, 1u); u.steps = std::max(p.steps, 1u);
    u.frame = p.temporal ? uint32_t(clock_) : 0u;
    u.flags = (p.noise ? kNoise : 0u) | (history ? kTemporal : 0u) | (p.levels ? kLevels : 0u) | (p.spheremap ? kSpheremap : 0u) |
              (p.srgb ? kSrgb : 0u);
    u.subX = kSub[sub][0]; u.subY = kSub[sub][1];
    u.mvScale[0] = p.mvScale[0]; u.mvScale[1] = p.mvScale[1]; u.zTol = p.zTol; u.maxHistory = std::max(p.maxHistory, 1.0f);
    u.mode = p.mode; u.noiseSize = kNoiseSize; u.upSharp = p.upSharp; u.levelBias = p.levelBias;
    c.upload(uniform_, 0, &u, sizeof u);

    const auto pass = [&](TextureHandle target, RasterPipelineHandle pipe, std::span<const RasterBind> binds) {
        RenderPassDesc rp;
        rp.color[0].texture = target;
        c.beginRenderPass(rp);
        c.draw(pipe, binds, 3);
        c.endRenderPass();
    };
    const RasterBind pre[2] = {{uniform_, {}, {}}, {{}, in.depth, {}}};
    pass(z_[0], prefilter_, pre);
    for (uint32_t l = 1; l < 4; ++l) {
        const RasterBind down[2] = {{uniform_, {}, {}}, {{}, z_[l - 1], {}}};
        pass(z_[l], level_, down);
    }
    c.timestamp(firstSlot + 1);
    const RasterBind trace[8] = {{uniform_, {}, {}}, {{}, z_[0], {}}, {{}, z_[1], {}}, {{}, z_[2], {}}, {{}, z_[3], {}},
                                 {{}, in.normal, {}}, {{}, noise_, {}}, {{}, {}, point_}};
    pass(ao_, trace_, trace);
    c.timestamp(firstSlot + 2);
    const TextureHandle before = hist_[frames_ & 1u], after = hist_[(frames_ + 1) & 1u];
    const RasterBind resolve[7] = {{uniform_, {}, {}}, {{}, ao_, {}}, {{}, z_[0], {}}, {{}, in.depth, {}},
                                   {{}, in.motion.valid() ? in.motion : still_, {}}, {{}, before, {}}, {{}, in.frame, {}}};
    RenderPassDesc rp;
    rp.colorCount = 2;
    rp.color[0].texture = after;
    rp.color[1].texture = in.target;
    c.beginRenderPass(rp);
    c.draw(resolve_, resolve, 3);
    c.endRenderPass();
    c.timestamp(firstSlot + 3);
    ++frames_; ++clock_;
}
}  // namespace raw::ao_rt
