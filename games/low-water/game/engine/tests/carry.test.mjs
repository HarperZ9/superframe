import { test } from "node:test";
import assert from "node:assert/strict";
import { carryState, createGame } from "../game.mjs";
import { testContent } from "./helpers.mjs";

test("an act hands the next its state, without where Lamb stood, what was in progress, or its events", () => {
  const G = createGame({ content: testContent(), seed: 3 });
  G.state.flags.push("carry.kept"); G.state.vars.light_mother = 1; G.state.place = "yard"; G.state.pos = [1, 0, 2]; G.state.fired = ["ev.one"]; G.state.pendingFight = "f.x";
  const c = carryState(G.state);
  assert.ok(c.flags.includes("carry.kept")); assert.equal(c.vars.light_mother, 1);
  for (const k of ["place", "pos", "pendingFight"]) assert.equal(k in c, false, k);
  assert.deepEqual(c.fired, []);
  const N = createGame({ content: testContent(), seed: 4, state: c });
  assert.ok(N.state.flags.includes("carry.kept"), "the next act's game starts from it");
  G.state.flags.push("later"); assert.equal(c.flags.includes("later"), false, "a copy, not a reference");
});
