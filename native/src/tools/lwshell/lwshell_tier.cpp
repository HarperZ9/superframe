// The graphics tier (see lwshell_tier.hpp).
#include "lwshell_tier.hpp"
#include <algorithm>
#include <cctype>
#include <cstdio>
namespace raw::lwshell {
namespace {
constexpr uint64_t kGiB = 1024ull * 1024 * 1024;
std::string lower(std::string s){ for (char& c : s) c = char(std::tolower((unsigned char)c)); return s; }
bool contains(const std::string& hay, const char* needle){ return lower(hay).find(needle) != std::string::npos; }
// The Steam Deck's APU, matched by adapter name (the RHI reports the vendor, not the device id).
// The names are from memory and unchecked on hardware: a Deck run must confirm them before
// the Deck path relies on this match.
bool steamDeck(const rhi::hw::Probe& p){
    return contains(p.adapter, "van gogh") || contains(p.adapter, "sephiroth") || contains(p.adapter, "custom gpu 0405")
        || contains(p.adapter, "custom gpu 0932");
}
bool software(const rhi::hw::Probe& p){
    return contains(p.vendor, "1414") || contains(p.vendor, "microsoft") || contains(p.adapter, "basic render") || contains(p.adapter, "warp");
}
bool rtCapable(const rhi::hw::Probe& p){ return p.on(rhi::hw::kRayQuery) && p.on(rhi::hw::kRayPipeline); }
}  // namespace

const char* tierName(Tier t){
    switch (t){ case Tier::Rt: return "rt"; case Tier::Raster: return "raster"; default: return "reduced"; }
}
bool parseTier(const std::string& s, Tier& out){
    const std::string l = lower(s);
    if (l == "rt") out = Tier::Rt;
    else if (l == "raster") out = Tier::Raster;
    else if (l == "reduced") out = Tier::Reduced;
    else return false;
    return true;
}

TierChoice chooseTier(const rhi::hw::Probe& p, const std::string& requested){
    TierChoice c;
    const double gib = double(p.videoMemory) / double(kGiB);
    char mem[48]; std::snprintf(mem, sizeof mem, "%.1f GiB dedicated video memory", gib);
    if (software(p)){ c.detected = Tier::Reduced; c.reason = "a software adapter (WARP)"; }
    else if (steamDeck(p)){ c.detected = Tier::Reduced; c.reason = "a Steam Deck APU"; }
    else if (p.videoMemory < 2 * kGiB){ c.detected = Tier::Reduced; c.reason = std::string(mem) + ", under 2 GiB"; }
    else if (rtCapable(p) && p.videoMemory >= 6 * kGiB){ c.detected = Tier::Rt; c.reason = std::string("DXR 1.1 ray queries and the ray tracing pipeline, ") + mem; }
    else if (rtCapable(p)){ c.detected = Tier::Raster; c.reason = std::string("ray tracing offered but ") + mem + ", under the 6 GiB the rt tier needs"; }
    else { c.detected = Tier::Raster; c.reason = std::string("no hardware ray tracing, ") + mem; }
    c.tier = c.detected;
    c.requested = requested;
    if (requested.empty()) return c;
    Tier want;
    if (!parseTier(requested, want)){ c.overrideResult = "refused: not a tier (rt, raster or reduced)"; return c; }
    if (want == Tier::Rt && !rtCapable(p)){ c.overrideResult = "refused: the adapter has no hardware ray tracing"; return c; }
    c.tier = want;
    c.overrideResult = "applied";
    return c;
}

std::string capabilitiesJson(const rhi::hw::Probe& p, const TierChoice& c){
    using rhi::hw::jsonEscape;
    std::string j = "{\"tier\":\"" + std::string(tierName(c.tier)) + "\",\"detected_tier\":\"" + tierName(c.detected)
        + "\",\"reason\":\"" + jsonEscape(c.reason) + "\",\"override\":\"" + jsonEscape(c.requested)
        + "\",\"override_result\":\"" + jsonEscape(c.overrideResult) + "\",\"probe\":" + p.json() + "}";
    return j;
}
}  // namespace raw::lwshell
