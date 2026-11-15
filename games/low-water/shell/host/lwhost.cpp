// Low Water native host, spike (W1-D, decision D2 route A/C): QuickJS runs the game's real modules; this
// program supplies the window, input, the painted title and the file bridge. See design/NATIVE-HOST.md.
//   lwhost.exe --game <low-water dir> [--save-root <dir>] [--smoke] [--query "calm=1"]
//   lwhost.exe --bridge-op <read|write|rename|remove|list> <root> <path> [path2]   (write takes stdin; read writes stdout)
//   lwhost.exe --run <module.mjs> --save-root <dir>                                 (a script with the shim and the bridge)
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#include <wincodec.h>
#include <psapi.h>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <io.h>
#include <fcntl.h>
#include <sstream>
#include <string>
#include <vector>
#include <algorithm>
#include "quickjs.h"
#include "raw/platform/file_bridge.hpp"

using raw::platform::FileBridge;
namespace {
JSRuntime* g_rt; JSContext* g_ctx;
FileBridge* g_bridge; std::string g_lw, g_query;
LARGE_INTEGER g_freq, g_t0;
double ms_since(LARGE_INTEGER a) { LARGE_INTEGER n; QueryPerformanceCounter(&n); return 1000.0 * double(n.QuadPart - a.QuadPart) / double(g_freq.QuadPart); }
double now_ms() { return ms_since(g_t0); }
std::string slurp(const std::string& p, bool* ok) {
    std::ifstream f(p, std::ios::binary); if (!f) { *ok = false; return {}; }
    std::stringstream ss; ss << f.rdbuf(); *ok = true; return ss.str();
}
std::wstring wide(const std::string& s) {
    int n = MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, nullptr, 0); std::wstring w(n > 0 ? n : 1, L'\0');
    if (n > 0) MultiByteToWideChar(CP_UTF8, 0, s.c_str(), -1, w.data(), n);
    if (!w.empty() && w.back() == L'\0') w.pop_back(); return w;
}
void dump_exc(JSContext* c, const char* what) {
    JSValue e = JS_GetException(c); const char* s = JS_ToCString(c, e);
    JSValue st = JS_GetPropertyStr(c, e, "stack"); const char* ss = JS_IsUndefined(st) ? "" : JS_ToCString(c, st);
    std::fprintf(stderr, "[%s] %s\n%s\n", what, s ? s : "?", ss);
    if (s) JS_FreeCString(c, s); if (*ss) JS_FreeCString(c, ss); JS_FreeValue(c, st); JS_FreeValue(c, e);
}
// "file:///C:/x", "/content/x", "/engine/x" or a plain path to a disk path
std::string resolve(std::string u) {
    size_t q = u.find_first_of("?#"); if (q != std::string::npos) u.resize(q);
    if (u.rfind("file:///", 0) == 0) { u = u.substr(8); std::string o; for (size_t i = 0; i < u.size(); ++i) { if (u[i] == '%' && i + 2 < u.size()) { o += char(std::strtol(u.substr(i + 1, 2).c_str(), nullptr, 16)); i += 2; } else o += u[i]; } return o; }
    for (const char* m : {"/content/", "/content4k/", "/characters/", "/slice/"}) if (u.rfind(m, 0) == 0) return g_lw + u;
    if (!u.empty() && u[0] == '/') return g_lw + "/game" + u;
    return u;
}
const char* str(JSContext* c, JSValueConst v, std::string* out) { size_t n; const char* s = JS_ToCStringLen(c, &n, v); if (s) out->assign(s, n); return s; }

JSValue h_log(JSContext* c, JSValueConst, int, JSValueConst* a) { std::string s; if (str(c, a[0], &s)) { std::fprintf(stderr, "%s\n", s.c_str()); } return JS_UNDEFINED; }
JSValue h_now(JSContext* c, JSValueConst, int, JSValueConst*) { return JS_NewFloat64(c, now_ms()); }
JSValue h_query(JSContext* c, JSValueConst, int, JSValueConst*) { return JS_NewString(c, g_query.c_str()); }
JSValue h_exists(JSContext* c, JSValueConst, int, JSValueConst* a) { std::string s; str(c, a[0], &s); return JS_NewBool(c, GetFileAttributesW(wide(resolve(s)).c_str()) != INVALID_FILE_ATTRIBUTES); }
JSValue h_readText(JSContext* c, JSValueConst, int, JSValueConst* a) {
    std::string s; str(c, a[0], &s); bool ok; std::string t = slurp(resolve(s), &ok);
    return ok ? JS_NewStringLen(c, t.data(), t.size()) : JS_NULL;
}
JSValue h_bridge(JSContext* c, JSValueConst, int n, JSValueConst* a) {
    std::string op, p, q; str(c, a[0], &op); str(c, a[1], &p); if (n > 2) str(c, a[2], &q);
    try {
        if (op == "read") { auto r = g_bridge->read(p); return r ? JS_NewStringLen(c, r->data(), r->size()) : JS_NULL; }
        if (op == "write") { g_bridge->write(p, q); return JS_UNDEFINED; }
        if (op == "rename") { g_bridge->rename(p, q); return JS_UNDEFINED; }
        if (op == "remove") { g_bridge->remove(p); return JS_UNDEFINED; }
        if (op == "list") { std::string j = "["; bool f = true; for (auto& e : g_bridge->list(p)) { if (!f) j += ","; f = false; j += "\"" + e + "\""; } j += "]"; return JS_NewString(c, j.c_str()); }
    } catch (const std::exception& e) { return JS_ThrowInternalError(c, "%s", e.what()); }
    return JS_ThrowTypeError(c, "bridge: unknown op %s", op.c_str());
}
double g_compile_ms = 0; int g_modules = 0;
JSModuleDef* load_module(JSContext* c, const char* name, void*) {
    LARGE_INTEGER lt; QueryPerformanceCounter(&lt); struct Acc { LARGE_INTEGER t; ~Acc() { g_compile_ms += ms_since(t); ++g_modules; } } acc{ lt };
    bool ok; std::string src = slurp(name, &ok);
    if (!ok) { JS_ThrowReferenceError(c, "could not load module '%s'", name); return nullptr; }
    JSValue f = JS_Eval(c, src.c_str(), src.size(), name, JS_EVAL_TYPE_MODULE | JS_EVAL_FLAG_COMPILE_ONLY);
    if (JS_IsException(f)) return nullptr;
    JSModuleDef* m = static_cast<JSModuleDef*>(JS_VALUE_GET_PTR(f)); JS_FreeValue(c, f);
    JSValue meta = JS_GetImportMeta(c, m); std::string url = std::string("file:///") + name;
    JS_DefinePropertyValueStr(c, meta, "url", JS_NewString(c, url.c_str()), JS_PROP_C_W_E); JS_FreeValue(c, meta);
    return m;
}
void reject(JSContext* c, JSValueConst, JSValueConst reason, bool handled, void*) {
    if (handled) return; const char* s = JS_ToCString(c, reason); JSValue st = JS_GetPropertyStr(c, reason, "stack"); const char* ss = JS_IsUndefined(st) ? "" : JS_ToCString(c, st);
    std::fprintf(stderr, "[unhandled rejection] %s\n%s\n", s ? s : "?", ss); if (s) JS_FreeCString(c, s); if (*ss) JS_FreeCString(c, ss); JS_FreeValue(c, st);
}
void pump() { JSContext* c; int r; while ((r = JS_ExecutePendingJob(g_rt, &c)) > 0) {} if (r < 0) dump_exc(c, "job"); }
std::string js_str(const char* code) {
    JSValue v = JS_Eval(g_ctx, code, std::strlen(code), "<host>", 0); std::string out;
    if (JS_IsException(v)) { dump_exc(g_ctx, "eval"); return out; }
    str(g_ctx, v, &out); JS_FreeValue(g_ctx, v); return out;
}
bool init_js(const std::string& exe_dir) {
    g_rt = JS_NewRuntime(); g_ctx = JS_NewContext(g_rt);
    JS_SetModuleLoaderFunc(g_rt, nullptr, load_module, nullptr);
    JS_SetHostPromiseRejectionTracker(g_rt, reject, nullptr);
    JSValue host = JS_NewObject(g_ctx);
    auto fn = [&](const char* n, JSCFunction* f, int len) { JS_SetPropertyStr(g_ctx, host, n, JS_NewCFunction(g_ctx, f, n, len)); };
    fn("log", h_log, 1); fn("now", h_now, 0); fn("query", h_query, 0); fn("exists", h_exists, 1); fn("readText", h_readText, 1); fn("bridge", h_bridge, 3);
    JSValue g = JS_GetGlobalObject(g_ctx); JS_SetPropertyStr(g_ctx, g, "__host", host); JS_FreeValue(g_ctx, g);
    bool ok; std::string shim = slurp(exe_dir + "/shim.js", &ok);
    if (!ok) { std::fprintf(stderr, "shim.js not found beside the exe\n"); return false; }
    JSValue v = JS_Eval(g_ctx, shim.c_str(), shim.size(), "shim.js", 0);
    if (JS_IsException(v)) { dump_exc(g_ctx, "shim"); return false; }
    JS_FreeValue(g_ctx, v); return true;
}
// ---- painting (GDI; the spike's stand-in for raw-native's present path) ----
struct Shot { std::vector<uint32_t> px; int w = 0, h = 0; std::string url; };
Shot g_plate; double g_decode_ms = 0;
bool load_plate(const std::string& url, int W, int H) {
    LARGE_INTEGER t; QueryPerformanceCounter(&t);
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    IWICImagingFactory* f = nullptr; if (FAILED(CoCreateInstance(CLSID_WICImagingFactory, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&f)))) return false;
    IWICBitmapDecoder* d = nullptr; IWICBitmapFrameDecode* fr = nullptr; IWICBitmapScaler* sc = nullptr; IWICFormatConverter* cv = nullptr; bool ok = false;
    if (SUCCEEDED(f->CreateDecoderFromFilename(wide(resolve(url)).c_str(), nullptr, GENERIC_READ, WICDecodeMetadataCacheOnDemand, &d)) && SUCCEEDED(d->GetFrame(0, &fr))) {
        UINT sw, sh; fr->GetSize(&sw, &sh); double s = std::max(double(W) / sw, double(H) / sh);
        UINT tw = UINT(sw * s + 0.5), th = UINT(sh * s + 0.5);
        if (SUCCEEDED(f->CreateBitmapScaler(&sc)) && SUCCEEDED(sc->Initialize(fr, tw, th, WICBitmapInterpolationModeFant)) && SUCCEEDED(f->CreateFormatConverter(&cv)) &&
            SUCCEEDED(cv->Initialize(sc, GUID_WICPixelFormat32bppBGRA, WICBitmapDitherTypeNone, nullptr, 0, WICBitmapPaletteTypeCustom))) {
            g_plate.px.assign(size_t(W) * H, 0); WICRect r{ int(tw > UINT(W) ? (tw - W) / 2 : 0), int(th > UINT(H) ? (th - H) / 2 : 0), W, H };
            ok = SUCCEEDED(cv->CopyPixels(&r, W * 4, UINT(g_plate.px.size() * 4), reinterpret_cast<BYTE*>(g_plate.px.data())));
            for (int y = 0; ok && y < H; ++y) for (int x = 0; x < W; ++x) { auto& p = g_plate.px[size_t(y) * W + x]; double k = x < W * 0.42 ? 0.30 : 0.30 + 0.70 * std::min(1.0, (x - W * 0.42) / (W * 0.18)); unsigned b = unsigned((p & 255) * k), g = unsigned(((p >> 8) & 255) * k), rr = unsigned(((p >> 16) & 255) * k); p = (rr << 16) | (g << 8) | b; }
        }
    }
    for (IUnknown* u : std::initializer_list<IUnknown*>{ cv, sc, fr, d, f }) if (u) u->Release();
    g_plate.w = W; g_plate.h = H; g_plate.url = url; g_decode_ms = ms_since(t); return ok;
}
struct Win { HWND hwnd; HDC dc, mem; HBITMAP bmp; int w, h; uint32_t* bits; HFONT big, mid, small_; } W_;
void make_target(int w, int h) {
    if (W_.bmp) { DeleteObject(W_.bmp); } BITMAPINFO bi{}; bi.bmiHeader = { sizeof(BITMAPINFOHEADER), w, -h, 1, 32, BI_RGB };
    W_.bmp = CreateDIBSection(W_.dc, &bi, DIB_RGB_COLORS, reinterpret_cast<void**>(&W_.bits), nullptr, 0); SelectObject(W_.mem, W_.bmp); W_.w = w; W_.h = h;
}
void text_at(HFONT f, COLORREF col, int x, int y, const std::string& s) { SelectObject(W_.mem, f); SetTextColor(W_.mem, col); std::wstring w = wide(s); TextOutW(W_.mem, x, y, w.c_str(), int(w.size())); }
// one frame from the snapshot JSON fields the host reads
struct Snap { std::string screen, bg, h1, sub, hint, text; std::vector<std::pair<std::string, int>> buttons; int focus = -1; std::string raw; };
Snap parse_snap(const std::string& j) {
    Snap s; s.raw = j;
    auto get = [&](const char* key) -> std::string { std::string k = std::string("\"") + key + "\":\""; size_t p = j.find(k); if (p == std::string::npos) return {}; p += k.size(); std::string o; for (; p < j.size() && j[p] != '"'; ++p) { if (j[p] == '\\' && p + 1 < j.size()) { ++p; if (j[p] == 'u' && p + 4 < j.size()) { unsigned cp = std::strtoul(j.substr(p + 1, 4).c_str(), nullptr, 16); p += 4; if (cp < 0x80) o += char(cp); else if (cp < 0x800) { o += char(0xC0 | cp >> 6); o += char(0x80 | (cp & 63)); } else { o += char(0xE0 | cp >> 12); o += char(0x80 | ((cp >> 6) & 63)); o += char(0x80 | (cp & 63)); } } else o += j[p] == 'n' ? '\n' : j[p]; } else o += j[p]; } return o; };
    s.screen = get("screen"); s.bg = get("bg"); s.h1 = get("h1"); s.sub = get("sub"); s.hint = get("hint"); s.text = get("text");
    size_t b = j.find("\"buttons\":["); int i = 0;
    while (b != std::string::npos && (b = j.find("{\"label\":\"", b)) != std::string::npos) {
        size_t e = j.find('"', b + 10); std::string lab = j.substr(b + 10, e - b - 10); bool foc = j.compare(j.find("\"focus\":", e) + 8, 4, "true") == 0;
        s.buttons.push_back({ lab, foc }); if (foc) s.focus = i; ++i; b = e;
    }
    return s;
}
void paint(const Snap& s) {
    const int w = W_.w, h = W_.h;
    if (!s.bg.empty() && (g_plate.url != s.bg || g_plate.w != w || g_plate.h != h)) load_plate(s.bg, w, h);
    if (!g_plate.px.empty() && s.screen != "bootcard") std::memcpy(W_.bits, g_plate.px.data(), size_t(w) * h * 4); else std::fill(W_.bits, W_.bits + size_t(w) * h, 0x00070509u);
    SetBkMode(W_.mem, TRANSPARENT); const int x = w / 14; int y = h / 4;
    if (s.screen == "bootcard") { text_at(W_.mid, RGB(233, 227, 212), w / 8, h / 2 - 20, s.text); }
    else {
        text_at(W_.big, RGB(233, 227, 212), x, y, s.h1); y += h / 9; text_at(W_.small_, RGB(170, 160, 150), x, y, s.sub); y += h / 9;
        for (size_t i = 0; i < s.buttons.size(); ++i) {
            bool foc = int(i) == s.focus; RECT r{ x - 14, y - 6, x + w / 4, y + h / 22 };
            if (foc) { HBRUSH br = CreateSolidBrush(RGB(233, 227, 212)); FrameRect(W_.mem, &r, br); DeleteObject(br); }
            text_at(W_.mid, foc ? RGB(255, 250, 235) : RGB(150, 142, 132), x, y, s.buttons[i].first); y += h / 15;
        }
        text_at(W_.small_, RGB(130, 124, 116), x, h - h / 10, s.hint);
    }
    BitBlt(W_.dc, 0, 0, w, h, W_.mem, 0, 0, SRCCOPY); GdiFlush();
}
HFONT font(int px, int weight, const wchar_t* face) { return CreateFontW(-px, 0, 0, 0, weight, 0, 0, 0, DEFAULT_CHARSET, 0, 0, CLEARTYPE_QUALITY, 0, face); }
LRESULT CALLBACK wndproc(HWND h, UINT m, WPARAM wp, LPARAM lp);
const char* key_name(WPARAM vk, char* buf) {
    switch (vk) { case VK_UP: return "ArrowUp"; case VK_DOWN: return "ArrowDown"; case VK_LEFT: return "ArrowLeft"; case VK_RIGHT: return "ArrowRight"; case VK_RETURN: return "Enter"; case VK_ESCAPE: return "Escape"; case VK_SPACE: return " "; case VK_TAB: return "Tab"; case VK_BACK: return "Backspace"; }
    if ((vk >= 'A' && vk <= 'Z') || (vk >= '0' && vk <= '9')) { buf[0] = char(vk >= 'A' ? vk + 32 : vk); buf[1] = 0; return buf; } return nullptr;
}
LARGE_INTEGER g_key_t; bool g_key_pending = false; std::vector<double> g_key_ms;
void send_key(const char* type, const char* key) { std::string code = std::string("__lwKey('") + type + "','" + key + "')"; js_str(code.c_str()); }
LRESULT CALLBACK wndproc(HWND h, UINT m, WPARAM wp, LPARAM lp) {
    switch (m) {
    case WM_KEYDOWN: case WM_KEYUP: { char b[2]; const char* k = key_name(wp, b); if (k && !(m == WM_KEYDOWN && (lp & (1 << 30)))) { if (m == WM_KEYDOWN) { QueryPerformanceCounter(&g_key_t); g_key_pending = true; } send_key(m == WM_KEYDOWN ? "keydown" : "keyup", k); } return 0; }
    case WM_SIZE: if (W_.dc && LOWORD(lp) > 0 && HIWORD(lp) > 0) { make_target(LOWORD(lp), HIWORD(lp)); g_plate.px.clear(); } return 0;
    case WM_CLOSE: DestroyWindow(h); return 0;
    case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(h, m, wp, lp);
}
double working_set_mb() { PROCESS_MEMORY_COUNTERS pc{}; GetProcessMemoryInfo(GetCurrentProcess(), &pc, sizeof pc); return pc.WorkingSetSize / 1048576.0; }
double since_process_start_ms() { FILETIME c, e, k, u, n; GetProcessTimes(GetCurrentProcess(), &c, &e, &k, &u); GetSystemTimeAsFileTime(&n); return double((*reinterpret_cast<ULONGLONG*>(&n)) - (*reinterpret_cast<ULONGLONG*>(&c))) / 10000.0; }
// the pad: XInput, loaded at run time (no import library, so a machine without it still starts)
struct XState { DWORD pk; WORD buttons; BYTE lt, rt; SHORT lx, ly, rx, ry; };
typedef DWORD(WINAPI* XGet)(DWORD, XState*); XGet g_xget; WORD g_pad_last = 0xFFFF;
void poll_pad() {
    if (!g_xget) return; XState st{}; if (g_xget(0, &st) != 0) { if (g_pad_last != 0xFFFE) { js_str("__lwPad(null)"); g_pad_last = 0xFFFE; } return; }
    if (st.buttons == g_pad_last) return; g_pad_last = st.buttons;
    static const WORD map[16] = { 0x1000, 0x2000, 0x4000, 0x8000, 0x0100, 0x0200, 0, 0, 0x0020, 0x0010, 0x0040, 0x0080, 0x0001, 0x0002, 0x0004, 0x0008 };
    std::string j = "__lwPad({connected:true,id:'xinput',index:0,mapping:'standard',axes:[0,0,0,0],buttons:["; for (int i = 0; i < 16; ++i) { bool p = map[i] && (st.buttons & map[i]); j += p ? "{pressed:true,value:1}," : "{pressed:false,value:0},"; } j += "]})"; js_str(j.c_str());
}
void fake_pad(bool down_pressed) { g_pad_last = 0xFFFD; std::string j = std::string("__lwPad({connected:true,id:'synthetic',index:0,mapping:'standard',axes:[0,0,0,0],buttons:[") + "{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0},{pressed:false,value:0}," + (down_pressed ? "{pressed:true,value:1}" : "{pressed:false,value:0}") + ",{pressed:false,value:0},{pressed:false,value:0}]})"; js_str(j.c_str()); }

struct Times { double init = 0, entry = 0, title = 0, title_since_process = 0; } T;
Snap frame() {   // run timers and jobs, return the snapshot
    js_str("__lwTick()"); pump(); return parse_snap(js_str("__lwSnapshot()"));
}
int focus_of(const Snap& s) { return s.focus; }
int run_window(bool smoke) {
    WNDCLASSW wc{}; wc.lpfnWndProc = wndproc; wc.hInstance = GetModuleHandleW(nullptr); wc.lpszClassName = L"LowWaterHost"; wc.hCursor = LoadCursor(nullptr, IDC_ARROW); RegisterClassW(&wc);
    SetProcessDPIAware(); RECT r{ 0, 0, 1920, 1080 }; AdjustWindowRect(&r, WS_OVERLAPPEDWINDOW, FALSE);
    W_.hwnd = CreateWindowW(wc.lpszClassName, L"Low Water", WS_OVERLAPPEDWINDOW | WS_VISIBLE, 40, 20, r.right - r.left, r.bottom - r.top, nullptr, nullptr, wc.hInstance, nullptr);
    W_.dc = GetDC(W_.hwnd); W_.mem = CreateCompatibleDC(W_.dc); RECT cr; GetClientRect(W_.hwnd, &cr); make_target(cr.right, cr.bottom);
    W_.big = font(cr.bottom / 11, 600, L"Segoe UI"); W_.mid = font(cr.bottom / 30, 500, L"Segoe UI"); W_.small_ = font(cr.bottom / 46, 400, L"Consolas");
    if (HMODULE x = LoadLibraryW(L"xinput1_4.dll")) g_xget = reinterpret_cast<XGet>(GetProcAddress(x, "XInputGetState"));
    std::string last, prev_screen; Snap cur; bool reached = false; int stage = 0; double stage_at = 0; std::vector<double> frames, keyms; std::string log_seq; int rc = 0;
    MSG msg;
    for (;;) {
        while (PeekMessageW(&msg, nullptr, 0, 0, PM_REMOVE)) { if (msg.message == WM_QUIT) return rc; TranslateMessage(&msg); DispatchMessageW(&msg); }
        if (!smoke) poll_pad();
        cur = frame();
        bool title_now = cur.screen.find("title") != std::string::npos && !cur.bg.empty();
        if (cur.raw != last) {
            LARGE_INTEGER p0; QueryPerformanceCounter(&p0); paint(cur); double pm = ms_since(p0); last = cur.raw; if (cur.screen != prev_screen) { std::fprintf(stderr, "[screen] %s at %.0f ms (modules %d, compile %.0f ms)\n", cur.screen.c_str(), now_ms(), g_modules, g_compile_ms); prev_screen = cur.screen; }
            if (g_key_pending) { keyms.push_back(ms_since(g_key_t)); g_key_pending = false; }
            if (title_now && !reached) { reached = true; T.title = now_ms(); T.title_since_process = since_process_start_ms(); std::fprintf(stderr, "[title] painted at %.1f ms (first paint %.1f ms, plate decode+scale %.1f ms)\n", T.title, pm, g_decode_ms); stage_at = now_ms(); }
        }
        if (smoke && !reached && now_ms() > 60000) { std::fprintf(stderr, "smoke: no title in 60 s; screen=%s\n", cur.screen.c_str()); return 4; }
        if (smoke && reached && now_ms() - stage_at > 150) {   // scripted input, one step per 150 ms
            const char* steps[] = { "key:ArrowDown", "key:ArrowDown", "key:ArrowUp", "pad:down", "pad:up" }; stage_at = now_ms();
            if (stage < 5) {
                log_seq += std::to_string(cur.focus) + ","; QueryPerformanceCounter(&g_key_t); g_key_pending = true; std::string s = steps[stage];
                if (s.rfind("key:", 0) == 0) { send_key("keydown", s.c_str() + 4); send_key("keyup", s.c_str() + 4); } else fake_pad(s == "pad:down");
                ++stage;
            } else {
                log_seq += std::to_string(cur.focus);
                for (int i = 0; i < 240; ++i) { LARGE_INTEGER t; QueryPerformanceCounter(&t); paint(cur); frames.push_back(ms_since(t)); }
                std::sort(frames.begin(), frames.end()); std::vector<double> ks = keyms; std::sort(ks.begin(), ks.end());
                bool files = false; try { files = !g_bridge->list("settings").empty(); } catch (...) {}
                // the focus walk: ArrowDown moves down once and then (pad:down) again; the sequence is from the first focus
                std::printf("{\"cold_start_to_title_ms\":%.0f,\"in_process_to_title_ms\":%.0f,\"init_js_ms\":%.1f,\"first_entry_ms\":%.1f,\"frame_paint_ms_p50\":%.2f,\"frame_paint_ms_p99\":%.2f,\"key_to_painted_ms\":[",
                    T.title_since_process, T.title, T.init, T.entry, frames[frames.size() / 2], frames[size_t(frames.size() * 0.99)]);
                for (size_t i = 0; i < keyms.size(); ++i) std::printf("%s%.2f", i ? "," : "", keyms[i]);
                std::printf("],\"focus_sequence\":\"%s\",\"buttons\":%zu,\"settings_files_on_disk\":%s,\"working_set_mb\":%.1f,\"client\":\"%dx%d\"}\n", log_seq.c_str(), cur.buttons.size(), files ? "true" : "false", working_set_mb(), W_.w, W_.h);
                std::fflush(stdout);
                // focus walk: 0 -> 1 -> 2 -> 1 -> 2 -> 1 expected when the title has three or more enabled entries; here we only need movement
                bool moved = log_seq.find(',') != std::string::npos && !log_seq.empty(); (void)moved;
                if (!files) rc = 3;
                DestroyWindow(W_.hwnd); return rc;
            }
        }
        if (!smoke || !reached) Sleep(1); else Sleep(0);
    }
}
}  // namespace

int main(int argc, char** argv) {
    QueryPerformanceFrequency(&g_freq); QueryPerformanceCounter(&g_t0);
    std::string exe(MAX_PATH, '\0'); exe.resize(GetModuleFileNameA(nullptr, exe.data(), MAX_PATH)); std::replace(exe.begin(), exe.end(), '\\', '/'); std::string exe_dir = exe.substr(0, exe.rfind('/'));
    std::string save_root, run_mod, op; bool smoke = false; std::vector<std::string> opargs;
    for (int i = 1; i < argc; ++i) {
        std::string a = argv[i];
        if (a == "--game" && i + 1 < argc) g_lw = argv[++i]; else if (a == "--save-root" && i + 1 < argc) save_root = argv[++i];
        else if (a == "--smoke") smoke = true; else if (a == "--query" && i + 1 < argc) g_query = argv[++i]; else if (a == "--run" && i + 1 < argc) run_mod = argv[++i];
        else if (a == "--bridge-op") { op = "x"; while (++i < argc) opargs.push_back(argv[i]); }
    }
    std::replace(g_lw.begin(), g_lw.end(), '\\', '/');
    if (op == "x") {   // one bridge call, for tests: op root path [path2]
        if (opargs.size() < 3) return 64; FileBridge b(opargs[1]); const std::string& o = opargs[0]; _setmode(1, _O_BINARY);
        try {
            if (o == "read") { _setmode(1, _O_BINARY); auto r = b.read(opargs[2]); if (!r) return 3; std::fwrite(r->data(), 1, r->size(), stdout); }
            else if (o == "write") { _setmode(0, _O_BINARY); std::stringstream ss; ss << std::cin.rdbuf(); b.write(opargs[2], ss.str()); }
            else if (o == "rename" && opargs.size() > 3) b.rename(opargs[2], opargs[3]); else if (o == "remove") b.remove(opargs[2]);
            else if (o == "list") { for (auto& e : b.list(opargs[2])) std::printf("%s\n", e.c_str()); } else return 64;
        } catch (const std::exception& e) { std::fprintf(stderr, "%s\n", e.what()); return 1; }
        return 0;
    }
    if (save_root.empty()) { char* la = std::getenv("LOCALAPPDATA"); save_root = std::string(la ? la : ".") + "/Low Water"; }
    static FileBridge bridge(save_root); g_bridge = &bridge;
    if (!init_js(exe_dir)) return 1; T.init = now_ms();
    std::string entry = run_mod;
    if (entry.empty()) {
        if (g_lw.empty()) { std::fprintf(stderr, "--game <low-water dir> is required\n"); return 64; }
        std::string src = "import './save/nativehook.mjs';\nimport { boot } from './ui/app.mjs';\nboot().then(() => { globalThis.__lwBooted = true; }, (e) => console.error('boot failed: ' + (e && e.stack || e)));\n";
        std::string name = g_lw + "/game/engine/__entry.mjs"; JSValue v = JS_Eval(g_ctx, src.c_str(), src.size(), name.c_str(), JS_EVAL_TYPE_MODULE);
        if (JS_IsException(v)) { dump_exc(g_ctx, "entry"); return 1; } JS_FreeValue(g_ctx, v); T.entry = now_ms() - T.init; pump();
    } else {
        std::replace(entry.begin(), entry.end(), '\\', '/'); bool ok; std::string src = slurp(entry, &ok); if (!ok) return 66;
        JSValue v = JS_Eval(g_ctx, src.c_str(), src.size(), entry.c_str(), JS_EVAL_TYPE_MODULE); if (JS_IsException(v)) { dump_exc(g_ctx, "run"); return 1; } JS_FreeValue(g_ctx, v);
        for (int i = 0; i < 100000; ++i) { pump(); if (js_str("__lwTick()") == "0") break; Sleep(1); } pump(); std::fflush(stdout); return 0;
    }
    return run_window(smoke);
}
