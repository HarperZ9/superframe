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

test("fxOf lists thrown things, tells with the world's answers, contacts and frozen bodies", async () => {
  const { fxOf } = await import("../anim/fx.mjs");
  const W = makeWorld({ brains: false, foes: [["holder", [8, 8]]], lambAt: [4, 8] }), F = W.fighters[1];
  F.face = Math.PI; F.lock = "lamb";
  W.step({ foe0: { press: ["world.throw"] } });
  for (let i = 0; i < 8; i++) W.step({});
  let fx = fxOf(W);
  assert.ok(fx.tells.some((t) => t.id === "foe0" && t.kind === "throw" && t.answer === "throw"), JSON.stringify(fx.tells));
  for (let i = 0; i < 50 && !W.projectiles.length; i++) W.step({});
  assert.ok(fxOf(W).thrown.some((p) => p.use === "stone"), "the stone is in the air");
  let hit = null;
  for (let i = 0; i < 60 && !hit; i++) { W.step({}); fx = fxOf(W); hit = fx.contacts.find((c) => c.id === "lamb"); }
  assert.ok(hit && hit.kind === "hit" && hit.power > 0, "the stone's contact is listed");
  assert.ok(fx.frozen.includes("lamb"), "the struck body holds in hit-stop");
});
