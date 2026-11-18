// The Win32 half of raw/platform/input.hpp: GetAsyncKeyState for the keyboard while the window has
// focus, XInput 1.4 for the first connected pad, GetProcessTimes for the process's age.
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <xinput.h>
#include "raw/platform/input.hpp"
#include <cmath>
namespace raw::platform {
namespace {
bool down(int vk){ return (GetAsyncKeyState(vk) & 0x8000) != 0; }
// A radial dead zone: inside it the stick reads zero; outside it the magnitude is rescaled to 0..1.
void stick(SHORT x, SHORT y, SHORT zone, float& ox, float& oy){
    const float fx = float(x), fy = float(y);
    const float m = std::sqrt(fx * fx + fy * fy);
    if (m <= float(zone)){ ox = oy = 0; return; }
    const float scaled = std::fmin((m - float(zone)) / (32767.0f - float(zone)), 1.0f);
    ox = fx / m * scaled; oy = fy / m * scaled;
}
float trigger(BYTE t){ return t <= XINPUT_GAMEPAD_TRIGGER_THRESHOLD ? 0.0f : float(t - XINPUT_GAMEPAD_TRIGGER_THRESHOLD) / float(255 - XINPUT_GAMEPAD_TRIGGER_THRESHOLD); }
}  // namespace

InputSnapshot pollInput(void* window){
    InputSnapshot s;
    KeyboardState& k = s.keys;
    k.focused = window && GetForegroundWindow() == (HWND)window;
    if (k.focused){
        k.w = down('W'); k.a = down('A'); k.s = down('S'); k.d = down('D'); k.q = down('Q'); k.e = down('E');
        k.left = down(VK_LEFT); k.right = down(VK_RIGHT); k.up = down(VK_UP); k.down = down(VK_DOWN);
        k.space = down(VK_SPACE); k.shift = down(VK_SHIFT); k.escape = down(VK_ESCAPE);
    }
    for (DWORD i = 0; i < XUSER_MAX_COUNT; ++i){
        XINPUT_STATE st{};
        if (XInputGetState(i, &st) != ERROR_SUCCESS) continue;
        GamepadState& p = s.pad;
        const XINPUT_GAMEPAD& g = st.Gamepad;
        p.connected = true;
        stick(g.sThumbLX, g.sThumbLY, XINPUT_GAMEPAD_LEFT_THUMB_DEADZONE, p.lx, p.ly);
        stick(g.sThumbRX, g.sThumbRY, XINPUT_GAMEPAD_RIGHT_THUMB_DEADZONE, p.rx, p.ry);
        p.lt = trigger(g.bLeftTrigger); p.rt = trigger(g.bRightTrigger);
        p.a = g.wButtons & XINPUT_GAMEPAD_A; p.b = g.wButtons & XINPUT_GAMEPAD_B;
        p.back = g.wButtons & XINPUT_GAMEPAD_BACK; p.start = g.wButtons & XINPUT_GAMEPAD_START;
        p.leftThumb = g.wButtons & XINPUT_GAMEPAD_LEFT_THUMB;
        break;
    }
    return s;
}
const char* inputBackend(){ return "win32 GetAsyncKeyState + xinput1_4"; }

double processUptimeMs(){
    FILETIME created, exited, kernel, user, now;
    if (!GetProcessTimes(GetCurrentProcess(), &created, &exited, &kernel, &user)) return -1;
    GetSystemTimePreciseAsFileTime(&now);
    const auto ticks = [](const FILETIME& f){ return (uint64_t(f.dwHighDateTime) << 32) | f.dwLowDateTime; };
    return double(ticks(now) - ticks(created)) / 1e4;   // FILETIME counts 100 ns
}
}  // namespace raw::platform
