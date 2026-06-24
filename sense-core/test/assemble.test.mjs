import { test } from "node:test";
import assert from "node:assert/strict";
import { assembleFullPerception, pyramid, multiScaleGrids } from "../index.mjs";
import { checker } from "./fixtures/frames.mjs";

test("pyramid returns grid4..grid64 at the right resolutions", () => {
  const { data, width, height } = checker();
  const p = pyramid(data, width, height, 4);
  assert.equal(p.grid4.length, 4);
  assert.equal(p.grid64.length, 64);
  assert.equal(p.grid8[0][0].length, 3); // [r,g,b]
});
test("assembleFullPerception keeps shipped fields + adds distributions & extended pyramid", () => {
  const { data, width, height } = checker();
  const r = assembleFullPerception(data, width, height, 4, { contrast: 0.5, source: "test" });
  // shipped contract — full field list so a silently-dropped field fails the test:
  for (const k of ["dimensions","phash","contrast","structure","balance","coverage","edgeDensity","light","dark","meanLuma","dominantColours","hueName","distributions","motion","audio","source","multiScale"]) assert.ok(k in r, `missing ${k}`);
  assert.equal(r.source, "test");
  assert.ok("grid8" in r.multiScale && "grid16" in r.multiScale && "grid32" in r.multiScale);
  // extensions:
  assert.ok("grid4" in r.multiScale && "grid64" in r.multiScale);
  assert.ok(Array.isArray(r.distributions.luma) && Array.isArray(r.distributions.hue));
});
test("multiScaleGrids keeps the [8,16,32] web-parity default", () => {
  const { data, width, height } = checker();
  assert.deepEqual(Object.keys(multiScaleGrids(data, width, height, 4)).sort(), ["grid16","grid32","grid8"]);
});
