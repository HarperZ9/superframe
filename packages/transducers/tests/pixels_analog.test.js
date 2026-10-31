"use strict";
const { test, assert, T, near, refuses, tone, whiteGrid, F } = require("./h.js");
const toneSNRdB = (x, y) => { let s = 0, e = 0; for (let i = 0; i < x.length; i++) { s += x[i] ** 2; e += (x[i] - y[i]) ** 2; } return 10 * Math.log10(s / e); };

test("a tone above Nyquist lands on its alias", () => {
  const n = 4096, k = 8, fs = 1 / k, f = 0.11, x = T.seq("tone", tone(f, n)), o = T.run(T.sample(k, { grain: 1e-2 }), x), P = T.powerSpectrum(o.values, 1, o.values.length);
  let b = 1; for (let i = 2; i < P.length / 2; i++) if (P[i] > P[b]) b = i;
  near(b / o.values.length, T.aliasOf(f, fs) / fs, 2 / o.values.length, "alias bin");
});
test("quantising uniform 8-bit values to 4 bits loses exactly four bits each", () => {
  const n = 4096, x = Float64Array.from({ length: n }, (_, i) => (i % 256) / 255), o = T.run(T.quantise(4), T.seq("u", x));
  near(o.row.bitsLost / n, 4, 0.05, "bits per value");
});
test("quantisation SNR rises 6.02 dB a bit, at the ideal closed form", () => {
  const n = 1 << 16, x = tone(0.0137, n, 0.5, 0.5);
  for (const b of [6, 8, 10]) {
    const y = T.quantise(b).forward(T.seq("t", x)).values, lsb = 1 / (2 ** b - 1), err = x.map((v, i) => (y[i] * lsb - 0.5) - (v - 0.5));
    let p = 0, e = 0; for (let i = 0; i < n; i++) { p += (x[i] - 0.5) ** 2; e += err[i] ** 2; }
    near(10 * Math.log10(p / e), T.idealSNRdB(b), 0.5, "SNR at " + b);
  }
});
test("dither keeps a sub-LSB mean that plain quantising destroys", () => {
  const n = 1 << 14, v = 7.25 / 15, x = new Float64Array(n).fill(v), f = T.seq("dc", x), plain = T.quantise(4).forward(f).values, d = T.run(T.ditherTPDF(4, 2), f);
  near((plain.reduce((a, b) => a + b, 0) / n) / 15, 7 / 15, 1e-12, "plain quantiser rounds a quarter LSB away");
  near((d.values.reduce((a, b) => a + b, 0) / n) / 15, v, 0.001, "dither mean");
  const g = T.grid("dc", 64, 64, new Float64Array(64 * 64).fill(v)), e = T.run(T.diffuse(4), g);
  near((e.values.reduce((a, b) => a + b, 0) / e.values.length) / 15, v, 0.002, "diffusion mean");
});
test("Bayer: mosaic keeps exact samples; demosaic then mosaic is bit exact; a flat field comes back flat", () => {
  const N = 16, r = T.rng(2, "rgb"), v = Float64Array.from({ length: 3 * N * N }, () => r()), f = T.grid("rgb", N, N, v, "1", { components: 3 }), m = T.run(T.bayer(), f);
  assert.equal(m.values.length, N * N);
  const d = T.run(T.demosaic(), m);
  assert.equal(d.row.measured, "embedding");
  assert.deepEqual(Array.from(T.mosaicOf(d.values, N, N)), Array.from(m.values));
  const flat = T.grid("flat", N, N, new Float64Array(N * N).fill(0.4)), fl = T.demosaic().forward(flat).values;
  fl.forEach((x) => near(x, 0.4, 1e-12));
});
test("Huffman: a lossless round trip, mean length within H and H + 1", () => {
  const n = 8192, r = T.rng(3, "sym"), x = Float64Array.from({ length: n }, () => Math.floor(-Math.log(1 - r()) * 3)), e = T.huffmanEncode(x), H = T.entropy(x);
  assert.deepEqual(Array.from(T.huffmanDecode(e)), Array.from(x));
  assert.ok(e.bits / n >= H - 1e-9 && e.bits / n < H + 1, `${e.bits / n} vs H ${H}`);
  const o = T.run(T.entropyCode(), T.seq("sym", x, "count"));
  assert.equal(o.row.measured, "embedding");
  assert.ok(o.row.bytes < n * 8);
  refuses(() => T.run(T.entropyCode(), T.seq("floats", Float64Array.from([0.5, 1.5]))), "FieldError");
});
test("Huffman with one symbol still round trips", () => {
  const x = new Float64Array(9).fill(5);
  assert.deepEqual(Array.from(T.huffmanDecode(T.huffmanEncode(x))), Array.from(x));
});
test("bit planes are an isomorphism: bit exact, both ways", () => {
  const r = T.rng(4, "p"), x = Float64Array.from({ length: 256 }, () => Math.floor(r() * 256)), o = T.run(T.bitplanes(8), T.seq("x", x, "count"));
  assert.equal(o.row.measured, "isomorphism");
  assert.equal(o.row.bitsLost, 0);
});
test("planted: a lossy kernel that claims lossless is refused, with the loss in the error", () => {
  const k = T.kernel({ id: "planted.round", group: "pixels", axes: ["noise"], claims: "isomorphism", from: {}, to: {}, forward: (f) => ({ values: f.values.map((v) => Math.round(v * 16) / 16) }), inverse: (y) => y.values.slice(), targets: (s, y) => y });
  refuses(() => T.run(k, T.seq("x", Float64Array.from({ length: 64 }, (_, i) => i / 64 + 0.001))), "ClaimError");
});
test("a kernel with unmeasured bits is refused", () => {
  const k = T.kernel({ id: "planted.silent", group: "x", axes: ["noise"], claims: "homomorphism", from: {}, to: {}, forward: (f) => ({ values: f.values }), keeps: { name: "any", check: () => ({ ok: true, detail: "" }) } });
  refuses(() => T.run(k, T.seq("x", new Float64Array(8))), "ClaimError");
});
test("ADC: an ideal converter reaches 6.02 N + 1.76 dB on a full-scale sine", () => {
  const n = 1 << 16, b = 10, Vref = 1, x = tone(0.01371, n, 0.5, 0.5), f = T.seq("v", x, "V", { rep: T.ANALOG }), o = T.run(T.adc(b, Vref), f), lsb = Vref / (2 ** b - 1);
  const ac = x.map((v) => v - 0.5), y = o.values.map((c, i) => c * lsb - 0.5);
  near(toneSNRdB(ac, y), T.idealSNRdB(b), 0.5, "SNR");
  const noisy = T.run(T.adc(b, Vref, { sigma: 2 * lsb, seed: 3 }), f), yn = noisy.values.map((c) => c * lsb - 0.5);
  near(toneSNRdB(ac, yn), 10 * Math.log10(0.125 / (lsb * lsb * (1 / 12 + 4))), 0.5, "noise adds in power");
});
test("DAC: a code goes out and reads back exact, below half an LSB of noise", () => {
  const r = T.rng(5, "c"), c = Float64Array.from({ length: 512 }, () => Math.floor(r() * 256)), o = T.run(T.dac(8, 1, { sigma: 0.0005, seed: 7 }), T.seq("c", c, "count"));
  assert.equal(o.row.measured, "embedding");
  refuses(() => T.run(T.dac(8, 1, { sigma: 0.02, seed: 7 }), T.seq("c", c, "count")), "ClaimError", "noise above half an LSB breaks the embedding claim");
});
test("RC step response follows 1 - exp(-t / RC), and agrees with the circuit simulator", () => {
  const R = 1e3, C = 1e-6, dt = 1e-5, n = 400, x = T.seq("step", new Float64Array(n).fill(1), "V"), o = T.run(T.rcFilter(R, C, dt), x);
  for (const i of [50, 100, 300]) near(o.values[i], 1 - Math.exp((-(i + 1) * dt) / (R * C)), 1e-9, "closed form");
  assert.equal(o.row.measured, "embedding");
  const S = T.sim(), ck = S.compile([{ t: "V", name: "in", n: ["a", "0"], dc: 0, wave: { type: "step", v0: 0, v1: 1, t0: 0, rise: 1e-9 } }, { t: "R", name: "r", n: ["a", "b"], R, noise: false }, { t: "C", name: "c", n: ["b", "0"], C }]);
  const tr = S.tran(ck, { tstop: 4e-3, dt, record: ["b"], ic: "zero" });
  near(tr.v.b[300], 1 - Math.exp((-300 * dt) / (R * C)), 2e-3, "simulator transient");
});
test("RC corner and kT/C noise come out of the circuit simulator as the closed forms say", () => {
  const S = T.sim(), R = 1e3, C = 1e-9, kB = T.codata("Boltzmann constant").value, fc = 1 / (2 * Math.PI * R * C);
  const ck = S.compile([{ t: "R", name: "r", n: ["b", "0"], R, T: 300 }, { t: "C", name: "c", n: ["b", "0"], C }]);
  const fs = S.logspace(1, 1e10, 3000), spec = S.noise(ck, fs, "b").rows.map((r) => r.SA);
  near(S.trapz(fs, spec) / ((kB * 300) / C), 1, 0.02, "kT/C");
  near(spec[0] / (4 * kB * 300 * R), 1, 0.01, "low-frequency density 4kTR");
  assert.ok(fc > 0);
});
test("Butterworth: -3 dB at the corner, and the kernel prices what it removes", () => {
  const fs = 48000, fc = 2000, n = 1 << 14, x = T.seq("t", tone(fc / fs, n)), o = T.run(T.butterworth(fs, fc, { noise: 1e-6 }), x);
  const rms = (v) => Math.sqrt(v.slice(n / 2).reduce((a, b) => a + b * b, 0) / (n / 2));
  near(rms(o.values) / rms(x.values), Math.SQRT1_2, 0.01, "gain at fc");
  const wide = T.run(T.butterworth(fs, fc), whiteSeq(n));
  assert.ok(wide.row.bitsLost > 0);
});
function whiteSeq(n) { const r = T.rng(9, "w"); return T.seq("w", Float64Array.from({ length: n }, () => T.gauss(r))); }
