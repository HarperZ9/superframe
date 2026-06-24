import { test } from "node:test";
import assert from "node:assert/strict";
import { projectTo2D, project } from "../core/project.mjs";

test("projectTo2D parity: 2-D vector passes through unchanged, depth 1", () => {
  const r = projectTo2D(Float64Array.from([0.5, -0.3]));
  assert.ok(Math.abs(r.x - 0.5) < 1e-12 && Math.abs(r.y + 0.3) < 1e-12 && Math.abs(r.depth - 1) < 1e-12);
});

test("perspective: higher 3rd-dim coord projects nearer (larger depth + magnified)", () => {
  const near = project(Float64Array.from([1, 0, 1]), { mode: "perspective", dist: 3 });
  const far = project(Float64Array.from([1, 0, -1]), { mode: "perspective", dist: 3 });
  assert.ok(near.depth > far.depth);
  assert.ok(Math.abs(near.x) > Math.abs(far.x));
});

test("orthographic: x,y are the first two coords; depth monotonic in collapsed coords", () => {
  const r = project(Float64Array.from([0.4, 0.2, 1, -1]), { mode: "orthographic" });
  assert.ok(Math.abs(r.x - 0.4) < 1e-12 && Math.abs(r.y - 0.2) < 1e-12);
  const hi = project(Float64Array.from([0, 0, 1]), { mode: "orthographic" }).depth;
  const lo = project(Float64Array.from([0, 0, -1]), { mode: "orthographic" }).depth;
  assert.ok(hi > lo);
});

test("stereographic: finite for a point on the unit sphere, depth positive", () => {
  const r = project(Float64Array.from([0.6, 0, 0.8]), { mode: "stereographic", dist: 2 });
  assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y) && r.depth > 0);
});
