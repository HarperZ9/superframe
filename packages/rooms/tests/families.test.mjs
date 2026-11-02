import test from "node:test";
import { assert, near } from "./h.mjs";
import { shY, shBody, registerSphericalHarmonics } from "../core/families.js";
import { shape, unregisterShape } from "../core/registry.js";
import { lensFS } from "../core/shaders/lens.js";

const inner = (a, b) => {
  let s = 0;
  const nt = 120,
    np = 240;
  for (let i = 0; i < nt; i++)
    for (let j = 0; j < np; j++) {
      const t = ((i + 0.5) / nt) * Math.PI,
        f = ((j + 0.5) / np) * 2 * Math.PI;
      s += a(t, f) * b(t, f) * Math.sin(t) * (Math.PI / nt) * ((2 * Math.PI) / np);
    }
  return s;
};
test("harmonics are orthonormal up to l 4", () => {
  const all = [];
  for (let l = 0; l <= 4; l++) for (let m = -l; m <= l; m++) all.push([l, m]);
  for (const [l, m] of all) {
    const Y = (t, f) => shY(l, m, t, f);
    near(inner(Y, Y), 1, 2e-3, `norm ${l},${m}`);
  }
  near(inner((t, f) => shY(2, 0, t, f), (t, f) => shY(4, 0, t, f)), 0, 1e-3, "l differs");
  near(inner((t, f) => shY(3, 2, t, f), (t, f) => shY(3, -2, t, f)), 0, 1e-3, "m sign differs");
});
test("known values: Y(0,0) and Y(1,0)", () => {
  near(shY(0, 0, 1, 2), 1 / Math.sqrt(4 * Math.PI), 1e-14, "Y00");
  near(shY(1, 0, 0, 0), Math.sqrt(3 / (4 * Math.PI)), 1e-14, "Y10 at the pole");
});
test("planted: a wrong norm fails", () => {
  assert.ok(Math.abs(inner((t, f) => 2 * shY(2, 1, t, f), (t, f) => shY(2, 1, t, f)) - 1) > 0.5);
});
test("the body is flat and fits the shape registry", () => {
  const b = shBody(4, 3);
  assert.doesNotMatch(b, /\bfor\b|\bwhile\b/);
  assert.match(b, /^float ct=/);
  const ids = registerSphericalHarmonics(3);
  assert.equal(ids.length, 15);
  assert.ok(shape("sh2_1"));
  const fs = lensFS({ a: shape("sh3_-2").body, b: null, m: null, grin: null, scene: "chart", fhelp: false, pol: false, pt: true, St: { inner: null }, meta: false, scat: false, tr: false, ltex: false, pat: false, soap: false, inner: null, prof: false });
  assert.ok(fs.length < 16000, `program ${fs.length}`);
  ids.forEach(unregisterShape);
  assert.equal(shape("sh2_1"), null);
});
