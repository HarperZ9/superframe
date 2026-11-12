/**
 * dft.test.mjs — node:test suite for dft.mjs
 *
 * Tests:
 *   1. DFT of a pure sine at bin k peaks at bin k (and symmetrically at N-k)
 *   2. Sum of 2 sines — top-2 positive-frequency bins match both input frequencies
 *   3. Parseval's theorem: sum(mag²)/N ≈ sum(x²)  (energy conservation, within 1%)
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { dft, magnitudeSpectrum } from "../dft.mjs";

// ── helpers ───────────────────────────────────────────────────────────────────

/** Generate a pure cosine-aligned sine with exactly k cycles in N samples. */
function pureSine(N, k, amplitude = 1.0) {
  const x = new Float64Array(N);
  for (let i = 0; i < N; i++) x[i] = amplitude * Math.sin(2 * Math.PI * k * i / N);
  return x;
}

/** Return index of max value in a typed array. */
function argmax(arr, start = 0, end = arr.length) {
  let mi = start;
  for (let i = start + 1; i < end; i++) if (arr[i] > arr[mi]) mi = i;
  return mi;
}

// ── Test 1: pure sine peaks at the correct bin ────────────────────────────────

describe("dft — pure sine peaks at bin k", () => {

  it("single sine at bin k=5 peaks at bin 5 (positive half)", () => {
    const N = 64, k = 5;
    const { mag } = dft(pureSine(N, k));
    // Only look at positive-frequency half (bins 1..N/2-1, skip DC)
    const peakBin = argmax(mag, 1, N / 2);
    assert.equal(peakBin, k, `expected peak at bin ${k}, got ${peakBin}`);
  });

  it("single sine at bin k=10 peaks at bin 10", () => {
    const N = 64, k = 10;
    const { mag } = dft(pureSine(N, k));
    const peakBin = argmax(mag, 1, N / 2);
    assert.equal(peakBin, k);
  });

  it("single sine at bin k=1 peaks at bin 1", () => {
    const N = 32, k = 1;
    const { mag } = dft(pureSine(N, k));
    const peakBin = argmax(mag, 1, N / 2);
    assert.equal(peakBin, k);
  });

  it("symmetric: mag[k] ≈ mag[N-k] for a pure sine", () => {
    const N = 64, k = 7;
    const { mag } = dft(pureSine(N, k));
    // DFT of a real signal is conjugate-symmetric → mag[k] == mag[N-k]
    assert.ok(
      Math.abs(mag[k] - mag[N - k]) < 1e-9,
      `mag[${k}]=${mag[k].toFixed(4)} ≠ mag[${N - k}]=${mag[N - k].toFixed(4)}`
    );
  });

  it("all other bins are near-zero for a bin-aligned sine", () => {
    const N = 64, k = 8;
    const { mag } = dft(pureSine(N, k));
    const peak = mag[k];
    for (let b = 0; b < N / 2; b++) {
      if (b === k) continue;
      assert.ok(
        mag[b] < 1e-9,
        `bin ${b} has mag=${mag[b].toFixed(6)}, expected ~0 (leakage)`
      );
    }
  });

});

// ── Test 2: sum of 2 sines ────────────────────────────────────────────────────

describe("dft — sum of 2 sines peaks at both input frequencies", () => {

  it("sines at bins 4 and 12 — top-2 positive bins are {4, 12}", () => {
    const N = 64, k1 = 4, k2 = 12;
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = 0.7 * Math.sin(2 * Math.PI * k1 * i / N) +
              0.5 * Math.sin(2 * Math.PI * k2 * i / N);
    }
    const { mag } = dft(x);
    // Rank positive bins by magnitude
    const ranked = Array.from({ length: N / 2 - 1 }, (_, i) => ({ bin: i + 1, m: mag[i + 1] }))
      .sort((a, b) => b.m - a.m);
    const top2 = ranked.slice(0, 2).map(r => r.bin).sort((a, b) => a - b);
    assert.deepEqual(top2, [k1, k2], `top-2 bins = ${top2}, expected [${k1}, ${k2}]`);
  });

  it("equal-amplitude sines at bins 3 and 15 — both appear in top-2", () => {
    const N = 64, k1 = 3, k2 = 15;
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = Math.sin(2 * Math.PI * k1 * i / N) +
              Math.sin(2 * Math.PI * k2 * i / N);
    }
    const { mag } = dft(x);
    const ranked = Array.from({ length: N / 2 - 1 }, (_, i) => ({ bin: i + 1, m: mag[i + 1] }))
      .sort((a, b) => b.m - a.m);
    const top2 = ranked.slice(0, 2).map(r => r.bin).sort((a, b) => a - b);
    assert.deepEqual(top2, [k1, k2]);
  });

  it("magnitudeSpectrum (Float64) also peaks at both bins", () => {
    const N = 128, k1 = 5, k2 = 20;
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = Math.sin(2 * Math.PI * k1 * i / N) +
              0.6 * Math.sin(2 * Math.PI * k2 * i / N);
    }
    const ms = magnitudeSpectrum(x, N / 2);
    const ranked = Array.from(ms).map((m, bin) => ({ bin, m }))
      .sort((a, b) => b.m - a.m);
    const top2 = ranked.slice(0, 2).map(r => r.bin).sort((a, b) => a - b);
    assert.deepEqual(top2, [k1, k2]);
  });

});

// ── Test 3: Parseval's theorem ────────────────────────────────────────────────

describe("dft — Parseval's theorem (energy conservation within 1%)", () => {

  /**
   * Discrete Parseval: (1/N) * Σ|X[k]|² = Σ|x[n]|²
   * i.e. sum(mag²) / N ≈ sum(x²)
   * Tolerance: 1% relative error.
   */
  function checkParseval(x, label) {
    const { mag } = dft(x);
    const N = x.length;
    let energyTime = 0;
    for (let i = 0; i < N; i++) energyTime += x[i] * x[i];
    let energyFreq = 0;
    for (let k = 0; k < N; k++) energyFreq += mag[k] * mag[k];
    energyFreq /= N;

    const relErr = Math.abs(energyFreq - energyTime) / (energyTime || 1);
    assert.ok(
      relErr < 0.01,
      `${label}: Parseval relative error ${(relErr * 100).toFixed(3)}% > 1% ` +
      `(time=${energyTime.toFixed(4)}, freq=${energyFreq.toFixed(4)})`
    );
  }

  it("pure sine at bin 6 (N=64) satisfies Parseval within 1%", () => {
    checkParseval(pureSine(64, 6), "sine@6 N=64");
  });

  it("sum of 3 sines (N=128) satisfies Parseval within 1%", () => {
    const N = 128;
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) {
      x[i] = Math.sin(2 * Math.PI * 3 * i / N) +
              0.5 * Math.sin(2 * Math.PI * 9 * i / N) +
              0.25 * Math.sin(2 * Math.PI * 20 * i / N);
    }
    checkParseval(x, "3-sine sum N=128");
  });

  it("white noise (random signal, N=64) satisfies Parseval within 1%", () => {
    // Use a deterministic pseudo-noise sequence (avoid Math.random for reproducibility)
    const N = 64;
    const x = new Float64Array(N);
    let seed = 42;
    for (let i = 0; i < N; i++) {
      // Simple LCG
      seed = (seed * 1664525 + 1013904223) & 0xffffffff;
      x[i] = ((seed >>> 0) / 0xffffffff) * 2 - 1;
    }
    checkParseval(x, "pseudo-noise N=64");
  });

  it("unit impulse (N=32) satisfies Parseval within 1%", () => {
    const N = 32;
    const x = new Float64Array(N);
    x[0] = 1.0; // unit impulse — all-flat DFT magnitude, mag[k]=1 for all k
    checkParseval(x, "impulse N=32");
  });

  it("DC signal (all-ones, N=32) satisfies Parseval within 1%", () => {
    const N = 32;
    const x = new Float64Array(N).fill(1.0);
    checkParseval(x, "DC N=32");
  });

});
