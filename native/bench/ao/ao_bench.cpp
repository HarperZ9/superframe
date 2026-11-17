// The AO comparison on the GPU (bench/ao/README.md): every method on every frame ao_export
// wrote, each scored against the ray-cast reference and timed with GPU timestamps.
//   ao_bench --data DIR --shaders DIR [--adapter NAME] [--iters N] [--border PX] [--out FILE]
// Writes one JSON document: per scene and method the scored pixels, mean and p95 of |ao - ref|,
// and the median, 10th and 90th percentile GPU time over N repeats (warm-up repeats dropped).
#include "ao_gpu.hpp"
#include "ao_score.hpp"
#include <algorithm>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <string>
#include <vector>
using namespace raw::aobench;

namespace {
struct Args { std::string data, shaders, adapter{"4090"}, out, only; int iters{300}, warm{20}, border{32}; };
bool parse(int argc, char** argv, Args& a) {
    for (int i = 1; i + 1 < argc; i += 2) {
        const std::string k = argv[i], v = argv[i + 1];
        if (k == "--data") a.data = v; else if (k == "--shaders") a.shaders = v; else if (k == "--adapter") a.adapter = v;
        else if (k == "--iters") a.iters = std::atoi(v.c_str()); else if (k == "--border") a.border = std::atoi(v.c_str());
        else if (k == "--out") a.out = v; else if (k == "--only") a.only = v; else { std::fprintf(stderr, "ao_bench: unknown argument %s\n", k.c_str()); return false; }
    }
    return !a.data.empty() && !a.shaders.empty() && a.iters > 0 && a.iters + a.warm <= 500;
}
double pct(std::vector<double> v, double q) {
    std::sort(v.begin(), v.end());
    return v[std::min(v.size() - 1, std::size_t(q * double(v.size())))];
}
struct Method { std::string kind; OursConfig ours; XeConfig xe; };
std::vector<Method> methods() {
    std::vector<Method> m;
    m.push_back({"off", {"ao-off (control)"}, {}});
    for (auto [s, k] : std::vector<std::pair<int, int>>{{16, 16}, {8, 8}, {4, 8}, {4, 4}, {3, 3}, {2, 4}, {2, 2}})
        m.push_back({"ours", {"gtao " + std::to_string(s) + "x" + std::to_string(k), "post_gtao", s, k, 0.5}, {}});
    m.push_back({"ours", {"gtao 16x16 radius doubled (planted wrong)", "post_gtao", 16, 16, 1.0}, {}});
    for (auto [s, k] : std::vector<std::pair<int, int>>{{1, 4}, {2, 4}, {2, 6}, {3, 6}, {4, 8}})
        m.push_back({"ours", {"fast " + std::to_string(s) + "x" + std::to_string(k), "fast", s, k, 0.5}, {}});
    m.push_back({"ours", {"fast 2x6 radius doubled (planted wrong)", "fast", 2, 6, 1.0}, {}});
    const char* q[4] = {"low", "medium", "high", "ultra"};
    for (int i = 0; i < 4; ++i) m.push_back({"xe", {}, {std::string("xegtao ") + q[i] + " (shipped defaults)", true, i, true}});
    m.push_back({"xe", {}, {"xegtao high, radius x1, falloff 0.1, power 1 (matched to the reference)", false, 2, true, 1.0f, 0.1f, 1.0f}});
    return m;
}
std::string row(const std::string& name, const Score& s, const Run& r, int warm, double& median) {
    std::vector<double> t(r.ms.begin() + std::min<std::ptrdiff_t>(warm, std::ptrdiff_t(r.ms.size())), r.ms.end());
    median = t.empty() ? 0.0 : pct(t, 0.5);
    char b[512];
    std::snprintf(b, sizeof b, "{\"method\": \"%s\", \"pixels\": %ld, \"occluded\": %ld, \"mean_abs\": %.5f, \"p95_abs\": %.5f, "
                  "\"gpu_ms_median\": %.4f, \"gpu_ms_p10\": %.4f, \"gpu_ms_p90\": %.4f, \"timed_repeats\": %zu}",
                  name.c_str(), s.pixels, s.occluded, s.mean, s.p95, t.empty() ? 0.0 : pct(t, 0.5), t.empty() ? 0.0 : pct(t, 0.1), t.empty() ? 0.0 : pct(t, 0.9), t.size());
    return b;
}
// The first slice's rule on one scene (README "Rule"): does any of our methods (planted ones
// excluded) win against the rival, does AO off win (it must not), and does each planted wrong AO
// score worse than the same method with the right radius (it must).
struct Result { std::string name, kind; double mean{0}, ms{0}; };
constexpr const char* kRival = "xegtao high (shipped defaults)";
std::string verdict(const std::vector<Result>& rs, bool& won, bool& controlsOk) {
    const Result* rival = nullptr;
    for (const Result& r : rs) if (r.name == kRival) rival = &r;
    if (!rival) { won = false; controlsOk = false; return "{\"rival\": null}"; }
    std::string by;
    bool offWins = false, plantedWorse = true;
    for (const Result& r : rs) {
        const std::size_t cut = r.name.find(" radius doubled");
        if (r.kind == "off") offWins = wins(r.mean, r.ms, rival->mean, rival->ms);
        else if (r.kind == "ours" && cut == std::string::npos && wins(r.mean, r.ms, rival->mean, rival->ms)) by += (by.empty() ? "" : ", ") + r.name;
        else if (r.kind == "ours" && cut != std::string::npos)
            for (const Result& q : rs) if (q.name == r.name.substr(0, cut)) plantedWorse = plantedWorse && r.mean > q.mean;
    }
    won = !by.empty(); controlsOk = !offWins && plantedWorse;
    return std::string("{\"rival\": \"") + kRival + "\", \"ours_wins_with\": \"" + by + "\", \"off_wins\": " + (offWins ? "true" : "false") +
           ", \"planted_worse\": " + (plantedWorse ? "true" : "false") + "}";
}
}  // namespace

int main(int argc, char** argv) {
    Args a;
    if (!parse(argc, argv, a)) { std::fprintf(stderr, "usage: ao_bench --data DIR --shaders DIR [--adapter NAME] [--iters N<=480] [--border PX] [--out FILE]\n"); return 2; }
    Dx dx;
    if (!dx.init(a.adapter)) { std::fprintf(stderr, "ao_bench: %s\n", dx.err.c_str()); return 1; }
    std::ifstream sc(a.data + "/scenes.txt");
    std::string line, json = "{\n \"adapter\": \"" + dx.adapter + "\",\n \"border_px\": " + std::to_string(a.border) + ",\n \"scenes\": [\n";
    bool firstScene = true;
    int scenesWon = 0, scenesCount = 0;
    bool controlsAll = true;
    while (std::getline(sc, line)) {
        Frame f;
        if (!loadFrame(a.data, line, f, dx.err)) { std::fprintf(stderr, "ao_bench: %s\n", dx.err.c_str()); return 1; }
        json += std::string(firstScene ? "" : ",\n") + "  {\"scene\": \"" + f.name + "\", \"width\": " + std::to_string(f.w) + ", \"height\": " +
                std::to_string(f.h) + ", \"reference_rays\": " + std::to_string(f.rays) + ", \"methods\": [\n";
        firstScene = false;
        bool firstRow = true;
        std::vector<Result> results;
        for (const Method& m : methods()) {
            const std::string mname = m.kind == "xe" ? m.xe.name : m.ours.name;
            if (!a.only.empty() && mname.find(a.only) == std::string::npos && m.kind != "off") continue;   // --only: a substring of the method names
            Run r;
            bool ok = true;
            if (m.kind == "off") r.ao.assign(f.ref.size(), 1.0f);
            else if (m.kind == "ours") ok = runOurs(dx, a.shaders, f, m.ours, a.iters + a.warm, r);
            else ok = runXe(dx, a.shaders, f, m.xe, a.iters + a.warm, r);
            if (!ok) { std::fprintf(stderr, "ao_bench: %s on %s: %s\n", m.kind == "xe" ? m.xe.name.c_str() : m.ours.name.c_str(), f.name.c_str(), dx.err.c_str()); return 1; }
            const Score s = score(r.ao, f.ref, f.valid, f.w, f.h, a.border);
            double median = 0.0;
            const std::string rw = row(mname, s, r, a.warm, median);
            results.push_back({mname, m.kind, s.mean, median});
            std::printf("%s: %s\n", f.name.c_str(), rw.c_str());
            std::fflush(stdout);
            json += std::string(firstRow ? "" : ",\n") + "   " + rw;
            firstRow = false;
        }
        bool won = false, controlsOk = false;
        json += "\n  ], \"verdict\": " + verdict(results, won, controlsOk) + "}";
        scenesWon += won; ++scenesCount; controlsAll = controlsAll && controlsOk;
    }
    json += "\n ],\n \"scenes_won\": " + std::to_string(scenesWon) + ",\n \"scene_count\": " + std::to_string(scenesCount) + ",\n \"controls_ok\": " +
            (controlsAll ? "true" : "false") + ",\n \"pass\": " + (scenesWon >= 4 && controlsAll ? "true" : "false") + "\n}\n";
    if (!a.out.empty()) std::ofstream(a.out) << json;
    else std::fputs(json.c_str(), stdout);
    return 0;
}
