// Character building on one sheet (SYSTEMS-FULL section 19): pillars, soft caps, the 21 tools,
// clothing and load, temper and fittings, Composure.
import { FLOOR } from "../data/arenas.mjs";
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

test("running is faster, costs Breath only while engaged, and a light press while running is the running strike", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb(), st = L.st, walk = makeWorld({ brains: false, foes: [] });
  run(W, 40, { lamb: { mx: 1, mz: 0, hold: { run: true } } }); run(walk, 40, { lamb: { mx: 1, mz: 0 } });
  assert.ok(L.x - walk.lamb().x > 1, "running is faster");
  assert.equal(L.st, st, "nobody near: running is free (data/world.mjs run.free)");
  const sp = FLOOR.spawns.lamb, E = makeWorld({ brains: false, foes: [["holder", [sp[0] + 4, sp[1]]]] }), EL = E.lamb(), est = EL.st;
  run(E, 40, { lamb: { mx: 1, mz: 0, hold: { run: true } } });
  assert.ok(EL.st < est, "an opponent within 10 m: running costs Breath");
  assert.ok(run(W, 1, { lamb: { mx: 1, mz: 0, press: ["light"], hold: { run: true } } }).some((e) => e.move === "lamb:run"));
});

test("preview shows what a rank changes, for a level-up screen", () => {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }], seed: 3 }), C = installCombat(G);
  const now = C.preview(), more = C.preview({ pride: 7 });
  assert.ok(more.light > now.light && now.needs && now.scale.pride);
});

test("preview gives frame counts at the body's tempo: NOSE shortens the roll and never cuts its i-frames", () => {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }], seed: 3 }), C = installCombat(G);
  const a = C.preview({ nose: 3 }).frames, b = C.preview({ nose: 8 }).frames;
  for (const k of ["light", "heavy", "step", "roll"]) assert.ok(a[k] && a[k].total > 0, `${k} has frames`);
  assert.equal(a.fps, 60);
  assert.ok(b.roll.total < a.roll.total, "the roll is shorter at NOSE 8");
  assert.ok(b.roll.iframes.frames >= a.roll.iframes.frames, "and keeps at least as many invulnerable frames");
  assert.ok(b.light.total < a.light.total, "light strings are quicker at NOSE 8");
  assert.equal(a.roll.total, a.roll.startup + a.roll.active + a.roll.recovery);
});

test("preview carries every Build page row and previews clothes, temper and fittings before they are made", () => {
  const G = createGame({ sources: [{ file: "arena.lwd", text: ARENA_LWD }], seed: 3 }), C = installCombat(G);
  const p = C.preview();
  for (const k of ["breathPerSecond", "protection", "softened"]) assert.ok(typeof p[k] === "number" && p[k] >= 0, k);
  for (const k of ["light", "heavy", "charged"]) assert.ok(p.strikes[k].poise > 0 && p.strikes[k].dmg > 0, `${k} strike`);
  assert.ok(p.strikes.charged.dmg > p.strikes.heavy.dmg, "the charged heavy hits harder");
  assert.ok(p.dodge.roll > 0 && p.dodge.step > 0, "dodge distance in metres");
  assert.ok(p.staggered.stagger > 0 && p.staggered.knockdown > p.staggered.stagger, "time staggered");
  assert.ok(C.preview({ coat: 9 }).staggered.stagger < p.staggered.stagger, "COAT shortens the stagger");
  // clothes: a heavier protective coat softens more of a blow; nothing is changed by previewing
  const apron = C.preview(null, null, { gear: ["c.apron", "c.seaboots"] });
  assert.ok(apron.protection > p.protection && apron.softened > p.softened);
  assert.deepEqual(apron.applied.gear, ["c.apron", "c.seaboots"]);
  // temper and fitting at the bench, without paying
  const t3 = C.preview(null, null, { temper: 3 }), fit = C.preview(null, null, { fitting: "copper_wrap" });
  assert.ok(t3.strikes.light.dmg > p.strikes.light.dmg && t3.applied.temper === 3);
  assert.equal(fit.applied.fitting, "copper_wrap");
  assert.equal(C.preview(null, null, { fitting: "not_a_fitting" }).applied.fitting, null);
  assert.equal(C.preview().temper, p.temper, "previewing changed nothing");
  assert.deepEqual(C.preview().applied.gear, p.applied.gear);
});
