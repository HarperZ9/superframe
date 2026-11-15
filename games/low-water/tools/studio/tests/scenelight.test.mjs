// The key from the scene: a light model's key, measured from the way the sitter faces in that scene, comes
// out on the same side of the face in the Studio. Without a model the portrait keeps its own key.
//   node --test tools/studio/tests/scenelight.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sceneKey, keyForSitter } from "../core/scenelight.mjs";
import { keyDir, CAM } from "../core/sitter.mjs";

const fake = (dir) => ({ drawerRig: () => ({ rig: { key: { dir, c: [1, 0.8, 0.6] } }, tone: null }) });
// the key's angle from the sitter's forward, signed by side (y up), in any frame
const sideAngle = (dir, facingDeg) => { const f = (facingDeg * Math.PI) / 180, fx = Math.sin(f), fz = Math.cos(f), d = Math.hypot(dir[0], dir[2]); return Math.atan2(fz * dir[0] - fx * dir[2], fx * dir[0] + fz * dir[2]) * (180 / Math.PI) * (d ? 1 : 0); };
test("the key keeps its angle and side to the face, from the scene to the Studio", async () => {
  const dir = [0.7, 0.3, -0.65], sceneFacing = 90, k = await sceneKey({ at: [0, 0, 0], facing: sceneFacing }, fake(dir));
  const inScene = sideAngle(dir, sceneFacing), inStudio = sideAngle(keyDir(keyForSitter(k, CAM)), CAM.yaw - CAM.turn);
  assert.ok(Math.abs(inScene - inStudio) < 0.5, `same angle and side: scene ${inScene.toFixed(1)}, Studio ${inStudio.toFixed(1)}`);
  assert.ok(Math.abs(k.el - (Math.asin(0.3 / Math.hypot(...dir)) * 180) / Math.PI) < 0.1, "same height");
  const other = sideAngle(keyDir(keyForSitter({ ...k, az: -k.az }, CAM)), CAM.yaw - CAM.turn);
  assert.ok(Math.sign(other) !== Math.sign(inStudio), "control: the mirrored key lands on the other side");
});
test("no light model: null, and the portrait keeps its key", async () => {
  assert.equal(await sceneKey({ at: [0, 0, 0] }, { drawerRig: () => null }), null);
});
