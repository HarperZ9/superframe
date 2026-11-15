// The sitter's restated portrait rig and mood mapping, against their sources: the paraffin rig must equal
// characters/proto/portrait_light.mjs (the Studio cannot import that module in a browser), and every mood
// must turn into old-head sliders through the voice bible's portraitCue.
//   node --test tools/studio/tests/sitter.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { PARAFFIN, MOODS, exprFor, keyDir, KEY, CAM } from "../core/sitter.mjs";
import { PORTRAIT_RIG } from "../../../characters/proto/portrait_light.mjs";

test("the Studio's paraffin rig is the portrait bake's rig", () => {
  assert.deepEqual(PARAFFIN, PORTRAIT_RIG.paraffin.rig);
  assert.notDeepEqual({ ...PARAFFIN, amb: [0, 0, 0] }, PORTRAIT_RIG.paraffin.rig, "control: a changed value is caught");
});
test("the default key comes from round the camera toward the side the sitter faces, a little high", () => {
  const d = keyDir(KEY), facing = CAM.yaw - CAM.turn, bearing = (Math.atan2(d[0], d[2]) * 180) / Math.PI;
  assert.ok(CAM.turn < 0, "the sitter faces the viewer's right");
  assert.ok(bearing - CAM.yaw > 30 && bearing - CAM.yaw < 70, `off the camera axis by ${(bearing - CAM.yaw).toFixed(0)} degrees`);
  assert.ok(Math.sign(bearing - CAM.yaw) === Math.sign(facing - CAM.yaw), "on the side the face turns to");
  assert.ok(d[1] > 0.3, "from above");
});
test("every mood goes through the painter's exprFor; the lie holds the mouth's corners nearer neutral than warmth", () => {
  for (const m of Object.keys(MOODS)) { const e = exprFor(m); assert.ok(e.cue && Number.isFinite(e.lidsAdd) && e.mouthW > 0, m); }
  const warm = exprFor("warm").cue, lying = exprFor("lying").cue, neutral = exprFor("neutral").cue;
  assert.ok(warm.corners > 0.3 && Math.abs(lying.corners - neutral.corners) < Math.abs(warm.corners - neutral.corners), `warm ${warm.corners}, lying ${lying.corners}`);
  assert.ok(exprFor("angry", true).brow !== undefined, "a sculpted head reads the cue's sliders directly");
  assert.throws(() => exprFor("smug"), /no mood/, "control: an unknown mood is an error");
});
