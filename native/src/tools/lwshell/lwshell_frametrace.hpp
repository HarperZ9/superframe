#pragma once
// Private to src/tools/lwshell/: the frame trace. CPU zones on thread 1 and GPU zones on thread 2,
// written as Chrome trace events (chrome://tracing and Perfetto open the file as it is), with a
// summary of frame pacing beside the events. GPU zones come from the frame's timestamps and are
// placed on the CPU timeline at the start of that frame's render zone: their lengths are measured
// on the GPU clock, their placement is not (the RHI has no clock calibration yet).
#include <cstdint>
#include <string>
#include <vector>
namespace raw::lwshell {

struct Zone { std::string name; int tid; double tsUs, durUs; uint64_t frame; };
struct Summary {
    std::string adapter, backend, input, tile;
    std::string capabilities{"null"};   // capabilitiesJson: the probe and the graphics tier
    uint32_t width{0}, height{0}, syncInterval{1};
    double refreshHz{0};
    double mainEntryMs{-1}, firstPresentMs{-1}, walkingMs{-1};   // process uptime at each moment
    uint64_t frames{0}, ticks{0}, terrainTriangles{0};
    uint64_t finalHash{0};
    std::vector<double> intervalsMs;   // present to present, after the warm-up frames
    uint32_t warmup{0};
};
double percentile(std::vector<double> v, double q);
std::string frameTraceJson(const Summary& s, const std::vector<Zone>& zones);

}  // namespace raw::lwshell
