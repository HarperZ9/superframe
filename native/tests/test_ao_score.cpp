// The AO comparison's scoring (bench/ao/ao_score.hpp) on the CPU, at a small size: the controls
// the GPU comparison relies on must behave here too, or its numbers mean nothing.
//   1. AO off (visibility 1) scores worse than GTAO on every scene and cannot pass the win rule
//      against GTAO even at zero cost.
//   2. GTAO with its radius doubled (a planted wrong AO) scores worse than GTAO on every scene.
//   3. The win rule: 20% lower mean error and no more GPU time, both required.
//   4. Pixels without geometry and the border are not scored.
#include "../bench/ao/ao_scenes.hpp"
#include "../bench/ao/ao_score.hpp"
#include "raw/renderer/post.hpp"
#include "raw/renderer/raster.hpp"
#include "check.hpp"
#include <cstdio>
#include <vector>
using namespace raw;

namespace {
std::vector<float> f32(const std::vector<double>& v) { return {v.begin(), v.end()}; }

void rule() {
    CHECK(aobench::wins(0.08, 1.0, 0.10, 1.0));     // exactly 20% lower, same time
    CHECK(!aobench::wins(0.081, 1.0, 0.10, 1.0));   // 19% lower
    CHECK(!aobench::wins(0.05, 1.01, 0.10, 1.0));   // better but slower
}

void mask() {
    const int w = 8, h = 8;
    std::vector<float> ao(64, 0.5f), ref(64, 1.0f);
    std::vector<uint8_t> valid(64, 1);
    valid[3 * 8 + 3] = 0;
    ao[3 * 8 + 3] = 100.0f;   // not drawn: must not count
    ao[0] = 100.0f;           // in the border: must not count
    const aobench::Score s = aobench::score(ao, ref, valid, w, h, 1);
    CHECK(s.pixels == 35);
    CHECK(s.mean > 0.4999 && s.mean < 0.5001);
}
}  // namespace

int main() {
    rule();
    mask();
    const int w = 256, h = 144;
    for (const auto& [name, s] : aobench::scenes(w, h)) {
        RasterOptions ro; ro.perspectiveDepth = true;
        const GBuffer g = rasterize(s, w, h, nullptr, nullptr, ro);
        const post::ViewGBuffer v = post::viewGBuffer(g, s.camera);
        std::vector<uint8_t> valid(std::size_t(w) * h);
        for (std::size_t i = 0; i < valid.size(); ++i) valid[i] = v.depth[i] >= 0.0f;
        const std::vector<float> ref = f32(post::rayAo(s, g, 0.5, 16));
        post::GtaoParams wrong; wrong.radius = 1.0;
        const aobench::Score ours = aobench::score(f32(post::gtao(v)), ref, valid, w, h, 4);
        const aobench::Score bad = aobench::score(f32(post::gtao(v, wrong)), ref, valid, w, h, 4);
        const aobench::Score off = aobench::score(std::vector<float>(ref.size(), 1.0f), ref, valid, w, h, 4);
        std::printf("%s: pixels %ld occluded %ld | gtao %.4f | radius doubled %.4f | off %.4f\n", name.c_str(), ours.pixels, ours.occluded, ours.mean, bad.mean, off.mean);
        CHECK(ours.pixels > 1000);
        CHECK(off.mean > ours.mean);
        CHECK(!aobench::wins(off.mean, 0.0, ours.mean, 1.0));
        CHECK(bad.mean > ours.mean);
    }
    return raw_test_summary();
}
