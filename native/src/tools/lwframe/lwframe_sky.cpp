// The night sky (see lwframe.hpp): a Radiance RGBE .hdr read with its run-length scanlines (Greg
// Ward's format, written from its published description), the moon found as the brightest disc,
// its power measured and moved to an analytic light, its pixels filled from their surround, and
// the sky turned so the moon stands behind the view's right shoulder (150 degrees round from it):
// the street's snow is moonlit and the houses throw their moon shadows up the lane toward the lamps.
#include "lwframe.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <fstream>
#include <iterator>
namespace raw::lwframe {
namespace {
constexpr double kPi = 3.14159265358979;
bool decode(const std::vector<uint8_t>& f, uint32_t& W, uint32_t& H, std::vector<float>& rgb, std::string& err){
    size_t at = 0;
    auto line = [&](){ std::string s; while (at < f.size() && f[at] != '\n') s += char(f[at++]); ++at; return s; };
    if (line().rfind("#?", 0) != 0){ err = "lwframe: not a Radiance .hdr"; return false; }
    for (std::string s = line(); !s.empty(); s = line()) if (s.rfind("FORMAT=", 0) == 0 && s != "FORMAT=32-bit_rle_rgbe"){ err = "lwframe: .hdr not RGBE"; return false; }
    int h = 0, w = 0;
    if (std::sscanf(line().c_str(), "-Y %d +X %d", &h, &w) != 2 || w <= 0 || h <= 0 || w > 32768 || h > 16384){ err = "lwframe: .hdr size line"; return false; }
    W = uint32_t(w); H = uint32_t(h); rgb.assign(size_t(W) * H * 3, 0.0f);
    std::vector<uint8_t> sc(size_t(W) * 4);
    for (uint32_t y = 0; y < H; ++y){
        if (at + 4 > f.size() || f[at] != 2 || f[at + 1] != 2 || ((f[at + 2] << 8) | f[at + 3]) != int(W)){ err = "lwframe: .hdr scanline is not new-style RLE"; return false; }
        at += 4;
        for (int c = 0; c < 4; ++c) for (uint32_t x = 0; x < W;){
            if (at >= f.size()){ err = "lwframe: .hdr ends early"; return false; }
            uint32_t n = f[at++];
            if (n > 128){ n -= 128; if (at >= f.size() || x + n > W){ err = "lwframe: .hdr run"; return false; } const uint8_t v = f[at++]; for (uint32_t k = 0; k < n; ++k) sc[(x++) * 4 + c] = v; }
            else { if (n == 0 || at + n > f.size() || x + n > W){ err = "lwframe: .hdr literal"; return false; } for (uint32_t k = 0; k < n; ++k) sc[(x++) * 4 + c] = f[at++]; }
        }
        for (uint32_t x = 0; x < W; ++x){
            const uint8_t e = sc[x * 4 + 3];
            const float s = e ? std::ldexp(1.0f, int(e) - 136) : 0.0f;
            for (int c = 0; c < 3; ++c) rgb[(size_t(y) * W + x) * 3 + c] = sc[x * 4 + c] * s;
        }
    }
    return true;
}
}  // namespace

bool loadSky(const std::string& path, float viewYaw, rhi::hw::FrameScene& S, std::string& err){
    std::ifstream in(path, std::ios::binary);
    if (!in){ err = "lwframe: cannot read " + path; return false; }
    const std::vector<uint8_t> f((std::istreambuf_iterator<char>(in)), {});
    uint32_t W = 0, H = 0;
    if (!decode(f, W, H, S.sky, err)) return false;
    S.skyW = W; S.skyH = H;
    auto lumAt = [&](size_t p){ return 0.2126f * S.sky[p * 3] + 0.7152f * S.sky[p * 3 + 1] + 0.0722f * S.sky[p * 3 + 2]; };
    size_t best = 0; for (size_t p = 0; p < size_t(W) * H; ++p) if (lumAt(p) > lumAt(best)) best = p;
    const uint32_t bx = uint32_t(best % W), by = uint32_t(best / W);
    // the disc: pixels within 12 of the peak brighter than a tenth of it; its power over solid angle
    const float peak = lumAt(best);
    double pw[3] = {0, 0, 0}, mx = 0, my = 0, mw = 0;
    std::vector<size_t> disc;
    for (int dy = -12; dy <= 12; ++dy) for (int dx = -12; dx <= 12; ++dx){
        const int x = (int(bx) + dx + int(W)) % int(W), y = std::clamp(int(by) + dy, 0, int(H) - 1);
        const size_t p = size_t(y) * W + x;
        if (lumAt(p) < peak * 0.02f) continue;
        const double th = (y + 0.5) / H * kPi, sa = (2 * kPi / W) * (kPi / H) * std::sin(th);
        for (int c = 0; c < 3; ++c) pw[c] += S.sky[p * 3 + c] * sa;
        mx += (bx + dx) * lumAt(p); my += y * lumAt(p); mw += lumAt(p);
        disc.push_back(p);
    }
    // fill the disc from the ring just outside it
    double ring[3] = {0, 0, 0}; int rn = 0;
    for (int dy = -16; dy <= 16; ++dy) for (int dx = -16; dx <= 16; ++dx){
        if (std::abs(dx) < 14 && std::abs(dy) < 14) continue;
        const size_t p = size_t(std::clamp(int(by) + dy, 0, int(H) - 1)) * W + (int(bx) + dx + int(W)) % int(W);
        for (int c = 0; c < 3; ++c) ring[c] += S.sky[p * 3 + c];
        ++rn;
    }
    for (size_t p : disc) for (int c = 0; c < 3; ++c) S.sky[p * 3 + c] = float(ring[c] / std::max(1, rn));
    // where the moon is in the map, and the turn that puts it 35 degrees right of the view
    const double u = (mx / mw + 0.5) / W, v = (my / mw + 0.5) / H, th = v * kPi;
    const double aMap = (u - 0.5) * 2 * kPi, aWorld = double(viewYaw) + 150.0 * kPi / 180.0;
    S.skyRotate = float(aMap - aWorld);
    S.moonDir[0] = float(std::sin(th) * std::sin(aWorld)); S.moonDir[1] = float(std::cos(th)); S.moonDir[2] = float(-std::sin(th) * std::cos(aWorld));
    const double omega = 2 * kPi * (1 - std::cos(S.moonHalfAngle));
    for (int c = 0; c < 3; ++c) S.moonRadiance[c] = float(pw[c] / omega);
    std::printf("sky: %ux%u, moon at elevation %.1f deg, irradiance %.4g %.4g %.4g, %zu disc pixels\n", W, H, 90.0 - th * 180 / kPi, pw[0], pw[1], pw[2], disc.size());
    return true;
}

}  // namespace raw::lwframe
