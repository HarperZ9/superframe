#pragma once
// Private to src/tools/lwshell/: the graphics tier, chosen once at start-up from what the adapter
// offers, so every later system (lighting, shadows, GI, upscaling) branches on one choice.
// The author's ruling (2026-11-18): hardware ray tracing on PC, a full path for graphics cards
// without ray tracing, and a reduced path for the Steam Deck.
//   rt       DXR 1.1 (inline ray queries) and the ray tracing pipeline, with at least 6 GiB of
//            dedicated video memory
//   raster   the full raster path, for every other discrete adapter
//   reduced  the Steam Deck, software adapters (WARP) and adapters with under 2 GiB of dedicated
//            video memory
// An override (--tier, or LW_TIER in the environment) wins when the adapter can run the tier it
// names; a request the adapter cannot run is refused and recorded, never silently honoured.
#include "raw/rhi/hw.hpp"
#include <string>
namespace raw::lwshell {

enum class Tier { Rt, Raster, Reduced };
const char* tierName(Tier t);
bool parseTier(const std::string& s, Tier& out);

struct TierChoice {
    Tier tier{Tier::Raster};
    Tier detected{Tier::Raster};   // what the adapter alone selects
    std::string reason;            // why the detected tier, in words
    std::string requested;         // the override as given, empty for none
    std::string overrideResult;    // "applied", "refused: ..." or empty
};
// Pure: the probe and the override text in, the choice out (tested by test_lwshell_tier).
TierChoice chooseTier(const rhi::hw::Probe& p, const std::string& requested);
// The capabilities and the choice as one JSON object, for the log and the frame trace.
std::string capabilitiesJson(const rhi::hw::Probe& p, const TierChoice& c);

}  // namespace raw::lwshell
