#pragma once
// The error of an AO image against a reference (bench/ao/README.md): mean and 95th percentile of
// |ao - reference| over pixels with geometry, a border of `border` pixels left out. The count of
// scored pixels is the denominator and is always reported with the numbers.
#include <cstdint>
#include <vector>
namespace raw::aobench {

struct Score {
    long pixels{0};        // scored pixels: geometry, outside the border
    long occluded{0};      // of those, reference below 0.9 (reported: how much there is to find)
    double mean{0}, p95{0};
};
// `valid[i]` nonzero where the pixel has geometry. ao and ref are w * h, row-major.
Score score(const std::vector<float>& ao, const std::vector<float>& ref, const std::vector<uint8_t>& valid,
            int w, int h, int border);
// The comparison rule of the first slice: ours wins a scene when its mean error is at least 20%
// below the rival's and its GPU time is no greater.
bool wins(double oursMean, double oursMs, double rivalMean, double rivalMs);

}  // namespace raw::aobench
