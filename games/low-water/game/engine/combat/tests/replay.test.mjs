// The simulation is a pure function of its arena, night, seed and inputs: a recorded fight
// replays to the same state, frame for frame.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, makeG } from "./helpers.mjs";
import { replay } from "../sim/world.mjs";
import { createPilot } from "../tools/pilot.mjs";

const make = (seed = 4, record = false) => () => makeWorld({ G: makeG({ clock: "23:30" }), seed, record, minutesPerFrame: 1 / 240,
  foes: [["holder", [8.5, 7.5]], ["skirmisher", [3, 8]]] });

test("a recorded fight replays to the same hash, and a different seed differs", () => {
  const W = make(4, true)(), pilot = createPilot();
  for (let i = 0; i < 900 && !W.result; i++) W.step({ lamb: pilot(W) });
  const again = replay(make(4), W.record);
  assert.equal(again.tick, W.tick);
  assert.equal(again.hash(), W.hash());
  const other = replay(make(5), W.record);
  assert.notEqual(other.hash(), W.hash());
});
