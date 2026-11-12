// Behavioral parity gate vs the live web sense.js. Becomes trivially true after Phase 5
// (sense.js re-exports sense-core); Phase 5 Task 5.2 removes/updates it then.

import { test } from "node:test";
import assert from "node:assert/strict";
import * as core from "../index.mjs";
import * as shipped from "../../../portfolio-site/system/sense.js";
import { gradient, checker, noisy } from "./fixtures/frames.mjs";

for (const [name, frame] of [
  ["gradient", gradient()],
  ["checker",  checker()],
  ["noisy",    noisy()],
]) {
  const { data, width: w, height: h } = frame;

  test(`parity: richFeatures byte-identical for ${name}`, () => {
    assert.deepEqual(
      core.richFeatures(data, w, h, 4),
      shipped.richFeatures(data, w, h, 4)
    );
  });

  test(`parity: dominantColors byte-identical for ${name}`, () => {
    assert.deepEqual(
      core.dominantColors(data, w, h, 4, 5),
      shipped.dominantColors(data, w, h, 4, 5)
    );
  });

  test(`parity: edgeDensity byte-identical for ${name}`, () => {
    assert.equal(
      core.edgeDensity(data, w, h, 4),
      shipped.edgeDensity(data, w, h, 4)
    );
  });
}
