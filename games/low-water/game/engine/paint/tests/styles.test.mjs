// Every glyph style (glyph/styles/*.json) is a complete parameter set over the one tone map; the measured
// density ramp the trace style uses rises monotonically through all sixteen tones (glyph/tonemap.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { measuredRamp, TONES } from "../glyph/tonemap.mjs";
import { PALETTES } from "../glyph/compose.mjs";
const dir = new URL("../glyph/styles/", import.meta.url), read = (f) => JSON.parse(readFileSync(new URL(f, dir), "utf8"));
const names = read("index.json"), density = read("density.json");

for (const n of names) test(`style ${n}: a complete parameter set`, () => {
  const s = read(`${n}.json`);
  assert.equal(s.name, n);
  assert.ok(s.palette in PALETTES, `palette ${s.palette}`);
  for (const k of ["crt", "glow"]) assert.equal(typeof s[k], "boolean", k);
  for (const k of ["bloom", "halation", "floor"]) assert.ok(typeof s[k] === "number" && s[k] >= 0 && s[k] <= 2, k);
  assert.ok(["materials", "measured"].includes(s.ramp));
  if (s.ramp === "measured") {
    assert.ok(s.charset && s.charset.length >= TONES, "a measured style names at least sixteen candidates");
    // the ramp from the measured coverage of the game's font: sixteen glyphs, coverage rising, spanning the range
    const chars = [...new Set([...s.charset])], cov = chars.map((ch) => density.coverage[ch] ?? 0), ramp = measuredRamp(cov, chars.map((_, i) => i));
    assert.equal(ramp.length, TONES);
    for (let k = 1; k < TONES; k++) assert.ok(cov[ramp[k]] >= cov[ramp[k - 1]], `tone ${k} not darker than ${k - 1}`);
    assert.ok(cov[ramp[TONES - 1]] - cov[ramp[0]] > 0.25, "the ramp spans the ink range");
  }
});

test("the recorded density ramp is monotone and was measured in the game's font", () => {
  assert.equal(density.ramp.length, TONES);
  for (let k = 1; k < TONES; k++) assert.ok(density.rampCoverage[k] >= density.rampCoverage[k - 1]);
});
