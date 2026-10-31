"use strict";
const { test, assert, T, needs, near, refuses, whiteGrid } = require("./h.js");

test("Abbe number from Sellmeier matches the catalogue vd", { skip: needs("schott") }, () => {
  for (const g of ["N-BK7", "F2", "SF10", "N-LAK22"]) { let r; try { r = T.glass(g); } catch { continue; } near(T.abbe(r), r.vd, 0.02, g); near(T.sellmeier(r, 587.5618), r.nd, 2e-5, g + " nd"); }
});
test("longitudinal chromatic aberration of a singlet is f / V", { skip: needs("schott") }, () => {
  const r = T.glass("N-BK7"), f = 100, shift = T.focalAt(r, f, T.LINES.C) - T.focalAt(r, f, T.LINES.F);
  near(shift, f / T.abbe(r), 0.05, "f / V");
});
test("Airy first zero sits at 1.22 lambda N", () => {
  const N = 512, nm = 550, ap = 2, f = 40, fnum = f / ap, dx = 1.5, p = T.psfMono({ N, dxUm: dx, apertureMm: ap, fMm: f, nm }), want = 1.22 * nm * 1e-3 * fnum;
  let b = 1; for (let x = 1; x < 60; x++) if (p[x] < p[b] && x * dx < want * 1.5) b = x;
  near(b * dx, want, dx, "first minimum");
  near(p.reduce((a, c) => a + c, 0), 1, 1e-9, "PSF sum");
});
test("the diffraction cutoff is 1 / (lambda N): the OTF is empty beyond it", () => {
  const N = 256, nm = 550, ap = 2, f = 40, dx = 3, p = T.psfMono({ N, dxUm: dx, apertureMm: ap, fMm: f, nm }), P = T.powerSpectrum(p, N, N);
  const cut = (1 / (nm * 1e-3 * (f / ap))) * N * dx; /* in bins */
  let beyond = 0; for (let k = Math.ceil(cut * 1.05); k < N / 2; k++) beyond = Math.max(beyond, P[k]);
  assert.ok(beyond < 1e-16, "above the cutoff " + beyond);
  assert.ok(P[Math.floor(cut * 0.5)] > 1e-3, "below the cutoff");
});
test("defocus lowers the Strehl ratio against the closed form for small W020", () => {
  const N = 256, base = { N, dxUm: 2, apertureMm: 2, fMm: 40, nm: 550 }, s = T.psfMono(Object.assign({ w020: 0.1 }, base))[0] / T.psfMono(base)[0];
  near(s, (Math.sin(Math.PI * 0.1) / (Math.PI * 0.1)) ** 2, 0.02, "sinc^2 defocus Strehl");
});
test("a shifted PSF is refused; a centred one passes", () => {
  const N = 32, img = whiteGrid(N), p = T.gaussPsf(N, 1.5);
  assert.ok(T.run(T.convolvePsf(p), img).row.bitsLost >= 0);
  const q = new Float64Array(N * N); for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) q[y * N + ((x + 3) % N)] = p[y * N + x];
  refuses(() => T.run(T.convolvePsf(q, { id: "planted.shifted" }), img), "ClaimError");
});
test("mirror and lens are one transfer function: a delta PSF equals the R = 1 mirror", () => {
  const N = 32, img = whiteGrid(N, 2), d = new Float64Array(N * N); d[0] = 1;
  const a = T.run(T.convolvePsf(d, { noise: 1e-4 }), img), b = T.run(T.mirror(1), img);
  a.values.forEach((v, i) => near(v, b.values[i], 1e-9));
  near(a.row.bitsLost, 0, 1e-6, "lossless at the end of the line");
});
test("the R = 1 mirror round trips bit exact and claims isomorphism", () => {
  const img = whiteGrid(16), o = T.run(T.mirror(1), img);
  assert.equal(o.row.measured, "isomorphism");
  assert.deepEqual(Array.from(o.values), Array.from(img.values));
});
test("a mirror's bits at a noise floor are log2(1 / R) per high-SNR mode", () => {
  const N = 32, img = whiteGrid(N, 3), R = 0.5, o = T.run(T.mirror(R, { noise: 1e-8 }), img);
  near(o.row.bitsLost / (N * N), 0.5 * Math.log2(1 / (R * R)), 0.01, "per mode");
});
test("silver reflectance from measured n and k follows the Fresnel closed form", { skip: needs("materials") }, () => {
  const q = T.nk("silver", 550), R = T.fresnelNormal(q.n, q.k);
  near(R, ((q.n - 1) ** 2 + q.k ** 2) / ((q.n + 1) ** 2 + q.k ** 2), 1e-12);
  assert.ok(R > 0.9 && R < 1, "silver at 550 nm " + R);
  assert.ok(T.run(T.metalMirror("silver", 550), whiteGrid(8)).prov.source.includes(q.source), "the source is named");
});
test("a metamer lens ignores a metameric black and keeps only three numbers", () => {
  const n = 81, r = T.rng(1, "spec"), s = Float64Array.from({ length: n }, () => 0.5 + r()), f = T.seq("spec", s), a = T.run(T.metamerLens(), f);
  const b = T.metamericBlack(n, 380, 5), s2 = s.map((x, i) => x + 0.1 * b[i]), a2 = T.run(T.metamerLens(), T.seq("spec2", s2));
  a.values.forEach((v, i) => near(v, a2.values[i], 1e-9));
  assert.ok(Math.hypot(...s.map((x, i) => x - s2[i])) > 0.1, "the spectra differ");
  assert.equal(a.values.length, 3);
  assert.ok(a.row.bitsLost > 0);
});
test("Beer-Lambert: transmittance is exp(-a d), and doubling the path squares it", () => {
  const f = whiteGrid(8), a = 3, d = 0.2, o = T.run(T.beerLambert(a, d), f);
  o.values.forEach((v, i) => near(v, f.values[i] * Math.exp(-a * d), 1e-12));
  near(T.beerLambert(a, 2 * d).forward(f).values[1] / f.values[1], Math.exp(-a * d) ** 2, 1e-12);
});
test("index matching: equal indices pass everything, mismatch loses (1 - R)^2N", () => {
  const f = whiteGrid(8), s = T.run(T.indexMatch(1.36, 1.36, 20), f);
  assert.deepEqual(Array.from(s.values), Array.from(f.values));
  const R = ((1.4 - 1.33) / (1.4 + 1.33)) ** 2;
  near(T.layersT(1.33, 1.4, 20), (1 - R) ** 40, 1e-12);
  assert.ok(T.layersT(1.33, 1.4, 200) < T.layersT(1.36, 1.38, 200));
  assert.equal(s.prov.status, "from_memory", "from-memory physics marks the output");
});
test("Porter-Duff: the nine operators match the published table", () => {
  const f = T.seq("layers", Float64Array.from([0.3, 0.6, 0.2, 0.5]), "1", { components: 4 }), A = 0.6, B = 0.5, ca = 0.3, cb = 0.2;
  const want = { clear: [0, 0], src: [ca, A], dst: [cb, B], over: [ca + cb * (1 - A), A + B * (1 - A)], under: [ca * (1 - B) + cb, A * (1 - B) + B], in: [ca * B, A * B], out: [ca * (1 - B), A * (1 - B)], atop: [ca * B + cb * (1 - A), A * B + B * (1 - A)], xor: [ca * (1 - B) + cb * (1 - A), A * (1 - B) + B * (1 - A)] };
  for (const op of T.PD_OPS) { const o = T.porterDuff(op).forward(f).values; near(o[0], want[op][0], 1e-12, op); near(o[1], want[op][1], 1e-12, op); }
});
test("film density stack: densities add, from measured dye curves", { skip: needs("kodak5219") }, () => {
  const d = [T.dyeDensity("yellow", 450), T.dyeDensity("magenta", 450), T.dyeDensity("cyan", 450)], f = T.seq("layers", Float64Array.from(d), "1", { components: 3 }), o = T.run(T.densityStack(), f);
  near(o.values[0], 10 ** -(d[0] + d[1] + d[2]), 1e-12);
  assert.ok(T.dyeDensity("yellow", 447) > T.dyeDensity("yellow", 650), "the yellow dye peaks in the blue");
});
test("transparency map: identity carries all; a constant output carries nothing", () => {
  const N = 16, r = T.rng(1, "m"), x = Float64Array.from({ length: N * N }, () => Math.floor(r() * 32) / 32), same = new Float64Array(2 * N * N), cons = new Float64Array(2 * N * N);
  x.forEach((v, i) => { same[2 * i] = v; same[2 * i + 1] = v; cons[2 * i] = v; cons[2 * i + 1] = 0.5; });
  const a = T.run(T.transparencyMap(8), T.grid("same", N, N, same, "1", { components: 2 })), b = T.run(T.transparencyMap(8), T.grid("const", N, N, cons, "1", { components: 2 }));
  assert.ok(Math.min(...a.values) > 3, "identity tiles carry several bits " + Math.min(...a.values));
  assert.ok(Math.max(...b.values) < 1e-9, "constant carries none");
  assert.equal(a.unit.name, "bit");
});
test("wrong units are refused at the door", () => {
  refuses(() => T.run(T.adc(8, 1), T.seq("not volts", new Float64Array(8), "m", { rep: T.ANALOG })), "UnitError");
  refuses(() => T.run(T.adc(8, 1), T.seq("digital volts", new Float64Array(8), "V")), "FieldError", "a digital field cannot enter an analog port");
  refuses(() => T.run(T.shot(), T.seq("volts", new Float64Array(8), "V")), "UnitError");
});
test("a kernel with no axes, or an unknown axis, cannot be made", () => {
  const b = { id: "x", group: "y", from: {}, to: {}, claims: "none", forward: (f) => ({ values: f.values }) };
  refuses(() => T.kernel(b), "FieldError");
  refuses(() => T.kernel(Object.assign({ axes: ["smell"] }, b)), "FieldError");
});
