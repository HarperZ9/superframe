// SPDX-License-Identifier: FSL-1.1-MIT
// Modal bank cost: N two-pole resonators driven by one input, summed, per sample.
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>
int main(int argc, char** argv) {
  const int N = argc > 1 ? std::atoi(argv[1]) : 1024, FS = 48000, S = FS * 2;
  std::vector<float> a1(N), a2(N), b(N), y1(N, 0), y2(N, 0), out(S);
  for (int k = 0; k < N; ++k) {
    double f = 50.0 + 15.0 * k, r = std::exp(-3.0 / FS);
    a1[k] = float(2 * r * std::cos(2 * M_PI * f / FS)); a2[k] = float(r * r); b[k] = 1.0f / N;
  }
  auto t0 = std::chrono::steady_clock::now();
  for (int n = 0; n < S; ++n) {
    float x = n == 0 ? 1.0f : 0.0f, acc = 0;
    for (int k = 0; k < N; ++k) {
      float y = a1[k] * y1[k] - a2[k] * y2[k] + b[k] * x;
      y2[k] = y1[k]; y1[k] = y; acc += y;
    }
    out[n] = acc;
  }
  double dt = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
  std::printf("{\"lang\":\"cpp\",\"modes\":%d,\"seconds_audio\":2,\"wall\":%.4f,\"check\":%.6g}\n", N, dt, out[S - 1]);
}
