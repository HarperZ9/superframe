import { test } from "node:test";
import assert from "node:assert/strict";
import { rotateND, allPlanes, spinningPlanes } from "../core/rotate.mjs";

test("allPlanes(n) = C(n,2) unique a<b pairs", () => {
  for (let n = 2; n <= 8; n++) {
    const P = allPlanes(n);
    assert.equal(P.length, (n * (n - 1)) / 2);
    for (const { a, b } of P) assert.ok(a < b && b < n);
    assert.equal(new Set(P.map((p) => `${p.a},${p.b}`)).size, P.length);
  }
});

test("rotateND preserves vector length (orthonormal) and does not mutate input", () => {
  const v = [Float64Array.from([1, 0, 0, 0])];
  const planes = spinningPlanes(4, 0.7, "all");
  const out = rotateND(v, planes);
  assert.ok(Math.abs(Math.hypot(...out[0]) - 1) < 1e-9);
  assert.deepEqual([...v[0]], [1, 0, 0, 0]); // untouched
});

test("rotateND single plane by π/2 maps e_a→e_b", () => {
  const out = rotateND([Float64Array.from([1, 0])], [{ a: 0, b: 1, angle: Math.PI / 2 }]);
  assert.ok(Math.abs(out[0][0] - 0) < 1e-9 && Math.abs(out[0][1] - 1) < 1e-9);
});

test("spinningPlanes isoclinic (n=4) returns two equal-rate orthogonal planes", () => {
  const P = spinningPlanes(4, 1, "isoclinic");
  assert.equal(P.length, 2);
  assert.equal(P[0].angle, P[1].angle);
  // {0,1} and {2,3} share no axis
  assert.equal(new Set([P[0].a, P[0].b, P[1].a, P[1].b]).size, 4);
});
