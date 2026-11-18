// Blue noise for the real-time AO pass (raw/renderer/ao_realtime.hpp), by void and cluster:
// R. Ulichney, "The void-and-cluster method for dither array generation", 1993. Written
// here from the paper. The energy of a pattern is the sum of a Gaussian (sigma 1.5 texels)
// around each set texel on the torus; the tightest cluster is the set texel of highest
// energy, the largest void the clear texel of lowest energy.
#include "raw/renderer/ao_realtime.hpp"
#include <cmath>
namespace raw::ao_rt {
namespace {
struct Field {
    uint32_t n;
    std::vector<float> kernel, energy;
    std::vector<uint8_t> set;
    explicit Field(uint32_t size) : n(size), kernel(size_t(size) * size), energy(size_t(size) * size, 0.0f), set(size_t(size) * size, 0) {
        for (uint32_t y = 0; y < n; ++y)
            for (uint32_t x = 0; x < n; ++x) {
                const double dx = x < n / 2 ? x : double(x) - n, dy = y < n / 2 ? y : double(y) - n;
                kernel[size_t(y) * n + x] = float(std::exp(-(dx * dx + dy * dy) / (2.0 * 1.5 * 1.5)));
            }
    }
    void flip(uint32_t at, bool on) {
        set[at] = on;
        const uint32_t ax = at % n, ay = at / n;
        const float sign = on ? 1.0f : -1.0f;
        for (uint32_t y = 0; y < n; ++y) {
            const float* k = &kernel[size_t((y + n - ay) & (n - 1)) * n];
            float* e = &energy[size_t(y) * n];
            for (uint32_t x = 0; x < n; ++x) e[x] += sign * k[(x + n - ax) & (n - 1)];
        }
    }
    // The set texel of highest energy (want = 1) or the clear texel of lowest energy (want = 0).
    uint32_t extreme(uint8_t want) const {
        uint32_t best = 0;
        bool have = false;
        for (uint32_t i = 0; i < n * n; ++i) {
            if (set[i] != want) continue;
            if (!have || (want ? energy[i] > energy[best] : energy[i] < energy[best])) { best = i; have = true; }
        }
        return best;
    }
};
}  // namespace

std::vector<uint16_t> blueNoise(uint32_t size, uint32_t seed) {
    const uint32_t total = size * size, ones = total / 10;
    Field f(size);
    uint32_t s = seed * 2654435761u + 1u, placed = 0;
    while (placed < ones) {   // a random start, one texel in ten
        s = s * 1664525u + 1013904223u;
        const uint32_t at = (s >> 8) % total;
        if (!f.set[at]) { f.flip(at, true); ++placed; }
    }
    for (uint32_t guard = 0; guard < total * 4; ++guard) {   // move the tightest cluster into the largest void until they agree
        const uint32_t c = f.extreme(1);
        f.flip(c, false);
        const uint32_t v = f.extreme(0);
        f.flip(v, true);
        if (v == c) break;
    }
    std::vector<uint16_t> rank(total, 0);
    Field g = f;
    for (uint32_t r = ones; r-- > 0;) {   // ranks below the start: remove clusters; the last one left is rank 0
        const uint32_t c = g.extreme(1);
        g.flip(c, false);
        rank[c] = uint16_t(r);
    }
    for (uint32_t r = ones; r < total; ++r) {   // ranks above: fill voids. The paper swaps roles past
        const uint32_t v = f.extreme(0);        // one half; here voids are filled to the end.
        f.flip(v, true);
        rank[v] = uint16_t(r);
    }
    return rank;
}

double lowFrequencyRatio(const std::vector<uint16_t>& ranks, uint32_t size) {
    const uint32_t b = size / 4;
    double sum = 0, sq = 0;
    for (uint32_t by = 0; by < b; ++by)
        for (uint32_t bx = 0; bx < b; ++bx) {
            double m = 0;
            for (uint32_t k = 0; k < 16; ++k) m += (ranks[size_t(by * 4 + k / 4) * size + bx * 4 + k % 4] + 0.5) / double(size * size);
            m /= 16.0;
            sum += m; sq += m * m;
        }
    const double mean = sum / (b * b), var = sq / (b * b) - mean * mean;
    return var / (1.0 / (12.0 * 16.0));
}
}  // namespace raw::ao_rt
