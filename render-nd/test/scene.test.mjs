import { test } from "node:test";
import assert from "node:assert/strict";
import { renderScene } from "../index.mjs";

test("renderScene(cube,4) yields 16 points + 32 segments in [-1,1]", () => {
  const s = renderScene({ kind: "cube", n: 4, t: 0.5, scale: 0.5 });
  assert.equal(s.points.length, 16);
  assert.equal(s.segments.length, 32);
  for (const p of s.points) assert.ok(p.x >= -1 && p.x <= 1 && p.y >= -1 && p.y <= 1);
});

test("renderScene respects projection mode + n=1..10 never throws", () => {
  for (let n = 1; n <= 10; n++)
    for (const mode of ["perspective", "orthographic", "stereographic"])
      assert.ok(renderScene({ kind: "cube", n, projection: { mode } }).points.length === 2 ** n);
});

test("renderScene supports all kinds", () => {
  assert.equal(renderScene({ kind: "simplex", n: 5 }).points.length, 6);
  assert.equal(renderScene({ kind: "orthoplex", n: 4 }).points.length, 8);
  assert.equal(renderScene({ kind: "24cell" }).segments.length, 96);
});
