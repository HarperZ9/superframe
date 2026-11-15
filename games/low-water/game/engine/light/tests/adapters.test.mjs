// The adapters hand each consumer its own shape. node --test game/engine/light/tests/
import test from "node:test";
import assert from "node:assert/strict";
import { paintTerms, clockExposure, drawerRig } from "../adapters.mjs";

const F = { n: 3, N: new Float32Array([0, 1, 0, 0, 1, 0, 0, 1, 0]), E: new Float32Array([0.5, 0.4, 0.3, 0.01, 0.01, 0.02, 0.2, 0.2, 0.2]),
  rec: { side: Int8Array.from([127, -127, 0]), shadow: Uint8Array.from([0, 0, 0]), term: Uint8Array.from([0, 0, 255]), K: Uint16Array.from([1900, 9000, 4000]), key: Uint8Array.from([0, 252, 1]), occ: Uint8Array.from([0, 200, 0]) } };
test("paint terms: lit and shadow family, the terminator, warm and cool, the ruling light", () => {
  const a = paintTerms(F, null, 0), b = paintTerms(F, null, 1), c = paintTerms(F, null, 2);
  assert.ok(a.family > 0.95 && b.family < 0.05 && Math.abs(c.family - 0.5) < 0.01, "family follows the side");
  assert.ok(a.warm > 0.9 && b.warm < -0.5 && Math.abs(c.warm) < 0.01, "a fire is warm, the sky cool, 4000 K neutral");
  assert.equal(a.ruling, 0); assert.equal(b.ruling, -1, "the sky rules: no source"); assert.equal(c.terminator, 1);
  assert.ok(b.ao > 0.7);
});
test("clock exposure lifts a dark scene and leaves a lit one; the drawer gets nothing until the model is ready", () => {
  const dark = { n: 100, N: new Float32Array(300).fill(0) }, E = new Float32Array(300).fill(0.01), lit = new Float32Array(300).fill(0.5);
  assert.ok(clockExposure(E, dark) > 4 && clockExposure(lit, dark) === 1);
  globalThis.__lwLightModel = null; assert.equal(drawerRig([0, 0, 0], {}), null);
});
