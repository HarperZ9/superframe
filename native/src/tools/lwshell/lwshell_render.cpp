// The shell's frame on the RHI (see lwshell_render.hpp).
#include "lwshell_render.hpp"
#include "raw/graph/frame_graph.hpp"
#include "raw/tools/image_out.hpp"
#include "raw_lwshell_shaders.hpp"
#include <array>
#include <cmath>
#include <span>
#include <cstring>
#include <utility>
namespace raw::lwshell {
namespace {
rhi::ShaderCode blob(const char* name){
    for (const LwShellShaderBlob& b : kLwShellShaders)
        if (std::strcmp(b.name, name) == 0) return {kLwShellShaderFormat, b.bytes, b.size};
    return {};
}
using M4 = std::array<float, 16>;   // row major: m[r * 4 + c]
M4 mul(const M4& a, const M4& b){
    M4 o{};
    for (int r = 0; r < 4; ++r) for (int c = 0; c < 4; ++c){
        float s = 0; for (int k = 0; k < 4; ++k) s += a[r * 4 + k] * b[k * 4 + c];
        o[r * 4 + c] = s;
    }
    return o;
}
// The general inverse by cofactors; the view-projection is always invertible here.
M4 inverse(const M4& m){
    M4 inv{};
    inv[0] = m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4] = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8] = m[4]*m[9]*m[15] - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14] + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    inv[1] = -m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10];
    inv[5] = m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10];
    inv[9] = -m[0]*m[9]*m[15] + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9];
    inv[13] = m[0]*m[9]*m[14] - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9];
    inv[2] = m[1]*m[6]*m[15] - m[1]*m[7]*m[14] - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7] - m[13]*m[3]*m[6];
    inv[6] = -m[0]*m[6]*m[15] + m[0]*m[7]*m[14] + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7] + m[12]*m[3]*m[6];
    inv[10] = m[0]*m[5]*m[15] - m[0]*m[7]*m[13] - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7] - m[12]*m[3]*m[5];
    inv[14] = -m[0]*m[5]*m[14] + m[0]*m[6]*m[13] + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6] + m[12]*m[2]*m[5];
    inv[3] = -m[1]*m[6]*m[11] + m[1]*m[7]*m[10] + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7] + m[9]*m[3]*m[6];
    inv[7] = m[0]*m[6]*m[11] - m[0]*m[7]*m[10] - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7] - m[8]*m[3]*m[6];
    inv[11] = -m[0]*m[5]*m[11] + m[0]*m[7]*m[9] + m[4]*m[1]*m[11] - m[4]*m[3]*m[9] - m[8]*m[1]*m[7] + m[8]*m[3]*m[5];
    inv[15] = m[0]*m[5]*m[10] - m[0]*m[6]*m[9] - m[4]*m[1]*m[10] + m[4]*m[2]*m[9] + m[8]*m[1]*m[6] - m[8]*m[2]*m[5];
    const float det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
    for (float& v : inv) v /= det;
    return inv;
}
// Left-handed, y up, depth 0 at the near plane and 1 at the far plane (D3D's clip convention).
M4 viewProj(const LwView& v, float aspect){
    float f[3] = {float(v.at_x - v.eye_x), float(v.at_y - v.eye_y), float(v.at_z - v.eye_z)};
    float l = std::sqrt(f[0] * f[0] + f[1] * f[1] + f[2] * f[2]); for (float& c : f) c /= l;
    float r[3] = {f[2], 0, -f[0]};   // up x forward with up = +y
    l = std::sqrt(r[0] * r[0] + r[2] * r[2]); for (float& c : r) c /= l;
    const float u[3] = {f[1] * r[2] - f[2] * r[1], f[2] * r[0] - f[0] * r[2], f[0] * r[1] - f[1] * r[0]};
    const float e[3] = {float(v.eye_x), float(v.eye_y), float(v.eye_z)};
    auto dot = [&](const float* a){ return a[0] * e[0] + a[1] * e[1] + a[2] * e[2]; };
    const M4 view{r[0], r[1], r[2], -dot(r), u[0], u[1], u[2], -dot(u), f[0], f[1], f[2], -dot(f), 0, 0, 0, 1};
    const float zn = 0.1f, zf = 40000.0f, ys = 1.0f / std::tan(0.5f * 1.0472f), xs = ys / aspect;
    const M4 proj{xs, 0, 0, 0, 0, ys, 0, 0, 0, 0, zf / (zf - zn), -zn * zf / (zf - zn), 0, 0, 1, 0};
    return mul(proj, view);
}
struct FrameU {
    float viewProj[16];
    float eye[4], sun[4], capsule[4], heading[4];
    uint32_t grid[4];
    float inv[16];
};
constexpr uint32_t kRings = 16, kSegs = 24;   // the capsule's grid (rings must be even)
}  // namespace

bool Renderer::init(rhi::Device& dev, rhi::TextureFormat backbuffer, ::Game* game, uint32_t w, uint32_t h, std::string& err){
    if (dev.shaderFormat() != kLwShellShaderFormat){ err = "lwshell: the shaders are not in the device's format"; return false; }
    using RB = rhi::RasterBinding;
    static constexpr RB uOnly[] = {RB::Uniform};
    static constexpr RB uStorage[] = {RB::Uniform, RB::StorageRead};
    static constexpr RB tOnly[] = {RB::Texture};
    auto make = [&](const char* label, const char* vs, const char* fs, std::span<const RB> layout, rhi::TextureFormat target,
                    rhi::DepthState depth){
        rhi::RasterPipelineDesc d;
        d.label = label; d.vertex = blob(vs); d.fragment = blob(fs); d.layout = layout;
        d.targets[0] = target; d.targetCount = 1; d.depth = depth; d.cull = rhi::CullMode::None;
        return dev.createRasterPipeline(d, err);
    };
    const rhi::DepthState none{}, skyDepth{true, false, rhi::CompareFunc::Always}, solid{true, true, rhi::CompareFunc::Less};
    sky_ = make("lwshell sky", "sky_vs", "sky_fs", uOnly, rhi::TextureFormat::RGBA16Float, skyDepth);
    if (sky_.valid()) terrain_ = make("lwshell terrain", "terrain_vs", "terrain_fs", uStorage, rhi::TextureFormat::RGBA16Float, solid);
    if (terrain_.valid()) capsule_ = make("lwshell capsule", "capsule_vs", "capsule_fs", uOnly, rhi::TextureFormat::RGBA16Float, solid);
    if (capsule_.valid()) post_ = make("lwshell post", "post_vs", "post_fs", tOnly, backbuffer, none);
    if (!post_.valid()) return false;

    gw_ = uint32_t(lw_game_width(game)); gd_ = uint32_t(lw_game_depth(game)); cell_ = float(lw_game_cell(game));
    std::vector<float> hs(size_t(gw_) * gd_);
    for (uint32_t j = 0; j < gd_; ++j) for (uint32_t i = 0; i < gw_; ++i) hs[size_t(j) * gw_ + i] = float(lw_game_vertex(game, int32_t(i), int32_t(j)));
    heights_ = dev.createBuffer({hs.size() * 4, rhi::BufferUsage::Storage | rhi::BufferUsage::CopyDst, "lwshell heights"}, err);
    if (!heights_.valid()) return false;
    uniform_ = dev.createBuffer({sizeof(FrameU), rhi::BufferUsage::Uniform, "lwshell frame"}, err);
    if (!uniform_.valid()) return false;
    rhi::CommandList* cmd = dev.begin(err);
    if (!cmd) return false;
    cmd->upload(heights_, 0, hs.data(), hs.size() * 4);
    const rhi::BufferBarrier b[] = {{heights_, rhi::Access::CopyDst, rhi::Access::StorageRead}};
    cmd->barrier(b);
    if (!dev.submitAndWait(err)) return false;
    return makeTargets(dev, w, h, err);
}

bool Renderer::makeTargets(rhi::Device& dev, uint32_t w, uint32_t h, std::string& err){
    w_ = w; h_ = h;
    scene_ = dev.createTexture({w, h, rhi::TextureFormat::RGBA16Float, rhi::TextureUsage::RenderTarget | rhi::TextureUsage::Sampled, "lwshell scene"}, err);
    if (scene_.valid()) depth_ = dev.createTexture({w, h, rhi::TextureFormat::Depth32Float, rhi::TextureUsage::RenderTarget, "lwshell depth"}, err);
    if (depth_.valid()) readback_ = dev.createBuffer({uint64_t(rhi::textureRowPitch(w)) * h, rhi::BufferUsage::MapRead | rhi::BufferUsage::CopyDst, "lwshell readback"}, err);
    return readback_.valid();
}
void Renderer::dropTargets(rhi::Device& dev){
    if (scene_.valid()) dev.destroyTexture(scene_);
    if (depth_.valid()) dev.destroyTexture(depth_);
    if (readback_.valid()) dev.destroyBuffer(readback_);
    scene_ = depth_ = {}; readback_ = {};
}
bool Renderer::resize(rhi::Device& dev, uint32_t w, uint32_t h, std::string& err){ dropTargets(dev); return makeTargets(dev, w, h, err); }
void Renderer::release(rhi::Device& dev){
    dropTargets(dev);
    if (heights_.valid()) dev.destroyBuffer(heights_);
    if (uniform_.valid()) dev.destroyBuffer(uniform_);
    heights_ = uniform_ = {};
}

bool Renderer::frame(rhi::Device& dev, rhi::Swapchain& sc, const LwView& v, uint32_t syncInterval, const std::string& shotPath,
                     std::vector<GpuZone>& zones, rhi::PresentStatus& status, std::string& err){
    using rhi::Access;
    FrameU u{};
    const M4 vp = viewProj(v, float(w_) / float(h_)), inv = inverse(vp);
    std::memcpy(u.viewProj, vp.data(), sizeof u.viewProj);
    std::memcpy(u.inv, inv.data(), sizeof u.inv);
    const float sl = std::sqrt(0.55f * 0.55f + 0.35f * 0.35f + 0.76f * 0.76f);
    u.eye[0] = float(v.eye_x); u.eye[1] = float(v.eye_y); u.eye[2] = float(v.eye_z);
    u.sun[0] = -0.55f / sl; u.sun[1] = 0.35f / sl; u.sun[2] = 0.76f / sl; u.sun[3] = 2.6f;
    u.capsule[0] = float(v.x); u.capsule[1] = float(v.y); u.capsule[2] = float(v.z); u.capsule[3] = 0.35f;
    u.heading[0] = float(v.hx); u.heading[1] = float(v.hz); u.heading[2] = 1.8f; u.heading[3] = cell_;
    u.grid[0] = gw_; u.grid[1] = gd_; u.grid[2] = kRings; u.grid[3] = kSegs;
    const bool shot = !shotPath.empty();
    bool timed = true;

    graph::FrameGraph g(&dev);
    const graph::Resource image = g.createHost("scene");
    const graph::Resource rb = g.importBuffer("readback", readback_);
    g.addPass("scene", {{image, Access::StorageWrite}}, [&](graph::PassContext& c){
        c.cmd->upload(uniform_, 0, &u, sizeof u);
        timed = c.cmd->timestamp(0);
        rhi::RenderPassDesc rp; rp.color[0].texture = scene_; rp.depth = depth_;
        c.cmd->beginRenderPass(rp);
        const rhi::RasterBind ub[] = {{uniform_, {}, {}}};
        const rhi::RasterBind tb[] = {{uniform_, {}, {}}, {heights_, {}, {}}};
        c.cmd->draw(sky_, ub, 3);
        c.cmd->timestamp(1);
        c.cmd->draw(terrain_, tb, (gw_ - 1) * (gd_ - 1) * 6);
        c.cmd->timestamp(2);
        c.cmd->draw(capsule_, ub, kRings * kSegs * 6);
        c.cmd->timestamp(3);
        c.cmd->endRenderPass();
    });
    std::vector<unsigned char> rgb;
    const graph::Resource back = g.presentTo(sc, syncInterval, [&](std::string& e) -> bool {
        if (!shot) return true;
        const uint32_t pitch = rhi::textureRowPitch(w_);
        const void* m = dev.mapRead(readback_, uint64_t(pitch) * h_, e);
        if (!m) return false;
        const bool bgra = sc.format() == rhi::TextureFormat::BGRA8Unorm;
        rgb.resize(size_t(w_) * h_ * 3);
        for (uint32_t y = 0; y < h_; ++y) for (uint32_t x = 0; x < w_; ++x){
            const unsigned char* p = (const unsigned char*)m + size_t(y) * pitch + size_t(x) * 4;
            unsigned char* o = rgb.data() + (size_t(y) * w_ + x) * 3;
            o[0] = bgra ? p[2] : p[0]; o[1] = p[1]; o[2] = bgra ? p[0] : p[2];
        }
        dev.unmap(readback_);
        return true;
    });
    g.addPass("post", {{image, Access::StorageRead}, {back, Access::StorageWrite}}, [&](graph::PassContext& c){
        rhi::RenderPassDesc rp; rp.color[0].texture = sc.current();
        c.cmd->beginRenderPass(rp);
        const rhi::RasterBind b[] = {{{}, scene_, {}}};
        c.cmd->draw(post_, b, 3);
        c.cmd->endRenderPass();
        c.cmd->timestamp(4);
    });
    if (shot){
        g.addPass("readback", {{back, Access::StorageRead}, {rb, Access::CopyDst}}, [&](graph::PassContext& c){
            c.cmd->copyTextureToBuffer(sc.current(), readback_);
        });
        g.markOutput(rb);
    }
    const bool ok = g.execute(err);
    status = g.presentStatus();
    if (!ok) return false;
    zones.clear();
    std::vector<double> t; std::string terr;
    if (timed && dev.timestampSeconds(5, t, terr)){
        const char* names[] = {"gpu.sky", "gpu.terrain", "gpu.capsule", "gpu.post"};
        for (int i = 0; i < 4; ++i) zones.push_back({names[i], (t[size_t(i)] - t[0]) * 1e3, (t[size_t(i) + 1] - t[size_t(i)]) * 1e3});
    }
    if (shot && !writePng(shotPath, int(w_), int(h_), rgb)){ err = "cannot write " + shotPath; return false; }
    return true;
}
}  // namespace raw::lwshell
