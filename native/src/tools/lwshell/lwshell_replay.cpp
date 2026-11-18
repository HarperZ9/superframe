// lw_shell_replay: replay a Low Water input trace (lw-input-1) on its tile, with no window or GPU,
// and compare the state hash with the one the live run wrote (milestone N0's replay check).
//
//   lw_shell_replay <trace> --tile <tile.pgm> [--perturb <tick>]
//
// Without --perturb: exit 0 when the replayed hash equals the trace's hash. With --perturb the
// input of one tick is dropped (set to no input; a tick that had none gains a step forward). That
// is the control of the check: exit 0 only when the hash then differs, so a check that cannot fail
// fails. Exit 1 on a failed check, 2 on bad usage.
#include "raw/tools/lwshell_cmd.hpp"
#include "lwshell_trace.hpp"
#include <cstdio>
#include <cstdlib>
#include <string>
namespace raw {
using namespace lwshell;
int lwShellReplayCommand(int argc, char** argv){
    std::string tracePath, tilePath;
    long long perturb = -1;
    for (int i = 1; i < argc; ++i){
        const std::string a = argv[i];
        if (a == "--tile" && i + 1 < argc) tilePath = argv[++i];
        else if (a == "--perturb" && i + 1 < argc) perturb = std::atoll(argv[++i]);
        else if (tracePath.empty()) tracePath = a;
        else { std::fprintf(stderr, "unknown argument %s\n", a.c_str()); return 2; }
    }
    if (tracePath.empty() || tilePath.empty()){ std::fprintf(stderr, "usage: lw_shell_replay <trace> --tile <tile.pgm> [--perturb <tick>]\n"); return 2; }
    std::string text, tile, err;
    if (!readFile(tracePath, text)){ std::fprintf(stderr, "cannot read %s\n", tracePath.c_str()); return 2; }
    if (!readFile(tilePath, tile)){ std::fprintf(stderr, "cannot read %s\n", tilePath.c_str()); return 2; }
    InputTrace t;
    if (!readTrace(text, t, err)){ std::fprintf(stderr, "%s: %s\n", tracePath.c_str(), err.c_str()); return 2; }
    if (!t.hasHash){ std::fprintf(stderr, "%s has no hash line\n", tracePath.c_str()); return 2; }
    const uint64_t tileHash = fnv1a(tile.data(), tile.size());
    if (tileHash != t.tileHash){
        std::printf("FAIL tile %s hashes %s, the trace was recorded on %s\n", tilePath.c_str(), hex64(tileHash).c_str(), hex64(t.tileHash).c_str());
        return 1;
    }
    std::vector<Tick> ticks = t.ticks;
    if (perturb >= 0){
        if (perturb >= (long long)ticks.size()){ std::fprintf(stderr, "--perturb %lld is past the last tick (%zu)\n", perturb, ticks.size()); return 2; }
        Tick& k = ticks[std::size_t(perturb)];
        if (sameTick(k, Tick{})) k.move_y = 1000;   // a tick with no input gains one instead
        else k = Tick{};
    }
    uint64_t h = 0;
    if (!replay(tile, t.cell, ticks, h, err)){ std::fprintf(stderr, "%s\n", err.c_str()); return 1; }
    const bool same = h == t.finalHash;
    std::printf("ticks %zu  recorded %s  replayed %s  %s\n", ticks.size(), hex64(t.finalHash).c_str(), hex64(h).c_str(), same ? "same" : "different");
    if (perturb >= 0){
        std::printf("control: input of tick %lld perturbed: %s\n", perturb, same ? "FAIL, the hash did not change" : "ok, the hash changed");
        return same ? 1 : 0;
    }
    return same ? 0 : 1;
}
}  // namespace raw
