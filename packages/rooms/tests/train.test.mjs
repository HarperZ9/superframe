import test from "node:test";
import { assert, near } from "./h.mjs";
import { PRESETS, paraxImage, achromat, surf } from "../core/train.js";
import { trainEFL, trainSpotRMS, traceTrain } from "../core/train-trace.js";

// Tolerance in percent. Each focal length comes from double-precision rays, and "expect" is on the preset.
const exp = {
  refractor: [10, 1.5],
  cooke: [50, 1.5],
  newton: [12, 0.1],
  cass: [12, 0.5],
  hst: [57.6, 1.5],
  paul: [4, 0.5],
  gregorian: [12, 0.5],
  keck: [17.487, 0.1],
  wolter: [10.05, 1.5],
};
for (const [k, [want, pct]] of Object.entries(exp))
  test(`${k}: focal length from rays against ${want}`, () => {
    assert.equal(PRESETS[k].expect, want);
    near(trainEFL(PRESETS[k]), want, (want * pct) / 100, k);
  });
test("planted: bending a Cooke radius moves the focal length out of range", () => {
  const p = PRESETS.cooke.make();
  p.s[0].R *= 1.2;
  const e = trainEFL({ make: () => p });
  assert.ok(Math.abs(e - 50) > 2, `got ${e}`);
});
test("a parabola has no on-axis spherical aberration; a sphere does", () => {
  const par = trainSpotRMS(PRESETS.newton.make());
  assert.ok(par < 1e-9, `parabola ${par}`);
  const sph = PRESETS.newton.make();
  sph.s[0].k = 0;
  assert.ok(trainSpotRMS(sph) > 1e-5, "sphere");
});
test("the Hubble flaw is visible: as launched spot exceeds design", () => {
  const d = trainSpotRMS(PRESETS.hst.make()),
    f = trainSpotRMS(PRESETS.hstflaw.make());
  assert.ok(f > 20 * d, `design ${d}, flawed ${f}`);
});
test("paraxial image of a thin lens obeys the lensmaker formula", () => {
  const s = [surf({ z: 0, R: 1, n: 1.5, ap: 0.2 }), surf({ z: 1e-6, R: -1, n: 1, ap: 0.2 })];
  near(paraxImage(s), 1, 2e-3, "lensmaker");
});
test("the thin achromat meets the achromat condition", () => {
  const s = achromat(0, 10, 1);
  assert.equal(s.length, 3);
  const c1 = 1 / s[0].R - 1 / s[1].R,
    c2 = 1 / s[1].R - 1 / s[2].R;
  near(c1 * ((s[0].n - 1) / s[0].V) + c2 * ((s[1].n - 1) / s[1].V), 0, 1e-12, "sum of power over V");
});
test("a ray that misses reports it", () => {
  const p = PRESETS.newton.make();
  assert.equal(traceTrain(p.s, { p: [0, 5, -10], d: [0, 0, 1] }, 1).ok, false);
});
