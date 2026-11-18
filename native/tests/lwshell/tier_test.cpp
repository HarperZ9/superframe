// The graphics tier choice (src/tools/lwshell/lwshell_tier.hpp) on made-up adapters: each rule,
// and the override refusing a tier the adapter cannot run.
#include "check.hpp"
#include "lwshell_tier.hpp"
using namespace raw;
using namespace raw::lwshell;

static rhi::hw::Probe adapter(const char* name, const char* vendor, double gib, bool rt){
    rhi::hw::Probe p;
    p.adapter = name; p.vendor = vendor; p.videoMemory = uint64_t(gib * 1024 * 1024 * 1024);
    p.add(rhi::hw::kRayPipeline, rt, "test", "");
    p.add(rhi::hw::kRayQuery, rt, "test", "");
    return p;
}

int main(){
    CHECK(chooseTier(adapter("NVIDIA GeForce RTX 4090", "0x10de", 24, true), "").tier == Tier::Rt);
    CHECK(chooseTier(adapter("NVIDIA GeForce RTX 2060 SUPER", "0x10de", 7.8, true), "").tier == Tier::Rt);
    CHECK(chooseTier(adapter("NVIDIA GeForce GTX 1070", "0x10de", 8, false), "").tier == Tier::Raster);
    CHECK(chooseTier(adapter("NVIDIA GeForce RTX 3050", "0x10de", 4, true), "").tier == Tier::Raster);   // RT, too little memory
    CHECK(chooseTier(adapter("Microsoft Basic Render Driver", "0x1414", 0, false), "").tier == Tier::Reduced);
    CHECK(chooseTier(adapter("AMD Custom GPU 0405", "0x1002", 1, false), "").tier == Tier::Reduced);
    CHECK(chooseTier(adapter("Intel(R) UHD Graphics", "0x8086", 0.125, false), "").tier == Tier::Reduced);

    // Overrides: a lower tier applies; rt on an adapter without ray tracing is refused.
    TierChoice c = chooseTier(adapter("NVIDIA GeForce RTX 4090", "0x10de", 24, true), "reduced");
    CHECK(c.tier == Tier::Reduced && c.detected == Tier::Rt && c.overrideResult == "applied");
    c = chooseTier(adapter("NVIDIA GeForce GTX 1070", "0x10de", 8, false), "rt");
    CHECK(c.tier == Tier::Raster && c.overrideResult.rfind("refused", 0) == 0);
    c = chooseTier(adapter("NVIDIA GeForce GTX 1070", "0x10de", 8, false), "ultra");
    CHECK(c.tier == Tier::Raster && c.overrideResult.rfind("refused", 0) == 0);
    // Control: forcing ray tracing off (RAW_NATIVE_HW_DISABLE's path) moves an RT card to raster.
    rhi::hw::Probe off = adapter("NVIDIA GeForce RTX 4090", "0x10de", 24, true);
    off.features[1].forcedOff = true;
    CHECK(chooseTier(off, "").tier == Tier::Raster);
    CHECK(capabilitiesJson(off, chooseTier(off, "")).find("\"tier\":\"raster\"") != std::string::npos);
    return raw_test_summary();
}
