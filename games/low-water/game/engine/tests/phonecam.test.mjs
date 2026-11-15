import { test } from "node:test";
import assert from "node:assert/strict";
import { setCamera, cameraScale } from "../world/camera.mjs";

// camera: phone (era 5's clip, 2026-10-23): the whole plate, framed as a phone, until camera: near
const fakeGame = () => { const seen = []; return { seen, state: {}, emit: (k, v) => seen.push([k, v]), world: { area: () => null }, book: { places: {} }, rs: { rules: { "camera-room": 1.75, "camera-outdoor": 2.25 } } }; };

test("camera: phone shows the whole plate inside the phone's frame, and near clears it", () => {
  const G = fakeGame();
  setCamera(G, "phone");
  assert.equal(G.state.camera.mode, "wide");
  assert.equal(G.state.camera.frame, "phone");
  assert.equal(cameraScale(G), 1);
  assert.deepEqual(G.seen.at(-1), ["camera", { mode: "wide", frame: "phone" }]);
  setCamera(G, "near");
  assert.equal(G.state.camera.frame, undefined);
  assert.deepEqual(G.seen.at(-1), ["camera", { mode: "near" }]);
});

test("camera: wide carries no phone frame", () => {
  const G = fakeGame();
  setCamera(G, "wide");
  assert.equal(G.state.camera.frame, undefined);
});
