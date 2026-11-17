// AO error against a reference: see ao_score.hpp.
#include "ao_score.hpp"
#include <algorithm>
#include <cmath>
namespace raw::aobench {

Score score(const std::vector<float>& ao, const std::vector<float>& ref, const std::vector<uint8_t>& valid,
            int w, int h, int border) {
    Score s;
    std::vector<double> d;
    d.reserve(std::size_t(w) * std::size_t(h));
    for (int y = border; y < h - border; ++y) for (int x = border; x < w - border; ++x) {
        const std::size_t i = std::size_t(y) * std::size_t(w) + std::size_t(x);
        if (!valid[i]) continue;
        ++s.pixels;
        s.occluded += ref[i] < 0.9f;
        d.push_back(std::fabs(double(ao[i]) - double(ref[i])));
    }
    if (d.empty()) return s;
    double sum = 0.0;
    for (double v : d) sum += v;
    s.mean = sum / double(d.size());
    const std::size_t k = std::min(d.size() - 1, std::size_t(0.95 * double(d.size())));
    std::nth_element(d.begin(), d.begin() + std::ptrdiff_t(k), d.end());
    s.p95 = d[k];
    return s;
}

bool wins(double oursMean, double oursMs, double rivalMean, double rivalMs) {
    return oursMean <= 0.8 * rivalMean && oursMs <= rivalMs;
}

}  // namespace raw::aobench
