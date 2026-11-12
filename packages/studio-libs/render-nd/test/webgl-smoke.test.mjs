import { test } from "node:test";
import assert from "node:assert/strict";
import { drawSceneGL } from "../backends/webgl.mjs";
test("webgl backend exports drawSceneGL", () => {
  assert.equal(typeof drawSceneGL, "function");
});
