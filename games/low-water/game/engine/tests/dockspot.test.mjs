// The fight's status panel finds a corner clear of the ways out (ui/fightways.mjs dockSpot).
import { test } from "node:test";
import assert from "node:assert/strict";
import { dockSpot } from "../ui/fightways.mjs";

const view = [1280, 720], size = [320, 270];
test("the status panel stays bottom left while that corner is clear", () => {
  assert.equal(dockSpot(size, view, { boxes: [[600, 300, 700, 400]] }).spot, "bl");
});
test("a way out under the bottom-left corner moves it to the first clear corner, clear of other paper", () => {
  const r = dockSpot(size, view, { boxes: [[340, 500, 520, 620]], avoid: [[28, 28, 200, 130]], tops: { left: 142, right: 80, keysTop: 640 } });
  assert.equal(r.spot, "tl");
  assert.ok(r.rect[1] >= 142, "under the HUD");
  const r2 = dockSpot(size, view, { boxes: [[340, 500, 520, 620], [100, 200, 260, 330]], tops: { left: 142, right: 80, keysTop: 640 } });
  assert.equal(r2.spot, "tr");
});
