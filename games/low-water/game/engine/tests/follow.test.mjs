// The camera's follow (world/camera.mjs), as the reference's gameplay camera does it
// (cleanroom/spec/NRFTW-PRESENTATION-2.md 1.2): smooth time by speed, look-ahead, room below.
import { test } from "node:test";
import assert from "node:assert/strict";
import { smoothTime, leadFor, damp, follower, FOLLOW } from "../world/camera.mjs";

test("smooth time is 0.25 s up to 2 m/s and 0.75 s at 10 m/s; a fight holds it to 0.5 s", () => {
  assert.equal(smoothTime(1), 0.25); assert.equal(smoothTime(10), 0.75); assert.ok(Math.abs(smoothTime(6) - 0.5) < 1e-9);
  assert.equal(smoothTime(10, true), 0.5);
});

test("look-ahead: none under 0.75 m/s, 3 m from 5 m/s", () => {
  assert.equal(leadFor(0.5), 0); assert.equal(leadFor(5), 3); assert.equal(leadFor(9), 3);
  assert.ok(leadFor(2.875) > 1.4 && leadFor(2.875) < 1.6);
});

test("the critically damped step arrives without overshoot", () => {
  const st = { x: 0, v: 0 }; let max = 0;
  for (let i = 0; i < 120; i++) { damp(st, 100, 0.25, 1 / 60); max = Math.max(max, st.x); }
  assert.ok(st.x > 99.5 && max <= 100.0001, `at ${st.x}, peak ${max}`);
});

test("walking east leads east and keeps room below; standing still lets both go", () => {
  const F = follower(); let o = [0, 0];
  for (let i = 0; i < 180; i++) o = F.offset([3, 0], 1 / 60, [0, 1]);
  assert.ok(o[0] > 1.5 && o[0] <= FOLLOW.lead.max, `lead ${o[0]}`);
  assert.ok(o[1] > 1.0, `room below ${o[1]}`);
  for (let i = 0; i < 600; i++) o = F.offset([0, 0], 1 / 60, [0, 1]);
  assert.ok(Math.abs(o[0]) < 0.01 && Math.abs(o[1]) < 0.05, `settled ${o}`);
});
