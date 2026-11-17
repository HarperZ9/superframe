// Writes the inputs and the reference of the AO comparison (bench/ao/README.md) for the five
// scenes: the view-space G-buffer the GPU passes read, and the ray-cast AO they are scored
// against (cosine-weighted visibility within the radius, sqrtRays^2 stratified rays a pixel).
//   ao_export --out DIR [--size W H] [--sqrt-rays N] [--radius R]
// Files per scene: DIR/<scene>.gbuf (8 float32 a pixel: view position, view depth or -1 where
// nothing was drawn, view normal, depth again) and DIR/<scene>.ref (1 float32 a pixel), plus one
// line a scene in DIR/scenes.txt: name width height tanHalf aspect nearZ farZ radius rays seconds.
#include "ao_scenes.hpp"
#include "raw/renderer/post.hpp"
#include "raw/renderer/raster.hpp"
#include <chrono>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>
using namespace raw;

namespace {
bool writeFile(const std::string& path, const void* data, std::size_t bytes) {
    std::FILE* f = std::fopen(path.c_str(), "wb");
    if (!f) { std::fprintf(stderr, "ao_export: cannot open %s\n", path.c_str()); return false; }
    const bool ok = std::fwrite(data, 1, bytes, f) == bytes;
    std::fclose(f);
    if (!ok) std::fprintf(stderr, "ao_export: short write to %s\n", path.c_str());
    return ok;
}
std::vector<float> packGbuf(const post::ViewGBuffer& v) {
    std::vector<float> g(std::size_t(v.w) * std::size_t(v.h) * 8, 0.0f);
    for (std::size_t i = 0; i < std::size_t(v.w) * std::size_t(v.h); ++i) {
        for (int k = 0; k < 3; ++k) { g[i * 8 + std::size_t(k)] = v.pos[i * 3 + std::size_t(k)]; g[i * 8 + 4 + std::size_t(k)] = v.nrm[i * 3 + std::size_t(k)]; }
        g[i * 8 + 3] = v.depth[i];
        g[i * 8 + 7] = v.depth[i];
    }
    return g;
}
struct Args { std::string out; int w{2560}, h{1440}, sq{32}; double radius{0.5}; };
bool parse(int argc, char** argv, Args& a) {
    for (int i = 1; i < argc; ++i) {
        if (!std::strcmp(argv[i], "--out") && i + 1 < argc) a.out = argv[++i];
        else if (!std::strcmp(argv[i], "--size") && i + 2 < argc) { a.w = std::atoi(argv[++i]); a.h = std::atoi(argv[++i]); }
        else if (!std::strcmp(argv[i], "--sqrt-rays") && i + 1 < argc) a.sq = std::atoi(argv[++i]);
        else if (!std::strcmp(argv[i], "--radius") && i + 1 < argc) a.radius = std::atof(argv[++i]);
        else { std::fprintf(stderr, "ao_export: unknown argument %s\n", argv[i]); return false; }
    }
    if (a.out.empty() || a.w <= 0 || a.h <= 0 || a.sq <= 0) { std::fprintf(stderr, "usage: ao_export --out DIR [--size W H] [--sqrt-rays N] [--radius R]\n"); return false; }
    return true;
}
}  // namespace

int main(int argc, char** argv) {
    Args a;
    if (!parse(argc, argv, a)) return 2;
    std::string lines;
    for (const auto& [name, s] : aobench::scenes(a.w, a.h)) {
        const auto t0 = std::chrono::steady_clock::now();
        RasterOptions ro; ro.perspectiveDepth = true;
        const GBuffer g = rasterize(s, a.w, a.h, nullptr, nullptr, ro);
        const post::ViewGBuffer v = post::viewGBuffer(g, s.camera);
        const std::vector<double> ref = post::rayAo(s, g, a.radius, a.sq);
        std::vector<float> rf(ref.begin(), ref.end());
        const std::vector<float> gb = packGbuf(v);
        const double sec = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
        if (!writeFile(a.out + "/" + name + ".gbuf", gb.data(), gb.size() * 4) || !writeFile(a.out + "/" + name + ".ref", rf.data(), rf.size() * 4)) return 1;
        char b[512];
        std::snprintf(b, sizeof b, "%s %d %d %.9g %.9g %.9g %.9g %.9g %d %.1f\n", name.c_str(), a.w, a.h, v.tanHalf, v.aspect, v.nearZ,
                      double(s.camera.farZ), a.radius, a.sq * a.sq, sec);
        lines += b;
        std::printf("%s", b);
        std::fflush(stdout);
    }
    return writeFile(a.out + "/scenes.txt", lines.data(), lines.size()) ? 0 : 1;
}
