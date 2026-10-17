import { test } from "node:test";
import assert from "node:assert/strict";
import { game } from "./helpers.mjs";
import { createSaves, memoryStorage, migrate, SAVE_VERSION } from "../save/save.mjs";
import { newSheet } from "../rules/sheet.mjs";
import { stageFor, fightBounds } from "../world/stage.mjs";

test("gear: a requirement gates wielding; upgrade stages take materials and add modifiers in order", () => {
  const G = game(); G.inv.give("t.hook");
  assert.match(G.inv.equip("t.hook"), /^Needs skill.knots >= 3/, "hands 1: knots 1");
  G.state.sheet.attrs.hands = 3; assert.equal(G.inv.equip("t.hook"), null);
  const base = G.sheet.skill("knots");
  assert.match(G.inv.upgradeWhy("t.hook"), /Needs 1 Nails/);
  G.inv.give("nails", 2); G.inv.give("timber");
  assert.equal(G.inv.upgrade("t.hook"), null); assert.equal(G.inv.level("t.hook"), 1);
  assert.equal(G.sheet.skill("knots"), base + 1, "stage 1 adds to the sum");
  assert.equal(G.inv.upgrade("t.hook"), null); assert.equal(G.inv.upgradeWhy("t.hook"), "No further upgrade");
  const g = G.inv.gear("hand");
  assert.deepEqual([g.id, g.level, g.mods.map((m) => m.target).sort()], ["t.hook", 2, ["skill.knots", "skill.knots", "weapon.reach"]]);
  assert.equal(G.sheet.mods("weapon.reach")[0].amount, 1, "combat can read weapon.* targets through the sheet");
});

test("save v4: gear levels round-trip; a v3 save gains them on load", async () => {
  assert.equal(SAVE_VERSION, 4);
  const G = game(), store = memoryStorage(), saves = createSaves(G, store, { newSheet });
  G.state.sheet.attrs.hands = 3; G.inv.give("t.hook"); G.inv.give("nails"); G.inv.upgrade("t.hook"); saves.save("1");
  const H = game(); await createSaves(H, store, { newSheet }).load("1");
  assert.equal(H.inv.level("t.hook"), 1);
  const v3 = { format: "low-water.save", version: 3, state: { version: 3, flags: [], vars: {}, sheet: { attrs: {} }, inv: { items: { coat: 1 }, equipped: {} } }, env: { clock: 1380 } };
  const { save, upgraded } = migrate(v3);
  assert.deepEqual(upgraded, [4]); assert.deepEqual(save.state.inv.upgrades, {}); assert.equal(save.state.sheet.level, 1);
});

test("the fight's stage: an area's arena line places the arena; else it is laid on Lamb", () => {
  const G = game(); G.world.enter("t.quay");
  const free = stageFor(G, "quay", [10, 6]);
  assert.equal(free.placed, false);
  assert.deepEqual(free.toWorld([5, 3]).map((v) => +v.toFixed(6)), [-1.2, 0, -2.6], "the middle on Lamb's position");
  G.content.map.areas["t.quay"].arenas = [{ id: "quay", x: 2, y: 0, z: 1, yaw: 90 }];
  const placed = stageFor(G, "quay", [10, 6]);
  assert.equal(placed.placed, true);
  assert.deepEqual(placed.toWorld([1, 0]).map((v) => +v.toFixed(6)), [2, 0, 0], "turned 90 degrees about the vertical");
  const b = fightBounds((p) => [p[0] * 10, -p[1] * 10 + p[2] * 10], placed, [{ x: 0, z: 0 }, { x: 4, z: 2 }]);
  assert.ok(b[2] > b[0] && b[3] > b[1]);
  G.content.map.areas["t.quay"].arenas = [];
});
