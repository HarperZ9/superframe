// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
/* One FFT for the packages: perceive's src/signal.js, against an exact DFT and against the other JS FFTs in
   this repository, on the same seeded inputs. The other files are read here, never edited.
     node --test packages/perceive/tests/fft-parity.test.mjs

   Accuracy: max |X - DFT| <= 2 eps log2(n) max|X|, the size of rounding a radix-2 transform with exact
   twiddles should reach. A running-product twiddle (the old signal.js, and sound/dsp.js today) exceeds it at
   n = 4096, which is the planted control.
   Parity: two FFTs agree when max |X_a - X_b| <= 1e-9 max|X|. A wrong sign convention, scaling or bin order
   differs by order one, so the tolerance separates rounding from a different transform. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fft, ifft } from "../src/fft.mjs";
import { makeFFT } from "../../../visualizer/lib/fft.mjs";
import * as dsp from "../../../sound/sound/dsp.js";
import { power2 } from "../../../superframe/lib/mosaic/analysis.mjs";

const require = createRequire(import.meta.url);
const P = require("../src/index.js");
const F = require("../../field/src/index.js");
const EPS = 2 ** -52;
const SIZES = [1, 2, 8, 64, 1024, 4096];

/* Seeded inputs (an LCG, so the inputs do not depend on any FFT or seed code under test). */
const inputs = (n, seed) => {
  let s = seed >>> 0;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) - 0.5;
  return [Float64Array.from({ length: n }, r), Float64Array.from({ length: n }, r)];
};
const run = (f, re, im) => { const a = re.slice(), b = im.slice(); f(a, b); return [a, b]; };
const peak = ([re, im]) => re.reduce((m, _, i) => Math.max(m, Math.hypot(re[i], im[i])), 0);
const gap = ([ar, ai], [br, bi]) => ar.reduce((m, _, i) => Math.max(m, Math.hypot(ar[i] - br[i], ai[i] - bi[i])), 0);

/* Direct DFT with the angle reduced mod n, evaluated at every stride-th bin. */
const dftGap = ([re, im], [Xr, Xi], stride) => {
  const n = re.length;
  let worst = 0;
  for (let k = 0; k < n; k += stride) {
    let xr = 0, xi = 0;
    for (let j = 0; j < n; j++) {
      const t = (-2 * Math.PI * ((j * k) % n)) / n, c = Math.cos(t), s = Math.sin(t);
      xr += re[j] * c - im[j] * s; xi += re[j] * s + im[j] * c;
    }
    worst = Math.max(worst, Math.hypot(Xr[k] - xr, Xi[k] - xi));
  }
  return worst;
};
const bound = (n, X) => 2 * EPS * Math.max(1, Math.log2(n)) * Math.max(peak(X), 1e-300);

/* The planted control: the same butterfly with twiddles from a running product (cr, ci) *= (wr, wi). */
const recurrenceFFT = (re, im) => dsp.fft(re, im);

test("perceive fft matches the exact DFT within 2 eps log2(n) max|X|", () => {
  for (const n of SIZES) {
    const x = inputs(n, 20261031 + n), X = run(fft, ...x), err = dftGap(x, X, n > 1024 ? 7 : 1);
    assert.ok(err <= bound(n, X), `n=${n}: error ${err.toExponential(2)} > bound ${bound(n, X).toExponential(2)}`);
  }
});

test("planted: a running-product twiddle FFT fails the same bound at n = 4096", () => {
  const x = inputs(4096, 20261031 + 4096), X = run(recurrenceFFT, ...x), err = dftGap(x, X, 7);
  assert.ok(err > bound(4096, X), `recurrence error ${err.toExponential(2)} was inside the bound`);
});

test("known answers: impulse, constant and one tone", () => {
  const n = 64, re = new Float64Array(n), im = new Float64Array(n);
  re[0] = 1; fft(re, im);
  assert.ok(re.every((v) => v === 1) && im.every((v) => v === 0), "impulse -> all ones");
  const c = new Float64Array(n).fill(1), z = new Float64Array(n); fft(c, z);
  assert.ok(Math.abs(c[0] - n) < 1e-12 && c.slice(1).every((v, i) => Math.hypot(v, z[i + 1]) < 1e-12), "constant -> n at bin 0");
  const t = Float64Array.from({ length: n }, (_, j) => Math.cos((2 * Math.PI * 5 * j) / n)), u = new Float64Array(n); fft(t, u);
  assert.ok(Math.abs(t[5] - n / 2) < 1e-12 && Math.abs(t[n - 5] - n / 2) < 1e-12, "cos at bin 5 -> n/2 at bins 5 and n-5");
  assert.throws(() => fft(new Float64Array(12), new Float64Array(12)), /power of two/);
});

test("ifft inverts fft to 1e-15 of the input scale", () => {
  for (const n of SIZES) {
    const x = inputs(n, 7 + n), [a, b] = run(fft, ...x);
    ifft(a, b);
    assert.ok(gap([a, b], x) <= 1e-15 * Math.max(1, Math.log2(n)), `n=${n}: ${gap([a, b], x)}`);
  }
});

test("visualizer/lib/fft.mjs transform is bit-identical (same table twiddles and butterfly)", () => {
  for (const n of SIZES.filter((n) => n >= 2)) {
    const x = inputs(n, 99 + n), A = run(fft, ...x), B = run(makeFFT(n).transform, ...x);
    assert.equal(gap(A, B), 0, `n=${n}`);
  }
});

test("visualizer power() rebuilt on perceive fft gives the same bins", () => {
  const n = 2048, V = makeFFT(n), frame = inputs(n, 5)[0], want = V.power(frame);
  const re = Float64Array.from(frame, (v, i) => v * V.window[i]), im = new Float64Array(n);
  fft(re, im);
  const w2 = V.window.reduce((a, w) => a + w * w, 0), s = 1 / (n * w2);
  for (let k = 0; k <= n / 2; k++) {
    const got = (re[k] ** 2 + im[k] ** 2) * (k === 0 || k === n / 2 ? s : 2 * s);
    assert.equal(got, want[k], `bin ${k}`);
  }
});

test("sound/sound/dsp.js fft agrees, forward and inverse", () => {
  for (const n of SIZES) {
    const x = inputs(n, 3 + n), A = run(fft, ...x), B = run(dsp.fft, ...x);
    assert.ok(gap(A, B) <= 1e-9 * Math.max(peak(A), 1e-300), `forward n=${n}: ${gap(A, B)}`);
    const C = run(ifft, ...x), D = run((r, i) => dsp.fft(r, i, true), ...x);
    assert.ok(gap(C, D) <= 1e-9 * Math.max(peak(C), 1e-300), `inverse n=${n}: ${gap(C, D)}`);
  }
});

test("planted: the conjugate transform is not accepted as parity", () => {
  const x = inputs(64, 11), A = run(fft, ...x), B = run(dsp.fft, x[0].slice(), x[1].map((v) => -v));
  B[1] = B[1].map((v) => -v); // this is conj(F(conj x)) = the inverse direction, unscaled
  assert.ok(gap(A, B) > 1e-9 * peak(A), "the inverse-direction transform passed as the forward one");
});

test("superframe/lib/mosaic/analysis.mjs power2 agrees with a 2D transform on perceive fft", () => {
  for (const N of [8, 64]) {
    const f = inputs(N * N, N)[0], want = power2(f, N);
    const re = Float64Array.from(f), im = new Float64Array(N * N), r = new Float64Array(N), c = new Float64Array(N);
    for (let y = 0; y < N; y++) fft(re.subarray(y * N, y * N + N), im.subarray(y * N, y * N + N));
    for (let x = 0; x < N; x++) {
      for (let y = 0; y < N; y++) { r[y] = re[y * N + x]; c[y] = im[y * N + x]; }
      fft(r, c);
      for (let y = 0; y < N; y++) { re[y * N + x] = r[y]; im[y * N + x] = c[y]; }
    }
    let worst = 0, top = 0;
    for (let k = 0; k < N * N; k++) { const p = re[k] ** 2 + im[k] ** 2; worst = Math.max(worst, Math.abs(p - want[k])); top = Math.max(top, p); }
    assert.ok(worst <= 1e-9 * top, `N=${N}: ${worst}`);
  }
});

test("field ops use this FFT: F.fft equals perceive fft bit for bit", () => {
  const [re] = inputs(256, 42);
  const f = F.make({ name: "x", domain: { kind: "sequence", shape: [256] }, values: re, unit: "V", sigma: 0, prov: { status: "defined" }, rep: { kind: "digital", encoding: "float64" } });
  const X = F.fft(f), [a, b] = run(P.fft, re, new Float64Array(256));
  for (let i = 0; i < 256; i++) assert.ok(X.values[2 * i] === a[i] && X.values[2 * i + 1] === b[i], `bin ${i}`);
});
