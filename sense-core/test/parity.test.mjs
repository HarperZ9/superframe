import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../index.mjs";
import { gradient, checker, noisy } from "./fixtures/frames.mjs";

for (const [name, frame] of [["gradient", gradient()], ["checker", checker()], ["noisy", noisy()]]) {
  test(`features parity smoke: ${name} produces stable measured numbers`, () => {
    const { data, width: w, height: h } = frame;
    const rf = core.richFeatures(data, w, h, 4);
    assert.ok(rf.edgeDensity >= 0 && rf.edgeDensity <= 1);
    assert.equal(rf.width, w);
    assert.ok(["wide", "tall", "square"].includes(rf.orientation));
    assert.ok(core.dominantColors(data, w, h, 4, 5).length >= 1);
    assert.ok(typeof core.describeFrame(rf) === "string");
  });
}
