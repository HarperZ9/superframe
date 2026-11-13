"use strict";
const { test, assert, T, needs, near, refuses, tone } = require("./h.js");

test("shot noise: variance equals the mean, at low and high counts", () => {
  for (const m of [0.5, 5, 500]) {
    const n = 1 << 15, o = T.run(T.shot({ seed: Math.ceil(m) }), T.seq("m", new Float64Array(n).fill(m), "count")), mean = o.values.reduce((a, b) => a + b, 0) / n;
    near(mean, m, 5 * Math.sqrt(m / n), "mean");
    near(T.varOf(o.values) / m, 1, 0.03, "Fano factor");
  }
});
test("Johnson noise: 1 kilohm at 300 K over 1 Hz is 4.07 nV, Boltzmann from CODATA", { skip: needs("codata") }, () => {
  near(T.johnsonRms(1e3, 300, 1) * 1e9, 4.07, 0.01, "nV");
  const n = 1 << 15, o = T.run(T.johnson(1e3, 300, 1e6, { seed: 2 }), T.seq("v", new Float64Array(n), "V"));
  near(Math.sqrt(T.varOf(o.values)) / T.johnsonRms(1e3, 300, 1e6), 1, 0.02, "rms");
  assert.notEqual(o.prov.status, "from_memory");
});
test("Johnson noise agrees with the circuit simulator's own noise analysis", { skip: needs("codata") }, () => {
  const S = T.sim(), ck = S.compile([{ t: "R", name: "r", n: ["a", "0"], R: 1e3, T: 300 }]), s = S.noise(ck, [1e3], "a").rows[0].SA;
  near(Math.sqrt(s) / T.johnsonRms(1e3, 300, 1), 1, 1e-6, "density");
});
test("1/f noise has spectral slope -1; a shuffled copy is white", () => {
  const v = T.flickerSeries(1 << 15, 1, 1, 3);
  near(T.spectralSlope(v), -1, 0.08, "slope");
  near(T.spectralSlope(Float64Array.from(T.shuffle(v, 4))), 0, 0.08, "shuffled control");
  const o = T.run(T.flicker(1, 0.1, { seed: 5 }), T.seq("x", new Float64Array(1 << 12)));
  assert.ok(o.row.axes.includes("time"));
});
test("film grain follows the measured sigma(D), and Selwyn's law under binning", { skip: needs("kodak5219") }, () => {
  const G = T.filmCurves().granularity, N = 256, logH = G.at_net_density_1.G.logH_at_net_density_1, sig = T.grainSigma("G", logH);
  near(sig, G.at_net_density_1.G.sigmaD, 0.002, "the data sheet's own table against its curve");
  const f = T.grid("x", N, N, new Float64Array(N * N).fill(logH)), o = T.run(T.filmGrain("G", 12, { seed: 6 }), f), m = o.values.reduce((a, b) => a + b, 0) / (N * N);
  const s1 = Math.sqrt(T.varOf(o.values)); near(s1 / T.selwyn(sig, 12), 1, 0.05, "per pixel");
  const bin = 4, b = new Float64Array((N / bin) ** 2);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) b[Math.floor(y / bin) * (N / bin) + Math.floor(x / bin)] += o.values[y * N + x] / (bin * bin);
  near(Math.sqrt(T.varOf(b)) / T.selwyn(sig, 48), 1, 0.1, "binned to the aperture");
  assert.ok(Math.abs(m - logH) < 0.01);
});
test("Phi matches known values", () => { near(T.Phi(0), 0.5, 1e-7); near(T.Phi(1.96), 0.975, 1e-3); near(T.Phi(-1), 0.1587, 1e-3); });
test("stochastic resonance: zero bits with no noise, a peak inside, the simulation on the closed form", () => {
  const a = 0.8, th = 1, curve = [0.05, 0.1, 0.2, 0.3, 0.5, 0.8, 1.5, 3].map((s) => T.resonanceMI(a, th, s));
  assert.equal(T.resonanceMI(a, th, 0), 0);
  const top = curve.indexOf(Math.max(...curve));
  assert.ok(top > 0 && top < curve.length - 1, "peak is interior " + curve);
  const n = 1 << 15, r = T.rng(7, "bits"), x = T.seq("b", Float64Array.from({ length: n }, () => (r() < 0.5 ? 0 : 1)));
  for (const s of [0.2, 0.5, 1.5]) {
    const o = T.run(T.resonance(a, th, s, { seed: 8 }), x), got = 1 - o.row.bitsLost / n;
    near(got, T.resonanceMI(a, th, s), 0.01, "MI at " + s);
  }
});

test("shutter gain is the Dirichlet kernel, with a null at f = 1 / T", () => {
  const n = 4096, M = 16, f = 3 / 256, x = T.seq("t", tone(f, n)), o = T.run(T.shutter(M), x), rms = (v) => Math.sqrt(v.reduce((a, b) => a + b * b, 0) / n);
  near(rms(o.values) / rms(x.values), T.shutterGain(f, M), 0.002, "gain");
  const y = T.run(T.shutter(M), T.seq("t", tone(1 / M, n)));
  assert.ok(rms(y.values) < 1e-9, "null");
});
test("a shutter's total exposure is unchanged, and it divides white noise by sqrt(M)", () => {
  const r = T.rng(9, "w"), n = 1 << 14, x = T.seq("w", Float64Array.from({ length: n }, () => T.gauss(r)), "1", { sigma: 1 }), o = T.run(T.shutter(25), x);
  near(Math.sqrt(T.varOf(o.values)), 1 / 5, 0.01);
  near(o.sigma, 1 / 5, 1e-9);
});
test("P22 persistence: the measured law starts at one, falls, and stays causal", { skip: needs("p22") }, () => {
  near(T.p22Decay("green", 0), 1, 1e-12);
  assert.ok(T.p22Decay("green", 1e-3) < T.p22Decay("green", 1e-5));
  const dt = 1e-6, x = new Float64Array(2048); x[100] = 1;
  const o = T.run(T.phosphor("green", dt, 512, { noise: 1e-6 }), T.seq("imp", x));
  for (let i = 0; i < 100; i++) assert.equal(o.values[i], 0);
  near(o.values[150], T.p22Decay("green", 50 * dt), 1e-12);
});
test("planted: an acausal decay is refused", () => {
  const h = T.decayConvolve(Float64Array.from([1, 0.5]), "fine");
  const x = new Float64Array(16); x[8] = 1;
  assert.ok(T.run(h, T.seq("imp", x)).row.bitsLost >= 0);
  const bad = T.kernel({ id: "planted.future", group: "time", axes: ["time"], claims: "homomorphism", from: {}, to: {}, forward: (f) => ({ values: T.delayValues(f.values, -3) }), keeps: h.keeps, loss: () => ({ bits: 0, method: "lie" }) });
  refuses(() => T.run(bad, T.seq("imp", x)), "ClaimError");
});
test("film integrates: exposure adds up and a difference returns it, both ways", () => {
  const x = T.seq("f", Float64Array.from({ length: 32 }, (_, i) => (i * 37) % 11)), o = T.run(T.filmIntegrate(), x);
  assert.equal(o.row.measured, "isomorphism");
  near(o.values[31], x.values.reduce((a, b) => a + b, 0), 1e-9);
});
test("delay: a delay moves the peak by d; a negative delay reads the future and is refused", () => {
  const x = new Float64Array(64); x[10] = 1;
  const o = T.run(T.delay(5), T.seq("i", x));
  assert.equal(o.values.indexOf(1), 15);
  refuses(() => T.run(T.delay(-5), T.seq("i", x)), "ClaimError");
});
test("Gabor: a Gaussian window sits on the limit; a box is far above it", () => {
  const dt = 1e-3, g = T.windowSpreads(T.gaussWindow(256, 20), dt), b = T.windowSpreads(T.boxWindow(256), dt);
  near(g.product / T.GABOR, 1, 0.01, "Gaussian on the limit");
  assert.ok(b.product > 3 * T.GABOR, "box above");
});
test("planted: a spectrogram that claims a cell below the Gabor limit is refused", () => {
  const dt = 1e-3, w = T.gaussWindow(64, 8), x = T.seq("t", tone(0.05, 1024)), sp = T.windowSpreads(w, dt);
  assert.ok(T.run(T.spectrogram(w, 16, dt), x).domain.shape[1] === 32);
  refuses(() => T.run(T.spectrogram(w, 16, dt, { id: "planted.below-gabor", claimCell: { dt: sp.st / 3, df: sp.sf / 3 } }), x), "ClaimError");
});
