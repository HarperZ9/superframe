// The lw_shell command line (raw/tools/lwshell_cmd.hpp): Low Water as a native Windows program
// (milestone N0). The game code is BuildLang (games/low-water/runtime/game/main.bld), linked over
// its C ABI; this is the engine side: window, keyboard and pad, D3D12 with a waitable swapchain,
// the fixed-tick loop, the input trace and the frame trace (options in lwshell_run.hpp).
//
//   lw_shell --tile t_3_1.pgm [--record run.lwin] [--replay run.lwin] [--trace frames.json]
//            [--shot shot.png --shot-frame 120] [--frames N] [--ticks N] [--autowalk]
//            [--width 1280 --height 720] [--vsync on|off] [--hidden] [--fullscreen] [--cell 64]
//            [--tier rt|raster|reduced] [--caps caps.json]
#include "raw/tools/lwshell_cmd.hpp"
#include "lwshell_run.hpp"
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>

namespace raw {
int lwShellCommand(int argc, char** argv){
    lwshell::Options o;
    for (int i = 1; i < argc; ++i){
        const std::string a = argv[i];
        auto next = [&]() -> const char* {
            if (i + 1 >= argc){ std::fprintf(stderr, "%s needs a value\n", a.c_str()); std::exit(2); }
            return argv[++i];
        };
        if (a == "--tile") o.tile = next();
        else if (a == "--cell") o.cell = std::atof(next());
        else if (a == "--record") o.record = next();
        else if (a == "--replay") o.replay = next();
        else if (a == "--trace") o.trace = next();
        else if (a == "--shot") o.shot = next();
        else if (a == "--tier") o.tier = next();
        else if (a == "--caps") o.caps = next();
        else if (a == "--shot-frame") o.shotFrame = std::strtoull(next(), nullptr, 10);
        else if (a == "--frames") o.frames = std::strtoull(next(), nullptr, 10);
        else if (a == "--ticks") o.ticks = std::strtoull(next(), nullptr, 10);
        else if (a == "--width") o.width = (uint32_t)std::strtoul(next(), nullptr, 10);
        else if (a == "--height") o.height = (uint32_t)std::strtoul(next(), nullptr, 10);
        else if (a == "--warmup") o.warmup = (uint32_t)std::strtoul(next(), nullptr, 10);
        else if (a == "--vsync") o.syncInterval = std::strcmp(next(), "off") == 0 ? 0 : 1;
        else if (a == "--autowalk") o.autowalk = true;
        else if (a == "--hidden") o.hidden = true;
        else if (a == "--fullscreen") o.fullscreen = true;
        else { std::fprintf(stderr, "unknown option %s\n", a.c_str()); return 2; }
    }
    if (o.tile.empty()){ std::fprintf(stderr, "usage: lw_shell --tile <tile.pgm> [options]; see src/tools/lwshell/lwshell_cmd.cpp\n"); return 2; }
    return lwshell::runShell(o);
}
}  // namespace raw
