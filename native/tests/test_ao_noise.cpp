// The blue noise of the real-time AO pass: every rank once, far less low-frequency energy than
// white noise, deterministic, and a white-noise control that the measure must report.
#include "check.hpp"
#include "raw/renderer/ao_realtime.hpp"
#include <algorithm>
using namespace raw;

int main() {
    const uint32_t n = 64;
    const std::vector<uint16_t> a = ao_rt::blueNoise(n, 1);
    std::vector<uint16_t> sorted = a;
    std::sort(sorted.begin(), sorted.end());
    bool each = sorted.size() == n * n;
    for (uint32_t i = 0; each && i < n * n; ++i) each = sorted[i] == i;
    CHECK(each);
    const double blue = ao_rt::lowFrequencyRatio(a, n);
    std::printf("low-frequency ratio: blue %.4f\n", blue);
    CHECK(blue < 0.25);
    CHECK(a == ao_rt::blueNoise(n, 1));
    CHECK(a != ao_rt::blueNoise(n, 2));
    // Control: the same ranks in a shuffled order are white noise, and the measure says so.
    std::vector<uint16_t> white = sorted;
    uint32_t s = 12345u;
    for (uint32_t i = n * n - 1; i > 0; --i) { s = s * 1664525u + 1013904223u; std::swap(white[i], white[(s >> 8) % (i + 1)]); }
    const double w = ao_rt::lowFrequencyRatio(white, n);
    std::printf("low-frequency ratio: white control %.4f\n", w);
    CHECK(w > 0.6 && w < 1.5);
    return raw_test_summary();
}
