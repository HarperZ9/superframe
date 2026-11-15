// The peoples' palettes lean a sitter's tones toward their people by a small share: a Hesh sitter's light
// is moved toward the Hesh light, a sitter of two peoples takes half of each, and the move stays small
// (no caricature). Control: a sitter of no known people is left as rendered.
//   node --test tools/studio/tests/peoples.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { peopleOf, tintTones, peoples, share } from "../core/peoples.mjs";
import { useGame } from "../core/game.mjs";

const tones = { light: [0.85, 0.66, 0.54], shadow: [0.32, 0.23, 0.21] };
const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
test("a people leans the tones a little toward its own; two peoples take half each", () => {
  const hesh = tintTones(tones, peopleOf({ info: { quota: { people: "Hesh" } } }));
  assert.ok(d(hesh.light, peoples().Hesh.light) < d(tones.light, peoples().Hesh.light), "toward the Hesh light");
  assert.ok(d(hesh.light, tones.light) < 0.06 && share() <= 0.25, `a small move (${d(hesh.light, tones.light).toFixed(3)})`);
  const both = peopleOf({ info: { quota: { people: "Hesh and Tarn" } } }); assert.deepEqual(both.weights, { Tarn: 0.5, Hesh: 0.5 });
  const none = peopleOf({ info: { quota: { people: "the Directorate" } } }); assert.deepEqual(tintTones(tones, none), tones, "control: no known people, no change");
});
test("a game without peoples (Low Water) leaves every sitter as rendered", async () => {
  await useGame("lowwater"); try { assert.deepEqual(tintTones(tones, peopleOf({ info: { quota: { people: "Hesh" } } })), tones); } finally { await useGame("quota"); }
});
