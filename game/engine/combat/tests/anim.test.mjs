// Combat drives animation clips by warping their time to the move's frames.
import { test } from "node:test";
import assert from "node:assert/strict";
import { warp, poseOf, checkClips } from "../anim/drive.mjs";
import { defineMoves, FPS } from "../sim/moves.mjs";
import { makeWorld, run, press } from "./helpers.mjs";

const M = defineMoves({ a: { startup: 12, active: 4, recovery: 20 } }).a;

test("clip time is warped so the windup ends on the last startup frame and the active span fits", () => {
  const clip = { length: 1.2, phases: [{ from: 0, to: 0.5, name: "windup" }, { from: 0.5, to: 0.6, name: "active" }, { from: 0.6, to: 1.2, name: "recovery" }] };
  assert.equal(warp(M, 12, clip), 0.5);
  assert.ok(Math.abs(warp(M, 16, clip) - 0.6) < 1e-9);
  assert.ok(Math.abs(warp(M, 36, clip) - 1.2) < 1e-9);
  assert.ok(Math.abs(warp(M, 18, null) - 18 / FPS) < 1e-9, "no clip: proportional");
});

test("a pose follows the move, and the clip check lists what the art still has to supply", () => {
  const W = makeWorld({ brains: false, foes: [] });
  run(W, 1, press("light")); run(W, 5);
  const p = poseOf(W, W.lamb());
  assert.equal(p.anim, "shield.light_1");
  assert.equal(p.clip, "lamb.shield.light_1");
  assert.equal(p.phase, "startup");
  const missing = checkClips(W, {});
  assert.ok(missing.length > 10 && missing.every((x) => x.problem === "missing"));
});
