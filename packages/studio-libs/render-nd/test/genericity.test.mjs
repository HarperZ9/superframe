import { test } from "node:test";
import assert from "node:assert/strict";
import { renderScene } from "../index.mjs";
import { vertexCollisions, isGenericView, nudgeToGeneric } from "../core/genericity.mjs";

// ---------------------------------------------------------------------------
// vertexCollisions — unit correctness on hand-built points
// ---------------------------------------------------------------------------

test("vertexCollisions: two coincident points → count 1", () => {
  const points = [
    { x: 0.1, y: 0.2 },
    { x: 0.1, y: 0.2 },
    { x: 0.9, y: 0.9 },
  ];
  const { count, pairs } = vertexCollisions(points);
  assert.equal(count, 1);
  assert.deepEqual(pairs[0], [0, 1]);
});

test("vertexCollisions: all far-apart points → count 0", () => {
  const points = [
    { x: -0.8, y: -0.8 },
    { x:  0.0, y:  0.0 },
    { x:  0.8, y:  0.8 },
  ];
  const { count } = vertexCollisions(points);
  assert.equal(count, 0);
});

test("vertexCollisions: pair just above eps threshold → not counted", () => {
  const eps = 1e-3;
  // distance = sqrt(2) * eps * 1.1 > eps
  const delta = eps * 1.1 / Math.SQRT2;
  const points = [
    { x: 0, y: 0 },
    { x: delta, y: delta },
  ];
  const { count } = vertexCollisions(points, eps);
  assert.equal(count, 0);
});

test("vertexCollisions: pair just below eps threshold → counted", () => {
  const eps = 1e-3;
  // distance = sqrt(2) * delta; want distance < eps → delta < eps/sqrt(2)
  const delta = eps * 0.4 / Math.SQRT2;
  const points = [
    { x: 0, y: 0 },
    { x: delta, y: delta },
  ];
  const { count } = vertexCollisions(points, eps);
  assert.equal(count, 1);
});

// ---------------------------------------------------------------------------
// E2 counterexample: 3-cube in orthographic identity view HAS collisions
// ---------------------------------------------------------------------------

test("3-cube orthographic t=0 view has vertex collisions (E2 counterexample)", () => {
  const scene = renderScene({
    kind: "cube",
    n: 3,
    t: 0,
    projection: { mode: "orthographic" },
  });
  const { count } = vertexCollisions(scene.points);
  assert.ok(
    count > 0,
    `Expected collisions in degenerate orthographic view, got count=${count}`
  );
});

// ---------------------------------------------------------------------------
// nudgeToGeneric: resolves the E2 counterexample
// ---------------------------------------------------------------------------

test("nudgeToGeneric fixes 3-cube orthographic t=0 collision", () => {
  const sceneOpts = {
    kind: "cube",
    n: 3,
    t: 0,
    projection: { mode: "orthographic" },
  };
  const result = nudgeToGeneric(sceneOpts);

  assert.ok(result.generic === true, "Expected nudgeToGeneric to find a generic view");
  assert.ok(result.tries >= 1, "Expected at least one perturbation attempt");

  const { count } = vertexCollisions(result.scene.points);
  assert.equal(count, 0, "Returned scene must have zero collisions");
});

test("nudgeToGeneric adjusts t deterministically (same opts → same result)", () => {
  const opts = { kind: "cube", n: 3, t: 0, projection: { mode: "orthographic" } };
  const r1 = nudgeToGeneric(opts);
  const r2 = nudgeToGeneric(opts);
  assert.equal(r1.opts.t, r2.opts.t, "nudgeToGeneric must be deterministic");
  assert.equal(r1.tries, r2.tries);
});

// ---------------------------------------------------------------------------
// isGenericView: boolean consistency with vertexCollisions
// ---------------------------------------------------------------------------

test("isGenericView is boolean and consistent with vertexCollisions (4-cube perspective t=0.5)", () => {
  const scene = renderScene({ kind: "cube", n: 4, t: 0.5 });
  const result = isGenericView(scene);

  // Must be a proper boolean
  assert.ok(typeof result === "boolean", "isGenericView must return boolean");

  // Must be consistent with vertexCollisions
  const { count } = vertexCollisions(scene.points);
  const expected = count === 0;
  assert.equal(result, expected, "isGenericView must match vertexCollisions.count===0");
});

test("isGenericView returns false for hand-built colliding scene", () => {
  const fakeScene = {
    points: [
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ],
  };
  assert.equal(isGenericView(fakeScene), false);
});

test("isGenericView returns true for hand-built collision-free scene", () => {
  const fakeScene = {
    points: [
      { x: -0.5, y: 0 },
      { x:  0.5, y: 0 },
    ],
  };
  assert.equal(isGenericView(fakeScene), true);
});
