import { test } from "node:test";
import assert from "node:assert/strict";
import { depthCue } from "../core/depth.mjs";

test("depthCue maps t∈[0,1] to increasing size+opacity, rgb bytes", () => {
  const near = depthCue(1), far = depthCue(0);
  assert.ok(near.size > far.size && near.opacity > far.opacity);
  for (const c of near.color) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255);
});
