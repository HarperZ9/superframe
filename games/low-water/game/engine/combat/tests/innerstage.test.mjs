// The inner arena's staging (combat/PROGRESS.md 30): every ground is staged, the shaft lands on a lamp the room has,
// and the readability judges (combat/tools/innermeasure.mjs) fail their planted cases and pass clean ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { INNER_ARENAS } from "../data/arenas-inner.mjs";
import { STAGES } from "../data/stages-inner.mjs";
import { BACK } from "../arena/innerback.mjs";
import { judgePlayer, judgeFeatures, judgeSilhouettes, iou } from "../tools/innermeasure.mjs";
import { makeG } from "./helpers.mjs";
import { hudTexts } from "../tools/notallycheck.mjs";

test("every inner ground is staged: a shaft that lands on one of the room's own lamps, a known building", () => {
  for (const [name, A] of Object.entries(INNER_ARENAS)) {
    const st = STAGES[name]; assert.ok(st, `${name} has no stage`);
    assert.ok((A.lights || [])[st.shaft.pool], `${name}: the shaft's pool ${st.shaft.pool} is not one of its lamps`);
    for (const m of st.back) assert.ok(BACK[m], `${name}: no building part "${m}"`);
  }
});

const frame = (h1080, sep, extra = {}) => ({ lamb: { h1080, sep, hidden: 0, act: null, pose: "free", down: false, ...extra } });
test("P1 and P2: a short or unreadable player fails; a roll is left out of the height", () => {
  assert.deepEqual(judgePlayer([frame(165, 0.8), frame(170, 0.7)]).errs, []);
  assert.ok(judgePlayer([frame(120, 0.8)]).errs.some((e) => e.startsWith("P1")), "a 120 px player");
  assert.deepEqual(judgePlayer([frame(165, 0.8), frame(60, 0.8, { pose: "dodge" })]).errs, [], "a roll is not a standing height");
  assert.ok(judgePlayer([frame(165, 0.3)]).errs.some((e) => e.startsWith("P2")), "an outline that does not read");
});

test("F1: a part too small or too close to its ring fails; a clear part passes", () => {
  const still = (f) => [{ still: "s.png", feats: [f] }];
  assert.deepEqual(judgeFeatures(still({ name: "eye", size: [12, 9], dL: 70 })).errs, []);
  assert.ok(judgeFeatures(still({ name: "planted:speck", size: [3, 3], dL: 70 })).errs.length, "a part 3 px across");
  assert.ok(judgeFeatures(still({ name: "planted:empty", size: [30, 30], dL: 2 })).errs.length, "a part over empty ground");
  assert.deepEqual(judgeFeatures(still({ name: "horn", size: [9, 9], dL: null, out: true })).errs, [], "a part off the frame is counted apart");
});

test("S1: two forms with one silhouette fail; different shapes pass; a room-only look is not held to differ", () => {
  const box = (w, h) => ({ box: [0, 0, w, h], rle: `0,${w * h}` }), tall = box(10, 40), wide = box(40, 10);
  assert.equal(iou(tall, tall), 1);
  assert.ok(iou(tall, wide) < 0.3);
  const st = (sils) => [{ still: "s.png", sil: sils }];
  assert.ok(judgeSilhouettes(st([{ id: "boss", form: "father", look: null, ...tall }, { id: "boss", form: "golem", look: null, ...tall }])).errs.length, "two forms, one shape");
  assert.deepEqual(judgeSilhouettes(st([{ id: "boss", form: "father", look: null, ...tall }, { id: "boss", form: "golem", look: null, ...wide }])).errs, []);
  assert.ok(judgeSilhouettes(st([{ id: "boss", form: "father", look: null, ...tall }, { id: "boss", form: "father", look: "saturn", ...tall }])).errs.length, "Saturn with the father's shape");
  assert.deepEqual(judgeSilhouettes(st([{ id: "boss", form: "coat", look: null, ...tall }, { id: "boss", form: "coat", look: "noon", ...tall }])).errs, [], "noon changes the room, not the coat");
});

test("the staged view draws six seconds of every inner fight without throwing (node's drawing stub)", async () => {
  for (const flaw of ["prudence", "only", "friday", "withme", "nearest", "forty", "check"]) {
    const texts = await hudTexts({ makeG, flaw, frames: 60 * 6 });
    assert.ok(texts.length > 0, flaw);
  }
});
