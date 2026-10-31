// SPDX-License-Identifier: FSL-1.1-MIT
// SPDX-FileCopyrightText: 2026 Zain Dana Harper
/* ndim draws from superframe's seed rule xmur3-mulberry32/1.
     node --test packages/ndim/tests/seed.test.mjs
   Known answers pin the stream itself (so a change to either side shows), and a parity check holds ndim's
   restatement to superframe/lib/seed.mjs on many seeds and tags. superframe's files are read, never edited. */
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { rngFrom, nodeSeed, SEED_RULE } from "../../../superframe/lib/seed.mjs";
import { xmur3 } from "../../../substrate/lib/vendor/superstack.mjs";

const N = createRequire(import.meta.url)("../src/index.js");
const take = (r, k) => Array.from({ length: k }, () => r());

test("the rule name is superframe's", () => {
  assert.equal(N.SEED_RULE, SEED_RULE);
});

test("known answers: xmur3 hashes and the first draws of seed 20261030", () => {
  assert.equal(N.xmur3("20261030"), 2457827921);
  assert.equal(N.xmur3("7/rotations"), 3041349618);
  assert.deepEqual(take(N.rng(20261030), 5),
    [0.1839125412516296, 0.4805907658301294, 0.7419032580219209, 0.1306558575015515, 0.9369908792432398]);
  assert.deepEqual(take(N.rng(7, "rotations"), 3), [0.33139562071301043, 0.17684501549229026, 0.029723484069108963]);
});

test("parity with superframe/lib/seed.mjs on 200 seeds and tags", () => {
  for (let s = 0; s < 100; s++) {
    const seed = s % 2 ? s * 7919 : "recipe-" + s;
    assert.deepEqual(take(N.rng(seed), 16), take(rngFrom(seed), 16), `seed ${seed}`);
    assert.deepEqual(take(N.rng(seed, "node" + s), 16), take(nodeSeed(seed, "node" + s).rng, 16), `seed ${seed} tag node${s}`);
    assert.equal(N.xmur3(String(seed)), xmur3(String(seed)));
  }
});

test("substreams are independent of each other and of the bare seed", () => {
  const a = take(N.rng(7), 8), b = take(N.rng(7, "a"), 8), c = take(N.rng(7, "b"), 8);
  assert.notDeepEqual(a, b);
  assert.notDeepEqual(b, c);
});

test("planted: the old raw-seed mulberry32 stream is not the rule's stream", () => {
  const raw = N.mulberry32(20261030); // what N.rng(20261030) returned before the rule
  assert.notDeepEqual(take(raw, 5), take(N.rng(20261030), 5));
});

test("lone surrogates are refused, as superframe refuses them", () => {
  assert.throws(() => N.xmur3("a\ud800b"), RangeError);
  assert.throws(() => xmur3("a\ud800b"), RangeError);
});
