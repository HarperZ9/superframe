// The portable half of Low Water's native shell: see lwshell_trace.hpp.
#include "lwshell_trace.hpp"
#include "raw/platform/input.hpp"
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <sstream>
namespace raw::lwshell {

uint64_t fnv1a(const void* data, std::size_t n){
    uint64_t h = 14695981039346656037ull;
    const unsigned char* p = static_cast<const unsigned char*>(data);
    for (std::size_t i = 0; i < n; ++i){ h ^= p[i]; h *= 1099511628211ull; }
    return h;
}
std::string hex64(uint64_t v){
    char b[17];
    std::snprintf(b, sizeof b, "%016llx", (unsigned long long)v);
    return b;
}
bool readFile(const std::string& path, std::string& out){
    std::ifstream f(path, std::ios::binary);
    if (!f) return false;
    std::ostringstream s; s << f.rdbuf();
    out = s.str();
    return true;
}
bool writeFile(const std::string& path, const std::string& text){
    std::ofstream f(path, std::ios::binary);
    f << text;
    return bool(f);
}

std::string writeTrace(const InputTrace& t){
    std::ostringstream o;
    o << "lw-input-1\n" << "tile " << t.tile << " " << hex64(t.tileHash) << " " << t.cell << "\n";
    for (std::size_t i = 0; i < t.ticks.size();){
        std::size_t j = i + 1;
        while (j < t.ticks.size() && sameTick(t.ticks[j], t.ticks[i])) ++j;
        const Tick& k = t.ticks[i];
        o << "r " << (j - i) << " " << k.move_x << " " << k.move_y << " " << k.turn << " " << k.buttons << "\n";
        i = j;
    }
    if (t.hasHash) o << "hash " << t.ticks.size() << " " << hex64(t.finalHash) << "\n";
    return o.str();
}

bool readTrace(const std::string& text, InputTrace& t, std::string& err){
    t = {};
    std::istringstream in(text);
    std::string line;
    if (!std::getline(in, line) || line.rfind("lw-input-1", 0) != 0){ err = "not an lw-input-1 trace"; return false; }
    int n = 1;
    while (std::getline(in, line)){
        ++n;
        if (line.empty()) continue;
        std::istringstream l(line);
        std::string kind; l >> kind;
        if (kind == "tile"){
            std::string h; l >> t.tile >> h >> t.cell;
            t.tileHash = std::strtoull(h.c_str(), nullptr, 16);
        } else if (kind == "r"){
            long long count = 0; Tick k{};
            l >> count >> k.move_x >> k.move_y >> k.turn >> k.buttons;
            if (!l || count <= 0){ err = "line " + std::to_string(n) + ": bad run"; return false; }
            t.ticks.insert(t.ticks.end(), std::size_t(count), k);
        } else if (kind == "hash"){
            std::size_t ticks = 0; std::string h; l >> ticks >> h;
            if (ticks != t.ticks.size()){ err = "the hash line counts " + std::to_string(ticks) + " ticks, the runs " + std::to_string(t.ticks.size()); return false; }
            t.finalHash = std::strtoull(h.c_str(), nullptr, 16); t.hasHash = true;
        } else { err = "line " + std::to_string(n) + ": unknown record " + kind; return false; }
    }
    return true;
}

Game::~Game(){ if (g_) lw_game_destroy(g_); }
bool Game::open(const std::string& tileBytes, double cell, std::string& err){
    g_ = lw_game_create((uint8_t*)tileBytes.data(), tileBytes.size(), cell);
    if (!g_){ err = "lw_game_create refused the tile (error " + std::to_string(lw_game_last_error()) + ")"; return false; }
    return true;
}

bool replay(const std::string& tileBytes, double cell, const std::vector<Tick>& ticks, uint64_t& hash, std::string& err){
    Game g;
    if (!g.open(tileBytes, cell, err)) return false;
    for (const Tick& t : ticks) g.step(t);
    hash = g.hash();
    return true;
}

namespace {
int32_t axis(float v){ return int32_t(std::lround(std::fmax(-1.0f, std::fmin(1.0f, v)) * 1000.0f)); }
}
Tick mapInput(const platform::InputSnapshot& s){
    const platform::KeyboardState& k = s.keys;
    const platform::GamepadState& p = s.pad;
    float mx = float(k.d) - float(k.a), my = float(k.w || k.up) - float(k.s || k.down);
    float turn = float(k.e || k.right) - float(k.q || k.left);
    bool jump = k.space, run = k.shift;
    if (p.connected){
        mx += p.lx; my += p.ly; turn += p.rx;
        jump = jump || p.a; run = run || p.rt > 0.5f || p.leftThumb;
    }
    Tick t{};
    t.move_x = axis(mx); t.move_y = axis(my); t.turn = axis(turn);
    t.buttons = (jump ? 1 : 0) | (run ? 2 : 0);
    return t;
}
bool quitRequested(const platform::InputSnapshot& s){ return s.keys.escape || (s.pad.connected && s.pad.back); }

Tick autowalk(uint64_t tick){
    Tick t{};
    const uint64_t c = tick % 900;   // a 15 s loop at 60 ticks a second
    if (c < 240){ t.move_y = 1000; }
    else if (c < 300){ t.move_y = 1000; t.turn = 600; }
    else if (c < 480){ t.move_y = 1000; t.buttons = 2; }
    else if (c < 490){ t.move_y = 1000; t.buttons = 3; }
    else if (c < 600){ t.move_y = 700; t.move_x = -500; t.turn = -400; }
    else if (c < 720){ t.move_y = 1000; t.turn = 250; t.buttons = 2; }
    // 720 .. 899 stands still
    return t;
}
}  // namespace raw::lwshell
