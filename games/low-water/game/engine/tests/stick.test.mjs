// The movement stick (core/stick.mjs; engine PROGRESS 37): no flicker at the dead zone's edge, a continuous
// length from the edge to full tilt, the stick's own direction, never over 1. Control: the old rule (on at
// 0.35, the raw length) flickers on the same noisy stick and steps at the edge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { shapeStick, STICK } from "../core/stick.mjs";

const old = (ax, ay) => (Math.hypot(ax, ay) >= 0.35 ? { x: ax, z: ay, on: true } : { x: 0, z: 0, on: false });
// a stick held at the dead zone's edge with noise: 0.02 either way, 600 frames
function flicker(fn, centre) {
  let on = false, flips = 0, s = 7;
  for (let i = 0; i < 600; i++) { s = (s * 1103515245 + 12345) & 0x7fffffff; const m = centre + ((s / 0x7fffffff) - 0.5) * 0.04; const r = fn(m, 0, on); if (r.on !== on && i) flips++; on = r.on; }
  return flips;
}

test("no flicker: a noisy stick at the dead zone's edge turns on once and stays on", () => {
  assert.ok(flicker(shapeStick, STICK.dead) <= 1, `${flicker(shapeStick, STICK.dead)} flips`);
  assert.ok(flicker((x, y) => old(x, y), 0.35) > 20, "control: the old rule flickers");
});

test("a continuous length: from just over combat's threshold at the edge to 1 at full tilt, no step over 0.02", () => {
  let prev = null, worst = 0, on = false;
  for (let m = STICK.dead; m <= 1.0001; m += 0.005) { const r = shapeStick(m, 0, on); on = r.on; const L = Math.hypot(r.x, r.z); if (prev != null) worst = Math.max(worst, Math.abs(L - prev)); prev = L; }
  assert.ok(worst <= 0.02, `largest step ${worst}`);
  assert.ok(Math.abs(Math.hypot(...Object.values(shapeStick(STICK.dead, 0)).slice(0, 2)) - STICK.floor) < 1e-9 && STICK.floor > 0.2);
  assert.ok(Math.abs(shapeStick(1, 0).x - 1) < 1e-9);
  // control: the old rule steps from 0 to 0.35 at its edge
  assert.ok(Math.hypot(old(0.351, 0).x) - Math.hypot(old(0.349, 0).x) > 0.3);
});

test("direction kept and length never over 1, a diagonal at full tilt included", () => {
  for (const [ax, ay] of [[0.6, 0.6], [1, 1], [-0.4, 0.9], [0.31, -0.05]]) {
    const r = shapeStick(ax, ay, true);
    assert.ok(Math.hypot(r.x, r.z) <= 1 + 1e-9);
    assert.ok(Math.abs(Math.atan2(r.z, r.x) - Math.atan2(ay, ax)) < 1e-9);
  }
});
