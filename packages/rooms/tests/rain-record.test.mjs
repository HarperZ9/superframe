// SPDX-License-Identifier: FSL-1.1-MIT
// The forest-in-rain scene draws its rain from the scene-physics record the workstation plays
// (core/data/rain-record.js, written by packages/daw). Accept: the record's 2 mm/h gives the threshold the scene
// had before it read the record (.86), heavier rain lowers the threshold (more lit cells), and the threshold is
// the Poisson chance a cell holds no drop. Control: a scene built without the record's density would not change.
import test from "node:test";
import assert from "node:assert/strict";
import { RAIN_RECORD } from "../core/data/rain-record.js";
import { SCENES, rainThreshold, RAIN_CELL_M3 } from "../core/scenes.js";

test("rain streak density comes from the record", () => {
  assert.equal(RAIN_RECORD.rate_mm_h, 2);
  assert.ok(Math.abs(rainThreshold(RAIN_RECORD.drops_per_m3) - 0.86) < 0.005);
  assert.match(SCENES.rain.glsl, /step\(\.86,h\)/);
  assert.ok(rainThreshold(3705) < rainThreshold(RAIN_RECORD.drops_per_m3));   // 50 mm/h: more streaks
  assert.equal(rainThreshold(1000), Math.exp(-1000 * RAIN_CELL_M3));
  assert.equal(rainThreshold(0), 1);                                           // no drops, no streaks
});
