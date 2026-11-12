import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { game, pick, ROOT } from "./helpers.mjs";
import { cameraScale, frame, ease, projectPlate } from "../world/camera.mjs";

const quay = JSON.parse(readFileSync(join(ROOT, "..", "..", "content", "quay", "place.json"), "utf8"));

test("scale per area: 2.25 outdoors, 1.75 in rooms, an area's own camera: key wins", () => {
  const G = game(); G.world.enter("t.quay"); assert.equal(cameraScale(G), 2.25);
  G.setPlace("t.room"); G.state.area = ""; assert.equal(cameraScale(G), 1.75, "a place with a stove is a room");
  G.content.map.areas["t.quay"].camera = 3; G.world.enter("t.quay"); assert.equal(cameraScale(G), 3);
  G.content.map.areas["t.quay"].camera = null;
});

test("camera: wide pulls back to the whole plate for the conversation; near or its end restores", () => {
  const G = game(); G.world.enter("t.quay");
  const t = G.talk("t.r.hub"); pick(t, "Test wide."); assert.equal(cameraScale(G), 1);
  pick(t, "Test: back."); assert.equal(cameraScale(G), 2.25, "camera: near");
  const H = game(); H.world.enter("t.quay"); const u = H.talk("t.y.wide"); assert.equal(cameraScale(H), 1);
  u.jump("t.leave"); assert.equal(cameraScale(H), 2.25, "the conversation ended");
});

test("frame: whole plate pixels, the subject left of the talk panel, clamped to the plate", () => {
  const f = frame({ plateW: 1280, plateH: 720, viewW: 1920, viewH: 1080, scale: 2.25, focus: [640, 360] });
  assert.ok(Number.isInteger(f.left) && Number.isInteger(f.top));
  assert.ok(Math.abs(f.zoom - 1.5 * 2.25) < 1e-9, "1080p over a 720-line plate, 2.25 closer");
  assert.ok(Math.abs(f.left + f.w / 2 - 640) <= 1, "centred");
  const t = frame({ plateW: 1280, plateH: 720, viewW: 1920, viewH: 1080, scale: 2.25, focus: [640, 360], talking: true });
  assert.ok(Math.abs((640 - t.left) * t.zoom - 1920 / 3) <= t.zoom, "the subject at a third of the width");
  const edge = frame({ plateW: 1280, plateH: 720, viewW: 1920, viewH: 1080, scale: 2.25, focus: [5, 5] });
  assert.deepEqual([edge.left, edge.top], [0, 0], "never off the plate");
});

// CAMERA.md asks for 2.25 times closer and quotes about 100 to 110 px at 1080p; the character
// lead's PIPELINE.md quotes 96 to 110 px in a 720-line view. Measured at the quay spawn, a 1.75 m
// figure is about 39 plate px today: 88 px in a 720-line view and 132 px at 1080p at 2.25 times.
// The scale is the decision; the sizes are reported (NOTES-FOR-ENGINEER, 2026-10-17).
test("2.25 times closer on the quay: a person's size scales by exactly that", (t) => {
  const head = projectPlate(quay.camera, quay.width, quay.height, [-1.2, 1.75, -2.6]), feet = projectPlate(quay.camera, quay.width, quay.height, [-1.2, 0, -2.6]);
  const platePx = feet[1] - head[1];
  const at = (viewW, viewH, scale) => platePx * frame({ plateW: quay.width, plateH: quay.height, viewW, viewH, scale }).zoom;
  assert.ok(Math.abs(at(1920, 1080, 2.25) / at(1920, 1080, 1) - 2.25) < 1e-9);
  // the sizes depend on the plate's bake (the look work re-bakes plates), so they are reported,
  // not asserted: node --test prints them with the test's diagnostics
  t.diagnostic(`quay figure: ${platePx.toFixed(1)} plate px; at 2.25: ${at(1280, 720, 2.25).toFixed(0)} px in 720 lines, ${at(1920, 1080, 2.25).toFixed(0)} px at 1080p`);
});

test("runs: frame({ bounds }) keeps a course and its water front in view, pulling back if needed", () => {
  const f = frame({ plateW: 1280, plateH: 720, viewW: 1920, viewH: 1080, scale: 2.25, bounds: [100, 200, 1100, 600] });
  assert.ok(f.left <= 100 && f.left + f.w >= 1100 && f.top <= 200 && f.top + f.h >= 600, "the whole course is on screen");
  assert.ok(f.zoom < 1.5 * 2.25, "pulled back past the area's closeness");
});

test("easing moves in whole plate pixels and always arrives", () => {
  let c = { zoom: 3, left: 0, top: 0 }; const t = { zoom: 3, left: 101, top: 37 };
  for (let i = 0; i < 400 && (c.left !== t.left || c.top !== t.top); i++) { c = ease(c, t, 1 / 60); assert.ok(Number.isInteger(c.left) && Number.isInteger(c.top)); }
  assert.deepEqual([c.left, c.top], [101, 37]);
});
