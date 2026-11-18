// The real-time AO pass (raw/renderer/ao_realtime.hpp) on the D3D12 backend, scored against
// the engine's CPU reference post::gtao at 16 x 16 on an analytic scene (a floor, a wall and
// a ball). Bounds in evidence/ao-realtime-bounds.json. Checks:
// The pass runs at its defaults (2 slices x 16 steps).
//   1. converged over 32 still frames, the mean error stays under the bound
//   2. the first frame (no history) stays under its own, looser bound
//   3. CONTROL: twice the radius scores worse than the right radius
//   4. the scene sliding 3 pixels a frame with the right motion vectors stays under the bound
//   5. CONTROL: the same slide with zero motion vectors, depth rejection off, scores worse (ghosting)
// Without an adapter it exits 77 (skipped, never passed).
//   ao_realtime [out.json]
#include "raw/renderer/ao_realtime.hpp"
#include "raw/renderer/post.hpp"
#include "raw_hw_dxil.hpp"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <fstream>
using namespace raw;
using rhi::TextureFormat;
using rhi::TextureUsage;
namespace {
constexpr uint32_t W = 480, H = 270;
constexpr float kA = 1.00004f, kB = 15.00064f, kTan = 0.472f, kAspect = float(W) / float(H), kRadius = 35.0f;

struct Shot { std::vector<float> depth; std::vector<uint32_t> normal, colour; };
// x right, y up, z forward: a floor at y = -80, a wall at z = 500, a ball of radius 60.
Shot scene(int shift) {
    Shot s;
    s.depth.assign(size_t(W) * H, 1.0f); s.normal.assign(size_t(W) * H, 0); s.colour.assign(size_t(W) * H, 0xFFC0C0C0u);
    for (uint32_t y = 0; y < H; ++y)
        for (uint32_t x = 0; x < W; ++x) {
            const int sx = std::clamp(int(x) - shift, 0, int(W) - 1);   // the content of pixel x - shift
            const float dx = ((sx + 0.5f) / W * 2 - 1) * kTan * kAspect, dy = (1 - (y + 0.5f) / H * 2) * kTan;
            float best = 500.0f, nx = 0, ny = 0, nz = -1;
            if (dy < -1e-4f && -80.0f / dy < best) { best = -80.0f / dy; nx = 0; ny = 1; nz = 0; }
            const float cx = 0, cy = -20, cz = 220, r = 60;
            const float a = dx * dx + dy * dy + 1, b = -2 * (dx * cx + dy * cy + cz), c = cx * cx + cy * cy + cz * cz - r * r;
            const float disc = b * b - 4 * a * c;
            if (disc > 0) {
                const float t = (-b - std::sqrt(disc)) / (2 * a);
                if (t > 0 && t < best) { best = t; nx = (dx * t - cx) / r; ny = (dy * t - cy) / r; nz = (t - cz) / r; }
            }
            const size_t i = size_t(y) * W + x;
            s.depth[i] = kA - kB / best;
            const auto q = [](float v) { return uint32_t(std::lround(std::clamp(v * 0.5f + 0.5f, 0.0f, 1.0f) * 255.0f)); };
            s.normal[i] = q(nx) | (q(ny) << 8) | (q(-nz) << 16) | 0xFF000000u;   // engine view space: z towards the viewer
        }
    return s;
}
// The view G-buffer the reference reads, built from the same texels the pass reads.
post::ViewGBuffer pack(const Shot& s) {
    post::ViewGBuffer v;
    v.w = W; v.h = H; v.tanHalf = kTan; v.aspect = kAspect; v.nearZ = kB / kA;
    v.pos.assign(size_t(W) * H * 3, 0.0f); v.nrm.assign(size_t(W) * H * 3, 0.0f); v.depth.assign(size_t(W) * H, -1.0f);
    for (uint32_t y = 0; y < H; ++y)
        for (uint32_t x = 0; x < W; ++x) {
            const size_t i = size_t(y) * W + x;
            const float z = kB / (kA - s.depth[i]);
            v.pos[i * 3] = ((x + 0.5f) / W * 2 - 1) * z * kTan * kAspect; v.pos[i * 3 + 1] = (1 - (y + 0.5f) / H * 2) * z * kTan; v.pos[i * 3 + 2] = -z;
            v.depth[i] = z;
            float n[3];
            for (int k = 0; k < 3; ++k) n[k] = float((s.normal[i] >> (8 * k)) & 255u) / 255.0f * 2 - 1;
            const float len = std::sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
            for (int k = 0; k < 3; ++k) v.nrm[i * 3 + k] = n[k] / len;
        }
    return v;
}
float halfToFloat(uint16_t h) {
    const int e = (h >> 10) & 31, m = h & 1023;
    const float v = e == 0 ? std::ldexp(float(m), -24) : std::ldexp(float(m + 1024), e - 25);
    return (h & 0x8000) ? -v : v;
}
uint16_t floatToHalf(float f) {   // values this test writes: zero and small exact fractions
    if (f == 0) return 0;
    int e; const float m = std::frexp(std::fabs(f), &e);
    return uint16_t((f < 0 ? 0x8000 : 0) | ((e + 14) << 10) | (int(std::lround(m * 2048.0f)) - 1024));
}
rhi::ShaderCode blob(const char* name) {
    for (const HwDxilBlob& b : kHwDxil) if (std::strcmp(b.name, name) == 0) return {rhi::ShaderFormat::Dxil, b.bytes, b.size};
    return {};
}
struct Rig {
    rhi::Device* dev{nullptr};
    ao_rt::Pass pass;
    rhi::TextureHandle depth, normal, motion, frame, target;
    rhi::BufferHandle readback;
    std::string err;
    bool create() {
        dev = rhi::device(err);
        if (!dev) return false;
        const TextureUsage in = TextureUsage::Sampled | TextureUsage::CopyDst;
        depth = dev->createTexture({W, H, TextureFormat::R32Float, in, "depth"}, err);
        normal = dev->createTexture({W, H, TextureFormat::RGBA8Unorm, in, "normal"}, err);
        motion = dev->createTexture({W, H, TextureFormat::RG16Float, in, "motion"}, err);
        frame = dev->createTexture({W, H, TextureFormat::RGBA8Unorm, in, "frame"}, err);
        target = dev->createTexture({W, H, TextureFormat::RGBA8Unorm, TextureUsage::RenderTarget | TextureUsage::CopySrc, "target"}, err);
        readback = dev->createBuffer({uint64_t(rhi::textureRowPitch(W, TextureFormat::RGBA16Float)) * H,
                                      rhi::BufferUsage::MapRead | rhi::BufferUsage::CopyDst, "history readback"}, err);
        return depth.valid() && normal.valid() && motion.valid() && frame.valid() && target.valid() && readback.valid() &&
               pass.create(*dev, W, H, TextureFormat::RGBA8Unorm,
                           {blob("ao_rt_vs"), blob("ao_rt_prefilter"), blob("ao_rt_level"), blob("ao_rt_trace"), blob("ao_rt_resolve")}, err);
    }
    // `frames` frames; frame t shows the scene shifted by t * slide pixels, with `mv` pixels of motion.
    bool run(ao_rt::Params p, int frames, int slide, float mvPixels, std::vector<float>* vis, Shot* last) {
        pass.resetHistory();
        p.projA = kA; p.projB = kB; p.tanHalf = kTan; p.aspect = kAspect; p.mode = 2;
        std::vector<uint16_t> mv(size_t(W) * H * 2, 0);
        for (size_t i = 0; i < size_t(W) * H; ++i) mv[i * 2] = floatToHalf(mvPixels / float(W));
        bool first = true;
        for (int t = 0; t < frames; ++t) {
            rhi::CommandList* c = dev->begin(err);
            if (!c) return false;
            if (first || slide) {
                *last = scene(t * slide);
                c->uploadTexture(depth, last->depth.data(), W, H);
                c->uploadTexture(normal, last->normal.data(), W, H);
                c->uploadTexture(motion, mv.data(), W, H);
                c->uploadTexture(frame, last->colour.data(), W, H);
                first = false;
            }
            pass.record(*c, {depth, normal, motion, frame, target}, p, 0);
            if (t + 1 == frames) {
                const rhi::BufferBarrier b[1] = {{readback, state, rhi::Access::CopyDst}};
                c->barrier(b);
                state = rhi::Access::CopyDst;
                c->copyTextureToBuffer(pass.history(), readback);
            }
            if (!dev->submitAndWait(err)) return false;
        }
        const uint32_t pitch = rhi::textureRowPitch(W, TextureFormat::RGBA16Float);
        const auto* bytes = static_cast<const uint8_t*>(dev->mapRead(readback, uint64_t(pitch) * H, err));
        if (!bytes) return false;
        vis->resize(size_t(W) * H);
        for (uint32_t y = 0; y < H; ++y)
            for (uint32_t x = 0; x < W; ++x) {
                uint16_t h;
                std::memcpy(&h, bytes + size_t(y) * pitch + size_t(x) * 8, 2);
                (*vis)[size_t(y) * W + x] = halfToFloat(h);
            }
        dev->unmap(readback);
        return true;
    }
    rhi::Access state{rhi::Access::Undefined};
};
// Mean error over the frame (a 16-pixel border left out); with `occluded`, over the pixels the
// reference puts under 0.9 only, where a smeared history shows.
double meanError(const std::vector<float>& vis, const std::vector<double>& ref, bool occluded = false) {
    double sum = 0; size_t n = 0;
    for (uint32_t y = 16; y < H - 16; ++y)
        for (uint32_t x = 16; x < W - 16; ++x) {
            const size_t i = size_t(y) * W + x;
            if (occluded && ref[i] >= 0.9) continue;
            sum += std::fabs(std::min(vis[i], 1.0f) - ref[i]); ++n;
        }
    return n ? sum / double(n) : 0.0;
}
}  // namespace

int main(int argc, char** argv) {
    Rig rig;
    if (!rig.create()) {
        std::printf("%s: %s\n", rig.dev ? "failed" : "skipped", rig.err.c_str());
        return rig.dev ? 1 : 77;
    }
    post::GtaoParams gp;
    gp.radius = kRadius;
    ao_rt::Params p;
    p.radius = kRadius;   // the pass at its defaults: 2 slices x 16 steps
    std::vector<float> vis;
    Shot shown;
    bool ok = rig.run(p, 32, 0, 0, &vis, &shown);
    const std::vector<double> ref = post::gtao(pack(shown), gp);
    const double converged = ok ? meanError(vis, ref) : 1;
    ok = ok && rig.run(p, 1, 0, 0, &vis, &shown);
    const double first = ok ? meanError(vis, ref) : 1;
    ao_rt::Params wide = p;
    wide.radius = kRadius * 2;
    ok = ok && rig.run(wide, 32, 0, 0, &vis, &shown);
    const double wrongRadius = ok ? meanError(vis, ref) : 0;
    // The slide: content moves 3 pixels right a frame, so the surface at a pixel was 3 pixels
    // to the left one frame before: previous uv = uv - 3 / W.
    ok = ok && rig.run(p, 24, 3, -3.0f, &vis, &shown);
    const std::vector<double> refMoved = post::gtao(pack(shown), gp);
    const double moving = ok ? meanError(vis, refMoved) : 1, movingOccluded = ok ? meanError(vis, refMoved, true) : 1;
    ao_rt::Params ghost = p;
    ghost.zTol = 1.0e6f;
    ok = ok && rig.run(ghost, 24, 3, 0.0f, &vis, &shown);
    const double wrongMotion = ok ? meanError(vis, refMoved, true) : 0;
    const double kConverged = 0.02, kFirst = 0.06, kMoving = 0.03;
    const bool pass = ok && converged < kConverged && first < kFirst && wrongRadius > 1.5 * converged && moving < kMoving &&
                      wrongMotion > 1.5 * movingOccluded;
    char j[1024];
    std::snprintf(j, sizeof j,
                  "{\"check\":\"ao_realtime\",\"adapter\":\"%s\",\"width\":%u,\"height\":%u,\"slices\":2,\"steps\":16,\n"
                  " \"mean_error\":{\"converged_32\":%.5f,\"first_frame\":%.5f,\"moving_right_motion\":%.5f,\"moving_right_motion_occluded\":%.5f},\n"
                  " \"bounds\":{\"converged_32\":%.3f,\"first_frame\":%.3f,\"moving_right_motion\":%.3f},\n"
                  " \"controls\":{\"radius_x2\":%.5f,\"moving_zero_motion_occluded\":%.5f},\"error\":\"%s\",\"pass\":%s}\n",
                  rig.dev->adapter().description.c_str(), W, H, converged, first, moving, movingOccluded, kConverged, kFirst, kMoving, wrongRadius,
                  wrongMotion, rig.err.c_str(), pass ? "true" : "false");
    std::fputs(j, stdout);
    if (argc > 1) std::ofstream(argv[1], std::ios::binary) << j;
    return pass ? 0 : 1;
}
