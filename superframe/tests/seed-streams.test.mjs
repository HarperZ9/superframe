// Origin: HarperZ9.github.io system/media-engine/seed.test.mjs at commit c8866cc4, carried with the module on 2026-11-14; imports repointed.
// Left on the site: the three receipt tests, which need media-engine/receipt.mjs (not in the engine).
// node --test system/media-engine/seed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, mulberry32, fnv1a32, rngFrom, xmur3 } from "../lib/seed-streams.mjs";

// The Atelier's makeRng (system/atelier.js) is an IIFE-scoped classic script, so its first
// draws for "folded-light" are pinned here from a run of that code on 3 October 2026.
test("makeRng reproduces the Atelier stream for a seed", () => {
  const a = makeRng("folded-light"), b = makeRng("folded-light");
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b);
  assert.deepEqual(sa, sb);
  assert.deepEqual(sa, [0.9906783360056579, 0.32101074047386646, 0.3623448656871915, 0.8829958774149418, 0.6267387378029525]);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(sa, Array.from({ length: 5 }, makeRng("folded-light ")));
});

// The eighteen module copies this replaced were checked against these functions before removal;
// the pins below were computed from the removed plotter.js copy (main before this change).
test("mulberry32, fnv1a32 and rngFrom keep the streams the replaced copies drew", () => {
  assert.deepEqual(Array.from({ length: 3 }, mulberry32(58)), [0.49995423946529627, 0.6492740425746888, 0.7108881543390453]);
  assert.equal(fnv1a32("folded-light"), 135105734);
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32(42), fnv1a32("42"));
  assert.deepEqual(Array.from({ length: 2 }, rngFrom("dye-transfer")), Array.from({ length: 2 }, mulberry32(fnv1a32("dye-transfer"))));
  assert.deepEqual(Array.from({ length: 2 }, rngFrom(null)), Array.from({ length: 2 }, rngFrom(1)));
  const own = () => 0.5;
  assert.equal(rngFrom(own), own, "a function seed passes through");
  assert.deepEqual(Array.from({ length: 2 }, mulberry32(-1)), Array.from({ length: 2 }, mulberry32(0xffffffff)));
});

test("the seed rule is the contract's: every vector seed draws its stream through this module", async () => {
  const { readFileSync } = await import("node:fs");
  const vec = JSON.parse(readFileSync(new URL("../../packages/superstack/vectors/seed.json", import.meta.url), "utf8"));
  assert.ok(vec.seeds.length >= 5);
  for (const c of vec.seeds) {
    assert.equal(xmur3(c.seed), c.u32, c.seed);
    const r = makeRng(c.seed);
    assert.deepEqual(Array.from({ length: c.floats.length }, r), c.floats, c.seed);
  }
  assert.deepEqual(Array.from({ length: 5 }, makeRng(vec.site_make_rng.seed)), vec.site_make_rng.first_five);
});
