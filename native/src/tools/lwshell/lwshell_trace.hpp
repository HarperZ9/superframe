#pragma once
// Private to src/tools/lwshell/: Low Water's native shell (milestone N0). The game itself is
// BuildLang (games/low-water/runtime/game/main.bld), compiled by buildc's C backend and reached
// through the C header it generates (lw_game.h). This part is portable: the input trace, the
// mapping from device state to the game's integer input, and the replay that the exit check runs.
//
// The input trace (lw-input-1), one record a line:
//   lw-input-1
//   tile <name> <fnv1a-64 of the tile's bytes, hex> <cell metres>
//   r <count> <move_x> <move_y> <turn> <buttons>     count ticks of the same input, in order
//   hash <ticks> <fnv1a-64 state hash after the last tick, hex>
#include "lw_game.h"
#include <cstdint>
#include <string>
#include <vector>
namespace raw::platform { struct InputSnapshot; }
namespace raw::lwshell {

using Tick = LwInput;
inline bool sameTick(const Tick& a, const Tick& b){
    return a.move_x == b.move_x && a.move_y == b.move_y && a.turn == b.turn && a.buttons == b.buttons;
}

struct InputTrace {
    std::string tile;
    uint64_t tileHash{0};
    double cell{64};
    std::vector<Tick> ticks;
    bool hasHash{false};
    uint64_t finalHash{0};
};
std::string writeTrace(const InputTrace& t);
bool readTrace(const std::string& text, InputTrace& t, std::string& err);

uint64_t fnv1a(const void* data, std::size_t n);
std::string hex64(uint64_t v);
bool readFile(const std::string& path, std::string& out);
bool writeFile(const std::string& path, const std::string& text);

// The game on a tile. Owns the BuildLang handle.
class Game {
public:
    ~Game();
    bool open(const std::string& tileBytes, double cell, std::string& err);
    void step(const Tick& t){ lw_game_step(g_, t); }
    uint64_t hash() const { return lw_game_hash(g_); }
    LwView view() const { LwView v{}; lw_game_view(g_, &v); return v; }
    ::Game* raw() const { return g_; }
private:
    ::Game* g_{nullptr};
};

// Run `ticks` from a fresh game on the tile; the state hash after the last one.
bool replay(const std::string& tileBytes, double cell, const std::vector<Tick>& ticks, uint64_t& hash, std::string& err);

// Device state to the game's input. Keyboard: W S forward and back, A D strafe, Q E or the arrows
// turn, Space jumps, Shift runs. Pad: left stick moves, right stick turns, A jumps, the right
// trigger or a left-stick click runs.
Tick mapInput(const platform::InputSnapshot& s);
bool quitRequested(const platform::InputSnapshot& s);

// The scripted walk of an unattended run (--autowalk): the same ticks every run, so a recording
// of it is reproducible on any machine. Walks, runs, turns, jumps and stands.
Tick autowalk(uint64_t tick);

}  // namespace raw::lwshell
