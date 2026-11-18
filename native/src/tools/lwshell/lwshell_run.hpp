#pragma once
// Low Water's native shell (milestone N0): the window, the devices, the fixed-tick loop and the
// records. Called by app/lw_shell_main.cpp.
#include <cstdint>
#include <string>
namespace raw::lwshell {

struct Options {
    std::string tile;              // a plain PGM tile (games/low-water/runtime/tilecut)
    double cell{64};               // metres between the tile's vertices
    std::string record;            // write the input trace here
    std::string replay;            // drive the run from this input trace instead of the devices
    std::string trace;             // write the frame trace (Chrome trace events) here
    std::string shot;              // write a PNG of frame `shotFrame` here
    std::string tier;              // graphics tier override (rt, raster, reduced); else LW_TIER
    std::string caps;              // write the adapter's capabilities and the tier choice here
    uint64_t shotFrame{120};
    uint64_t frames{0};            // stop after this many frames (0: run until closed)
    uint64_t ticks{0};             // stop after this many ticks (0: no limit)
    uint32_t width{1280}, height{720}, syncInterval{1}, warmup{30};
    bool autowalk{false};          // the scripted walk instead of the devices
    bool hidden{false};            // no visible window (CI)
    bool fullscreen{false};
};
// 0 on success, 1 on a failed check (a replay whose hash differs), 2 on bad usage, 3 on a runtime
// error, 77 when there is no adapter or window (a skip).
int runShell(const Options& o);

}  // namespace raw::lwshell
