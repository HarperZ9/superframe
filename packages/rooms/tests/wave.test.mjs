import test from "node:test";
import { assert, near } from "./h.mjs";
import { fft2 } from "../core/wave.js";
import { focalField, firstDark, centreRatio, asmPropagate, gaussianBeam, energy } from "../core/propagate.js";
import { fresnel, stackRT, jonesTwisted, jonesSlices, retarderConversion } from "../core/film.js";

test("fft2 of a delta is flat", () => {
  const N = 16,
    re = new Float64Array(N * N),
    im = new Float64Array(N * N);
  re[0] = 1;
  fft2(re, im, N);
  for (let i = 0; i < N * N; i++) {
    near(re[i], 1, 1e-12, "re");
    near(im[i], 0, 1e-12, "im");
  }
});
const stop = { P: 128, N: 1024, D: 2, lam: 550e-6 / 20, z: 10 };
test("Airy: first dark ring of a round stop against 1.22 lambda z / D", () => {
  const f = focalField(stop);
  // One radial bin is a tenth of the radius here, and the page rule places the ring by bin index.
  near(firstDark(f), f.pred, 0.03 * f.pred, "dark ring");
});
test("planted: half the Airy radius is refused", () => {
  const f = focalField(stop);
  assert.ok(Math.abs(firstDark(f) - f.pred / 2) > 0.2 * f.pred);
});
test("spiral phase gives a dark centre, and a plain stop peaks there", () => {
  const f = focalField({ ...stop, phase: (x, y) => Math.atan2(y, x) });
  assert.ok(centreRatio(f) < 1e-3, `centre ${centreRatio(f)}`);
  near(centreRatio(focalField(stop)), 1, 1e-9, "plain stop");
});
test("angular spectrum: Gaussian beam against closed form, and energy", () => {
  const N = 256,
    dx = 0.02,
    w0 = 0.3,
    lam = 0.01,
    z = 4;
  const a = gaussianBeam(N, dx, w0);
  const e0 = energy(a);
  const b = asmPropagate(a, N, dx, lam, z);
  near(energy(b), e0, 1e-6 * e0, "energy");
  const zR = (Math.PI * w0 * w0) / lam,
    wz = w0 * Math.sqrt(1 + (z / zR) ** 2);
  let peak = 0;
  for (let i = 0; i < N * N; i++) peak = Math.max(peak, b.re[i] ** 2 + b.im[i] ** 2);
  near(peak, (w0 / wz) ** 2, 1e-3, "on-axis intensity");
});
test("Fresnel: normal incidence, Brewster and total internal reflection", () => {
  near(fresnel(1, 1.5, 0).Rs, 0.04, 1e-12, "normal");
  near(fresnel(1, 1.5, Math.atan(1.5)).Rp, 0, 1e-12, "Brewster");
  const t = fresnel(1.5, 1, Math.asin(1 / 1.5) + 0.1);
  near(t.Rs, 1, 1e-12, "TIR s");
  near(t.Rp, 1, 1e-12, "TIR p");
  assert.ok(Math.abs(t.retardance) > 0.01, "TIR phase difference");
});
test("thin films: quarter wave antireflection and a Bragg stack", () => {
  const n = Math.sqrt(1.5);
  near(stackRT([n], [550 / (4 * n)], 550, 1, 1.5).R, 0, 1e-12, "AR");
  const ns = [],
    ds = [];
  for (let i = 0; i < 12; i++) {
    ns.push(2.3, 1.38);
    ds.push(550 / (4 * 2.3), 550 / (4 * 1.38));
  }
  const b = stackRT(ns, ds, 550, 1, 1.5);
  assert.ok(b.R > 0.999, `Bragg ${b.R}`);
  near(b.R + b.T, 1, 1e-9, "lossless");
  assert.ok(stackRT(ns, ds, 900, 1, 1.5).R < 0.5, "off band");
});
test("Jones: the twisted closed form agrees with many slices", () => {
  const a = jonesTwisted(2.1, 1.1),
    b = jonesSlices(2.1, 1.1, 4000);
  for (let i = 0; i < 4; i++) {
    near(a[i][0], b[i][0], 1e-5, "re");
    near(a[i][1], b[i][1], 1e-5, "im");
  }
});
test("Jones: circular conversion of a retarder is sin squared of half G", () => {
  for (const G of [0.5, 1.5, Math.PI]) near(retarderConversion(G, 0.3), Math.sin(G / 2) ** 2, 1e-12, `G ${G}`);
});
