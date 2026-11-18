// The frame trace (see lwshell_frametrace.hpp).
#include "lwshell_frametrace.hpp"
#include "lwshell_trace.hpp"
#include <algorithm>
#include <cmath>
#include <cstdio>
#include <map>
namespace raw::lwshell {
namespace {
std::string num(double v){
    if (!std::isfinite(v)) return "null";
    char b[40]; std::snprintf(b, sizeof b, "%.4f", v);
    return b;
}
std::string str(const std::string& s){
    std::string o = "\"";
    for (char c : s){ if (c == '"' || c == '\\') o += '\\'; if ((unsigned char)c >= 32) o += c; }
    return o + "\"";
}
}  // namespace

double percentile(std::vector<double> v, double q){
    if (v.empty()) return 0;
    std::sort(v.begin(), v.end());
    const double at = q * double(v.size() - 1);
    const size_t lo = size_t(at);
    const double t = at - double(lo);
    return lo + 1 < v.size() ? v[lo] * (1 - t) + v[lo + 1] * t : v[lo];
}

std::string frameTraceJson(const Summary& s, const std::vector<Zone>& zones){
    const std::vector<double>& iv = s.intervalsMs;
    double mean = 0; for (double x : iv) mean += x;
    mean = iv.empty() ? 0 : mean / double(iv.size());
    double var = 0; for (double x : iv) var += (x - mean) * (x - mean);
    var = iv.size() > 1 ? var / double(iv.size() - 1) : 0;
    // per-zone means, so the summary names every zone the events hold
    std::map<std::string, std::pair<double, uint64_t>> per;
    for (const Zone& z : zones){ auto& p = per[z.name]; p.first += z.durUs / 1e3; ++p.second; }
    std::string j = "{\n\"schema\": \"lowwater.frame-trace/1\",\n\"displayTimeUnit\": \"ms\",\n\"summary\": {\n";
    j += " \"adapter\": " + str(s.adapter) + ", \"backend\": " + str(s.backend) + ", \"input\": " + str(s.input) + ", \"tile\": " + str(s.tile) + ",\n";
    j += " \"size\": " + str(std::to_string(s.width) + "x" + std::to_string(s.height)) + ", \"sync_interval\": " + std::to_string(s.syncInterval)
       + ", \"refresh_hz\": " + num(s.refreshHz) + ", \"waitable_swapchain\": true,\n";
    j += " \"cold_start_ms\": {\"clock\": \"process creation (GetProcessTimes) to the moment\", \"main_entry\": " + num(s.mainEntryMs)
       + ", \"first_present\": " + num(s.firstPresentMs) + ", \"walking\": " + num(s.walkingMs) + "},\n";
    j += " \"frames\": " + std::to_string(s.frames) + ", \"ticks\": " + std::to_string(s.ticks) + ", \"tick_hz\": 60, \"terrain_triangles\": "
       + std::to_string(s.terrainTriangles) + ", \"final_state_hash\": " + str(hex64(s.finalHash)) + ",\n";
    j += " \"present_interval_ms\": {\"warmup_frames\": " + std::to_string(s.warmup) + ", \"count\": " + std::to_string(iv.size())
       + ", \"mean\": " + num(mean) + ", \"stddev\": " + num(std::sqrt(var)) + ", \"variance\": " + num(var)
       + ", \"p50\": " + num(percentile(iv, 0.5)) + ", \"p99\": " + num(percentile(iv, 0.99)) + ", \"max\": " + num(percentile(iv, 1.0))
       + ", \"min\": " + num(percentile(iv, 0.0)) + "},\n \"zone_mean_ms\": {";
    bool first = true;
    for (const auto& [name, p] : per){ j += (first ? "" : ", ") + str(name) + ": " + num(p.first / double(p.second)); first = false; }
    j += "}\n},\n\"traceEvents\": [\n";
    j += "{\"name\": \"thread_name\", \"ph\": \"M\", \"pid\": 1, \"tid\": 1, \"args\": {\"name\": \"CPU main\"}},\n";
    j += "{\"name\": \"thread_name\", \"ph\": \"M\", \"pid\": 1, \"tid\": 2, \"args\": {\"name\": \"GPU (D3D12 timestamps)\"}}";
    for (const Zone& z : zones)
        j += ",\n{\"name\": " + str(z.name) + ", \"ph\": \"X\", \"pid\": 1, \"tid\": " + std::to_string(z.tid) + ", \"ts\": " + num(z.tsUs)
           + ", \"dur\": " + num(z.durUs) + ", \"args\": {\"frame\": " + std::to_string(z.frame) + "}}";
    j += "\n]\n}\n";
    return j;
}
}  // namespace raw::lwshell
