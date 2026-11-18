#pragma once
// Private to the GPU checks (src/renderer/gpu/): the uniform block of post.wgsl's passes and
// the view G-buffer as post_gtao and post_ssr read it, shared by post_parity.cpp and
// host_frame.cpp so both feed the passes the same bytes.
#include "raw/renderer/post.hpp"
#include "raw/renderer/taa.hpp"
#include <cstddef>
#include <cstdint>
#include <vector>
namespace raw::gpu_check {
struct PostParamsGpu { uint32_t width, height, slices, steps, refine, flags, ssrSteps, pad1; float view[4], ssr[4], taa[4]; };
static_assert(sizeof(PostParamsGpu) == 80, "PostParams layout");

inline PostParamsGpu params(int w, int h, double tanHalf, double aspect, double nearZ, uint32_t flags) {
    const post::GtaoParams g;
    const post::SsrParams s;
    return {uint32_t(w), uint32_t(h), uint32_t(g.slices), uint32_t(g.steps), uint32_t(s.refine), flags, uint32_t(s.steps), 0,
            {float(tanHalf), float(aspect), float(nearZ), float(g.radius)}, {float(s.maxDistance), float(s.thickness), 0, 0},
            {taa::kBlend, taa::kClipSigma, 0, 0}};
}
inline std::vector<float> pack(const post::ViewGBuffer& v) {
    std::vector<float> g(std::size_t(v.w) * v.h * 8, 0.0f);
    for (std::size_t i = 0; i < std::size_t(v.w) * v.h; ++i) {
        for (int k = 0; k < 3; ++k) { g[i * 8 + std::size_t(k)] = v.pos[i * 3 + std::size_t(k)]; g[i * 8 + 4 + std::size_t(k)] = v.nrm[i * 3 + std::size_t(k)]; }
        g[i * 8 + 3] = v.depth[i];
        g[i * 8 + 7] = v.back.empty() ? v.depth[i] : v.back[i];   // SSR's back depth (method note 14)
    }
    return g;
}
}  // namespace raw::gpu_check
