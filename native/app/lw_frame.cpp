// lw_frame: the Low Water hero frame on D3D12 with DXR (raw/rhi/hw_frame.hpp).
//   lw_frame --data DIR --view NAME --assets ROOT --hdr FILE --out DIR [--size WxH] [--frames N]
//            [--spp N] [--jobs main,close,off,reference,walk] [--chars LIST] [--looks FILE]
// --looks renders each look of the file (lwframe.hpp runLooks) before the jobs.
// --chars places the hero characters (lwframe.hpp loadCharacters) and adds the jobs street,
// portrait, charref, turn, cwalk and parity (lwframe_shots.cpp).
// DIR holds NAME.glb and NAME.frame.json from games/low-water/world/walk/build/hero/emit.mjs;
// ROOT holds the cc0-ambientcg-* and cc0-polyhaven-* folders. Writes PNG stills and frame.json
// with each pass's GPU time (median of the last 16 frames), the memory counts and what ran.
#include "raw/platform/image_codec.hpp"
#include "raw/rhi/hw_frame.hpp"
#include "raw/rhi/rhi.hpp"
#include "../src/tools/lwframe/lwframe.hpp"
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <sstream>
#include <string>
using namespace raw;

namespace {
struct Args { std::string data, view = "hoarstead-main-street", assets = "H:", hdr, out, jobs = "main,close,off,reference,walk", disable, chars, looks; uint32_t debug = 0, w = 3840, h = 2160, frames = 64, spp = 1024; float ev = 0; };
bool has(const std::string& list, const char* j){ std::stringstream s(list); std::string t; while (std::getline(s, t, ',')) if (t == j) return true; return false; }
std::string passesJson(const rhi::hw::FrameResult& r){
    std::string s = "[";
    for (size_t i = 0; i < r.passes.size(); ++i){ char b[128]; std::snprintf(b, sizeof b, "%s{\"pass\":\"%s\",\"ms\":%.4f}", i ? "," : "", r.passes[i].name.c_str(), r.passes[i].ms); s += b; }
    return s + "]";
}
bool save(const Args& a, const std::string& name, const rhi::hw::FrameResult& r, std::string& log){
    std::string err;
    if (!platform::encodePng(a.out + "/" + name + ".png", a.w, a.h, r.ldr, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return false; }
    char b[256]; std::snprintf(b, sizeof b, "%s\"%s\":{\"frame_ms\":%.4f,\"passes\":", log.size() > 1 ? "," : "", name.c_str(), r.frameMs);
    log += b; log += passesJson(r) + "}";
    size_t bad = 0, at = 0; float mx = 0;
    for (size_t i = 0; i + 3 < r.hdr.size(); i += 4){
        const float l = 0.2126f * r.hdr[i] + 0.7152f * r.hdr[i + 1] + 0.0722f * r.hdr[i + 2];
        if (!std::isfinite(l)) ++bad; else if (l > mx){ mx = l; at = i / 4; }
    }
    std::printf("%-28s %8.2f ms GPU   hdr: %zu not finite, peak %.4g at (%zu, %zu)\n", name.c_str(), r.frameMs, bad, mx, at % a.w, at / a.w);
    return true;
}
}  // namespace

int main(int argc, char** argv){
    Args a;
    for (int i = 1; i + 1 < argc; i += 2){
        const std::string k = argv[i], v = argv[i + 1];
        if (k == "--data") a.data = v; else if (k == "--view") a.view = v; else if (k == "--assets") a.assets = v; else if (k == "--hdr") a.hdr = v;
        else if (k == "--out") a.out = v; else if (k == "--jobs") a.jobs = v; else if (k == "--frames") a.frames = uint32_t(std::stoul(v));
        else if (k == "--ev") a.ev = std::stof(v); else if (k == "--disable") a.disable = v; else if (k == "--debug") a.debug = uint32_t(std::stoul(v));
        else if (k == "--spp") a.spp = uint32_t(std::stoul(v)); else if (k == "--chars") a.chars = v; else if (k == "--looks") a.looks = v; else if (k == "--size") std::sscanf(v.c_str(), "%ux%u", &a.w, &a.h);
        else { std::fprintf(stderr, "lw_frame: unknown option %s\n", k.c_str()); return 2; }
    }
    if (a.data.empty() || a.out.empty() || a.hdr.empty()){ std::fprintf(stderr, "usage: lw_frame --data DIR --hdr FILE --out DIR [--view NAME] [--assets ROOT]\n"); return 2; }
    std::filesystem::create_directories(a.out);
    std::string err;
    std::unique_ptr<rhi::Device> dev = rhi::createDevice(err);
    if (!dev){ std::fprintf(stderr, "lw_frame: no device: %s\n", err.c_str()); return 77; }
    std::printf("adapter: %s\n", dev->adapter().description.c_str());
    const auto t0 = std::chrono::steady_clock::now();
    rhi::hw::FrameScene scene; lwframe::Cameras cams;
    if (!lwframe::loadScene(a.data + "/" + a.view + ".glb", a.data + "/" + a.view + ".frame.json", a.assets, a.hdr, scene, cams, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return 1; }
    lwframe::Cast cast;
    if (!a.chars.empty() && !lwframe::loadCharacters(a.chars, a.assets, scene, cast, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return 1; }
    for (const auto& p : cast.people) std::printf("person %s lod%u: %u triangles, %u vertices, %zu joints, at (%.2f, %.2f, %.2f)\n", p.id.c_str(), p.lod, p.triangles, p.vertexCount, p.sk.joints.size(), p.x, p.y, p.z);
    const double loadS = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    std::printf("scene: %zu triangles, %zu vertices, %zu lights, %zu textures, loaded in %.1f s\n", scene.indices.size() / 3, scene.vertices.size(), scene.lights.size(), scene.textures.size(), loadS);
    auto R = rhi::hw::FrameRenderer::create(*dev, scene, a.w, a.h, err);
    if (!R){ std::fprintf(stderr, "lw_frame: %s\n", err.c_str()); return 1; }
    std::string log = "{";
    rhi::hw::FrameOptions base; base.width = a.w; base.height = a.h; base.frames = a.frames; base.time = 3.0f; base.exposureEV = a.ev; base.debugView = a.debug;
    // --disable: passes off in every job (for looking at one effect at a time)
    if (has(a.disable, "gi")) base.gi = false; if (has(a.disable, "reflect")) base.reflect = false; if (has(a.disable, "gtao")) base.gtao = false;
    if (has(a.disable, "fog")) base.fog = false; if (has(a.disable, "restir")) base.restir = false; if (has(a.disable, "snow")) base.snow = false;
    if (has(a.disable, "taa")) base.taa = false; if (has(a.disable, "shadows")) base.shadows = false; if (has(a.disable, "bloom")) base.bloom = false;
    auto run = [&](const char* name, const rhi::hw::FrameCamera& cam, rhi::hw::FrameOptions o) -> bool {
        const rhi::hw::FrameResult r = o.reference ? R->render(cam, o) : R->render(cam, o);
        if (!r.ran){ std::fprintf(stderr, "lw_frame: %s: %s\n", name, r.error.c_str()); return false; }
        return save(a, name, r, log);
    };
    if (!cast.people.empty()){
        std::vector<float> pal; std::vector<std::pair<int, rhi::hw::FrameLight>> lights;
        lwframe::castFrame(cast, 0.4, pal, lights); R->setJoints(pal, true);
        for (auto& [i, l] : lights) R->setLights(uint32_t(i), {l});
        if (!lwframe::characterShots(*R, cast, base, a.jobs, a.out, [&](const char* n, const rhi::hw::FrameResult& r){ return save(a, n, r, log); }, log)) return 1;
    }
    if (!a.looks.empty() && !lwframe::runLooks(*R, cams, base, a.looks, [&](const char* n, const rhi::hw::FrameResult& r){ return save(a, n, r, log); }, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return 1; }
    if (has(a.jobs, "main") && !run("native-main", cams.main, base)) return 1;
    if (has(a.jobs, "close") && cams.hasClose && !run("native-close", cams.close, base)) return 1;
    if (has(a.jobs, "off")){
        struct Off { const char* name; bool rhi::hw::FrameOptions::*flag; };
        const Off offs[] = {{"off-gi", &rhi::hw::FrameOptions::gi}, {"off-reflect", &rhi::hw::FrameOptions::reflect}, {"off-gtao", &rhi::hw::FrameOptions::gtao},
            {"off-fog", &rhi::hw::FrameOptions::fog}, {"off-restir", &rhi::hw::FrameOptions::restir}, {"off-snow", &rhi::hw::FrameOptions::snow},
            {"off-taa", &rhi::hw::FrameOptions::taa}, {"off-glints", &rhi::hw::FrameOptions::glints}, {"off-sss", &rhi::hw::FrameOptions::sss},
            {"off-shadows", &rhi::hw::FrameOptions::shadows}, {"off-pom", &rhi::hw::FrameOptions::pom}, {"off-bloom", &rhi::hw::FrameOptions::bloom}};
        for (const Off& f : offs){ rhi::hw::FrameOptions o = base; o.*(f.flag) = false; if (!run(f.name, cams.main, o)) return 1; }
    }
    if (has(a.jobs, "reference")){
        rhi::hw::FrameOptions o = base; o.snow = false;
        if (!run("flip-realtime", cams.main, o)) return 1;
        o.reference = true; o.referenceSpp = a.spp;
        if (!run("flip-reference", cams.main, o)) return 1;
    }
    if (has(a.jobs, "walk") && !cams.walk.empty()){
        std::filesystem::create_directories(a.out + "/walk");
        rhi::hw::FrameOptions o = base; o.frames = 24;
        R->render(cams.walk[0], o);
        o.frames = 1;
        for (size_t k = 0; k < cams.walk.size(); ++k){
            o.time = 3.0f + float(k) / 30.0f;
            const rhi::hw::FrameResult r = R->step(cams.walk[k], o);
            if (!r.ran){ std::fprintf(stderr, "lw_frame: walk %zu: %s\n", k, r.error.c_str()); return 1; }
            char n[64]; std::snprintf(n, sizeof n, "walk/%03zu", k);
            if (!platform::encodePng(a.out + "/" + n + ".png", a.w, a.h, r.ldr, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return 1; }
            if (k == cams.walk.size() / 2){ std::string l2; save(a, "walk-mid", r, log); }
        }
    }
    // memory and scene counts, from the last renderer state
    rhi::hw::FrameOptions o = base; o.frames = 1;
    const rhi::hw::FrameResult r = R->render(cams.main, o);
    char b[640];
    std::snprintf(b, sizeof b, "%s\"counts\":{\"skinned_blas_bytes\":%llu,\"triangles\":%llu,\"vertices\":%zu,\"lights\":%zu,\"blas_bytes\":%llu,\"tlas_bytes\":%llu,\"texture_bytes\":%llu,\"target_bytes\":%llu,\"as_build_ms\":%.3f,\"scene_load_s\":%.2f,\"width\":%u,\"height\":%u,\"frames\":%u,\"reference_spp\":%u,\"adapter\":\"%s\"}}",
        log.size() > 1 ? "," : "", (unsigned long long)r.skinBlasBytes, (unsigned long long)r.triangles, scene.vertices.size(), scene.lights.size(), (unsigned long long)r.blasBytes, (unsigned long long)r.tlasBytes,
        (unsigned long long)r.textureBytes, (unsigned long long)r.targetBytes, r.buildMs, loadS, a.w, a.h, a.frames, a.spp, dev->adapter().description.c_str());
    log += b;
    std::ofstream(a.out + "/frame.json") << log << "\n";
    std::printf("wrote %s/frame.json\n", a.out.c_str());
    return 0;
}
