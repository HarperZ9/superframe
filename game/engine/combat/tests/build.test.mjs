// Character building on one sheet (SYSTEMS-FULL section 19): pillars, soft caps, the 21 tools,
// clothing and load, temper and fittings, Composure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { lambDef, buildBonus, loadOf, lambTool } from "../roster.mjs";
import { soft, TOOLS21 } from "../data/build.mjs";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { makeWorld, run, press, ARENA_LWD } from "./helpers.mjs";

test("the 21 tools: each has a class, a requirement, two scaling voices at most, fittings and a special", () => {
  const ids = Object.keys(TOOLS21).filter((id) => id !== "w.hands");
  assert.equal(ids.length, 17, "17 held tools (the other four of the 21 are thrown or spent: lantern, rope, salt, the Glass)");
  for (const id of ids) { const T = TOOLS21[id]; assert.ok(T.cls && T.needs && T.art && T.fittings.length, id); assert.ok(Object.keys(T.scale).length <= 2, id); }
});

test("soft cap: above 6, a point counts half", () => {
  assert.equal(soft(6), 6); assert.equal(soft(8), 7); assert.equal(soft(10), 8);
});

test("voices scale their tools: PRIDE the case, GRIP the hammer, THE DARK the knife", () => {
  const base = { coat: 6, nose: 4, grip: 3, pride: 3, dark: 3 };
  assert.ok(buildBonus({ ...base, pride: 8 }, "w.case").dmg > buildBonus(base, "w.case").dmg + 0.4);
  assert.ok(buildBonus({ ...base, grip: 8 }, "w.hammer").dmg > buildBonus(base, "w.hammer").dmg + 0.4);
  assert.ok(buildBonus({ ...base, dark: 8 }, "w.knife").dmg > buildBonus(base, "w.knife").dmg + 0.4);
  assert.equal(buildBonus({ coat: 2 }, "w.hammer").met, false, "the hammer needs COAT 5");
});

test("the pillars: COAT endures, NOSE evades, PEN reads, HAT ends", () => {
  const plain = lambDef({}), coat = lambDef({ coat: 6 }), nose = lambDef({ dark: 8, salt: 8 }), pen = lambDef({ undertow: 8, carbon: 8, sum: 8 }), hat = lambDef({ hat: 6, condolence: 8, formletter: 8, hearsay: 8 });
  assert.ok(coat.hp > plain.hp + 6 && coat.loadInfo.limit > plain.loadInfo.limit);
  assert.ok(nose.bonus.evade > plain.bonus.evade);
  assert.ok(pen.bonus.read > plain.bonus.read && pen.bonus.breath < plain.bonus.breath && pen.bonus.weak > plain.bonus.weak);
  assert.ok(hat.composureMax > plain.composureMax && hat.bonus.end > plain.bonus.end);
});

test("clothing: protection adds Standing and softens blows; a soaked greatcoat turns the load heavy", () => {
  const dry = loadOf({ coat: 2, wet: 0 }, lambTool("w.case"), ["c.shelf_coat"]), wet = loadOf({ coat: 2, wet: 1 }, lambTool("w.case"), ["c.shelf_coat"]);
  assert.ok(wet.weight > dry.weight && ["heavy", "over"].includes(wet.band));
  assert.equal(loadOf({ coat: 2, wet: 1 }, lambTool("w.case"), ["c.oilskin"]).band, "medium", "an oilskin does not soak");
  assert.ok(lambDef({}, "w.case", {}, [], { gear: ["c.lamplighter_coat"] }).hp > lambDef({}, "w.case", {}, [], { gear: [] }).hp);
});

test("a fitting changes the moves: a weighted head makes the stick a half-heavy", () => {
  const plain = lambTool("w.stick"), weighted = lambTool("w.stick", "weighted_head");
  assert.ok(weighted.light[0] > plain.light[0] && weighted.speed > plain.speed);
  assert.equal(lambTool("w.stick", "hooked_tip").fitting, undefined, "not on the stick's list");
});

test("the bench: temper costs salvage and minutes and adds damage; a fitting is one per tool", () => {
  const items = "@item s.tin\nname: Tin\nstack: yes\n\n@item s.cork\nname: Cork\nstack: yes\n";
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD + items }], seed: 3 }), C = installCombat(G);
  assert.equal(C.upgradeCost("w.case").affordable, false);
  G.inv.give("s.tin", 1);
  const before = C.preview().light, clock = G.env.clock();
  assert.ok(C.upgrade("w.case"));
  assert.ok(G.env.clock() > clock && C.preview().light > before && C.preview().temper === 1);
  assert.ok(C.fit("w.case", "copper_wrap")); assert.equal(C.preview().fitting, "copper_wrap");
  assert.equal(C.fit("w.case", "oiled_edge"), false, "not on the case's list");
});

test("Composure: blows and catches fill it, a special spends it", () => {
  const W = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]] }), L = W.lamb();
  assert.ok(run(W, 1, press("art")).some((e) => e.type === "nocomposure"));
  run(W, 1, press("light")); run(W, 60);
  assert.ok(L.composure > 0);
  L.composure = 5;
  assert.ok(run(W, 1, press("art")).some((e) => e.type === "move" && e.move === "lamb:art"));
  assert.equal(L.composure, 2);
});

test("running is faster, costs Breath, and a light press while running is the running strike", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb(), st = L.st, walk = makeWorld({ brains: false, foes: [] });
  run(W, 40, { lamb: { mx: 1, mz: 0, hold: { run: true } } }); run(walk, 40, { lamb: { mx: 1, mz: 0 } });
  assert.ok(L.x - walk.lamb().x > 1 && L.st < st);
  assert.ok(run(W, 1, { lamb: { mx: 1, mz: 0, press: ["light"], hold: { run: true } } }).some((e) => e.move === "lamb:run"));
});

test("preview shows what a rank changes, for a level-up screen", () => {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }], seed: 3 }), C = installCombat(G);
  const now = C.preview(), more = C.preview({ pride: 7 });
  assert.ok(more.light > now.light && now.needs && now.scale.pride);
});
