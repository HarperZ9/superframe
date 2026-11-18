#pragma once
// Game input from the devices (Low Water milestone N0): the keyboard while a window has focus and
// the first connected gamepad. One implementation per platform under src/platform/<os>/: on Windows
// the keyboard through GetAsyncKeyState and the pad through XInput 1.4 (xinput1_4.dll, part of
// Windows since 8; linked from the Windows SDK's xinput.lib). No raw input, no third-party code.
// The snapshot is device state only; turning it into a game's input is the game host's job.
#include <cstdint>
namespace raw::platform {

struct KeyboardState {
    bool focused{false};   // the window had focus; every key reads up otherwise
    bool w{false}, a{false}, s{false}, d{false}, q{false}, e{false};
    bool left{false}, right{false}, up{false}, down{false};
    bool space{false}, shift{false}, escape{false};
};
// Sticks from -1 to 1 after a radial dead zone (XInput's own recommended thresholds), up positive;
// triggers from 0 to 1.
struct GamepadState {
    bool connected{false};
    float lx{0}, ly{0}, rx{0}, ry{0}, lt{0}, rt{0};
    bool a{false}, b{false}, back{false}, start{false}, leftThumb{false};
};
struct InputSnapshot {
    KeyboardState keys;
    GamepadState pad;
};
// Read the devices now. `window` is the native handle of the window whose focus gates the keyboard.
InputSnapshot pollInput(void* window);
// What pollInput reads, for the record ("win32 GetAsyncKeyState + xinput1_4").
const char* inputBackend();
// Milliseconds since the operating system created this process; negative where unknown. A cold
// start is measured from here, so it includes the loader and static initialisation.
double processUptimeMs();

}  // namespace raw::platform
