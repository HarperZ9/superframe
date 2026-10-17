import { test } from "node:test";
import assert from "node:assert/strict";
import { game } from "./helpers.mjs";
import { createSaves, memoryStorage } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";

test("a gate pays one page on its first resolution, by any of its routes, and never twice", () => {
  const G = game(), paid = []; G.on("gate", (e) => paid.push(e));
  const xp0 = G.state.sheet.xp;
  G.setFlag("t.y.wall_talked", true);
  assert.deepEqual(paid.map((e) => [e.id, e.pages]), [["g.t.wall", 1]]);
  assert.equal(G.state.sheet.xp, xp0 + 1, "through the sheet's own levelling");
  G.setFlag("done.o.wall.climb", true);
  assert.equal(paid.length, 1, "the other route resolves the same gate: no second page");
  assert.ok(G.gates.paid("g.t.wall"));
  assert.ok(G.memory.history().some((l) => l.kind === "page" && /Test the yard wall/.test(l.text)), "shown in the history");
});

test("a gate can pay more than one page; a verb route pays like any other", () => {
  const G = game(); G.setPlace("t.yard"); G.inv.give("knife");
  const xp0 = G.state.sheet.xp; G.verbs.act("o.crate", "pry");
  assert.equal(G.state.sheet.xp, xp0 + 2);
});

test("a save from before a gate existed pays it once on load; a paid gate does not pay again", async () => {
  const G = game(), store = memoryStorage(), saves = createSaves(G, store, { newSheet });
  G.setFlag("t.y.wall_talked", true); delete G.state.gates; G.state.sheet.xp = 0; saves.save("1");
  const H = game(); await createSaves(H, store, { newSheet }).load("1");
  assert.equal(H.state.sheet.xp, 1); assert.ok(H.gates.paid("g.t.wall"));
  saves.save("2"); const K = game(); await createSaves(K, store, { newSheet }).load("1"); assert.equal(K.state.sheet.xp, 1);
});
