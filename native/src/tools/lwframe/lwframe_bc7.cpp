// BC7 block compression for the hero frame's material textures, mode 6 only: one subset, RGBA
// endpoints of 7 bits plus a shared low bit each, 4-bit indices (the BC7 format as the D3D11
// functional specification and the Khronos Data Format specification describe it). Endpoints come
// from the block's principal axis (a few power iterations of its covariance), each tried with the
// four low-bit choices, keeping the least squared error. Written for speed over the last decibel:
// one mode of eight, no endpoint refinement.
#include "lwframe.hpp"
#include <algorithm>
#include <cmath>
#include <cstring>
#include <thread>
namespace raw::lwframe {
namespace {
constexpr int kW[16] = {0, 4, 9, 13, 17, 21, 26, 30, 34, 38, 43, 47, 51, 55, 60, 64};

struct Bits {
    uint8_t b[16]{};
    int at{0};
    void put(uint32_t v, int n){ for (int i = 0; i < n; ++i, ++at) if (v >> i & 1u) b[at >> 3] |= uint8_t(1u << (at & 7)); }
};
int interp(int e0, int e1, int w){ return ((64 - w) * e0 + w * e1 + 32) >> 6; }

// encode one 4x4 block of RGBA8 (px: 16 x 4 bytes) into 16 bytes
void block(const uint8_t* px, uint8_t* out){
    float mean[4] = {0, 0, 0, 0};
    for (int i = 0; i < 16; ++i) for (int c = 0; c < 4; ++c) mean[c] += px[i * 4 + c] / 16.0f;
    float cov[4][4] = {};
    for (int i = 0; i < 16; ++i) for (int a = 0; a < 4; ++a) for (int b = 0; b < 4; ++b) cov[a][b] += (px[i * 4 + a] - mean[a]) * (px[i * 4 + b] - mean[b]);
    float ax[4] = {1, 1, 1, 1};
    for (int it = 0; it < 6; ++it){
        float n[4] = {0, 0, 0, 0};
        for (int a = 0; a < 4; ++a) for (int b = 0; b < 4; ++b) n[a] += cov[a][b] * ax[b];
        const float l = std::sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2] + n[3] * n[3]);
        if (l < 1e-6f) break;
        for (int a = 0; a < 4; ++a) ax[a] = n[a] / l;
    }
    float lo = 1e9f, hi = -1e9f;
    for (int i = 0; i < 16; ++i){ float t = 0; for (int c = 0; c < 4; ++c) t += (px[i * 4 + c] - mean[c]) * ax[c]; lo = std::min(lo, t); hi = std::max(hi, t); }
    int bestErr = 1 << 30; uint8_t best[16]{};
    for (int p0 = 0; p0 < 2; ++p0) for (int p1 = 0; p1 < 2; ++p1){
        int e[2][4], q[2][4];
        for (int c = 0; c < 4; ++c){
            const float v0 = mean[c] + ax[c] * lo, v1 = mean[c] + ax[c] * hi;
            q[0][c] = std::clamp(int(std::lround((v0 - p0) / 2.0f)), 0, 127); q[1][c] = std::clamp(int(std::lround((v1 - p1) / 2.0f)), 0, 127);
            e[0][c] = q[0][c] << 1 | p0; e[1][c] = q[1][c] << 1 | p1;
        }
        int idx[16], err = 0;
        for (int i = 0; i < 16; ++i){
            // the index from the pixel's place along the endpoints, then its two neighbours tried
            float dd = 0, tt = 0;
            for (int c = 0; c < 4; ++c){ const float D = float(e[1][c] - e[0][c]); dd += D * D; tt += (px[i * 4 + c] - e[0][c]) * D; }
            const int k0 = dd > 0 ? std::clamp(int(std::lround(tt / dd * 15.0f)), 0, 15) : 0;
            int bi = k0, be = 1 << 30;
            for (int k = std::max(0, k0 - 1); k <= std::min(15, k0 + 1); ++k){ int d = 0; for (int c = 0; c < 4; ++c){ const int x = interp(e[0][c], e[1][c], kW[k]) - px[i * 4 + c]; d += x * x; } if (d < be){ be = d; bi = k; } }
            idx[i] = bi; err += be;
        }
        if (err >= bestErr) continue;
        bestErr = err;
        // the first index's top bit is implied zero: swap the endpoints when it would be set
        int pp0 = p0, pp1 = p1;
        if (idx[0] >= 8){ for (int c = 0; c < 4; ++c) std::swap(q[0][c], q[1][c]); std::swap(pp0, pp1); for (int& v : idx) v = 15 - v; }
        Bits w; w.put(1u << 6, 7);
        for (int c = 0; c < 4; ++c){ w.put(uint32_t(q[0][c]), 7); w.put(uint32_t(q[1][c]), 7); }
        w.put(uint32_t(pp0), 1); w.put(uint32_t(pp1), 1);
        w.put(uint32_t(idx[0]), 3);
        for (int i = 1; i < 16; ++i) w.put(uint32_t(idx[i]), 4);
        std::memcpy(best, w.b, 16);
    }
    std::memcpy(out, best, 16);
}
}  // namespace

// compress every mip of an RGBA8 texture to BC7 (in place of its pixels)
void compressBc7(rhi::hw::FrameTexture& t){
    std::vector<uint8_t> out;
    size_t src = 0;
    std::vector<size_t> offs; std::vector<uint32_t> ws, hs;
    for (uint32_t m = 0; m < t.mips; ++m){ const uint32_t w = std::max(1u, t.width >> m), h = std::max(1u, t.height >> m); offs.push_back(src); ws.push_back(w); hs.push_back(h); src += size_t(w) * h * 4; }
    size_t total = 0; std::vector<size_t> dst;
    for (uint32_t m = 0; m < t.mips; ++m){ dst.push_back(total); total += size_t((ws[m] + 3) / 4) * ((hs[m] + 3) / 4) * 16; }
    out.resize(total);
    for (uint32_t m = 0; m < t.mips; ++m){
        const uint32_t w = ws[m], h = hs[m], bw = (w + 3) / 4, bh = (h + 3) / 4;
        const unsigned n = std::max(1u, std::min(8u, std::thread::hardware_concurrency()));
        std::vector<std::thread> pool;
        for (unsigned k = 0; k < n; ++k) pool.emplace_back([&, k]{
            uint8_t px[64];
            for (uint32_t by = k; by < bh; by += n) for (uint32_t bx = 0; bx < bw; ++bx){
                for (int y = 0; y < 4; ++y) for (int x = 0; x < 4; ++x){
                    const uint32_t sx = std::min(w - 1, bx * 4 + x), sy = std::min(h - 1, by * 4 + y);
                    std::memcpy(&px[(y * 4 + x) * 4], &t.rgba[offs[m] + (size_t(sy) * w + sx) * 4], 4);
                }
                block(px, &out[dst[m] + (size_t(by) * bw + bx) * 16]);
            }
        });
        for (auto& th : pool) th.join();
    }
    t.rgba.swap(out);
    t.bc7 = true;
}

}  // namespace raw::lwframe
