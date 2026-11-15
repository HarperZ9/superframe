// The cast catalogue: records grouped by person and era through the cast's own ERA_IDS, so the export ids
// (`abel@e1`, `holt@e2`) name the right member; ids the map does not know fall back to their suffix.
//   node --test tools/studio/tests/session.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { castOf, catalogue, eraOf, personOf } from "../core/session.mjs";

const m = (age) => ({ build() {}, info: { quota: { age } } });
test("era ids from the cast map person and era; unknown ids fall back to their suffix", () => {
  const members = castOf({ NED: m(45), ABEL_ERA1: m(50), CAPTAIN: m(40) }, { ERA_IDS: { "ned@e2": "ned", "abel@e1": "abel_era1", "holt@e2": "captain" }, PELL_ADULT: m(40) });
  assert.deepEqual(Object.keys(members).sort(), ["abel_era1", "captain", "ned", "pell_adult"]);
  assert.equal(personOf("captain"), "holt"); assert.equal(eraOf("captain"), 2);
  assert.equal(personOf("abel_era1"), "abel"); assert.equal(eraOf("abel_era1"), 1);
  assert.equal(personOf("pell_adult"), "pell"); assert.equal(eraOf("pell_adult"), 3, "no map entry: the _adult suffix says era 3");
  const people = catalogue(members).map((g) => g.person).sort(); assert.deepEqual(people, ["abel", "holt", "ned", "pell"]);
  assert.notEqual(personOf("captain"), "captain", "control: without the map the captain would be filed under his cast id");
});
