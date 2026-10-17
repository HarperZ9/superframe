// The world shapes the fight (design/COMBAT-WORLD.md): ledges, falls, nets, the beam, the kiting
// clock and its answers, the break-off rule, spawns off ledge lips. Engineering tests, not proof.
import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { makeG, makeWorld, run, HERE } from "./helpers.mjs";
import { terrainAt, stepDrop, ledgeClear } from "../sim/terrain.mjs";
import { createField } from "../sim/field.mjs";
import { snapClear } from "../sim/plate.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { WORLD } from "../data/world.mjs";

const CONTENT = join(HERE, "..", "..", "..", "..", "content");

// Two levels: a quay top (h 0) on the west, the floor 2.5 m down on the east; a net on the top.
function twoLevels({ water = null, hazards = [] } = {}) {
  const w = 40, h = 16, cells = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) cells.push({ surface: "stone", h: c < 20 ? 0 : -2.5 });
  return { name: "two", place: "floor", cell: 0.5, origin: [0, 0], grid: { w, h, cells }, water, lights: [], exits: [], spawns: { lamb: [5, 4], foes: [[8, 4]] }, terrain: { hazards } };
}

test("terrain: a 2.5 m step is a ledge one way and a climb the other; stairs are not", () => {
  const A = twoLevels();
  assert.equal(stepDrop(A, 9.9, 4, 10.1, 4), 2.5);
  assert.equal(stepDrop(A, 10.1, 4, 9.9, 4), -2.5);
  assert.equal(stepDrop(A, 3, 4, 3.6, 4), 0);
  assert.ok(terrainAt(A, 9.8, 4).ledge && !terrainAt(A, 10.2, 4).ledge, "the lip is on the top side");
  assert.ok(!ledgeClear(A, 8, 4, 12, 4) && ledgeClear(A, 2, 4, 8, 4));
  assert.equal(terrainAt({ rows: ["SS"] }, 0, 0).ledge, false, "row arenas have no derived ledges");
});

test("the painted quay has ledges where the wall drops to the floor", async () => {
  const A = await loadPlateArena(CONTENT, "quay");
  const lips = A.grid.cells.filter((c, i) => c && terrainAt(A, A.origin[0] + ((i % A.grid.w) + 0.5) * A.cell, A.origin[1] + (Math.floor(i / A.grid.w) + 0.5) * A.cell).ledge).length;
  assert.ok(lips > 20, `quay lip cells: ${lips}`);
});

test("walking stops at a ledge; a knockback carries over it and the body falls and goes down", () => {
  const G = makeG(), W = makeWorld({ G, arena: twoLevels(), lambAt: [9, 4], brains: false, foes: [] }), L = W.lamb();
  run(W, 90, { lamb: { mx: 1, mz: 0 } });
  assert.ok(L.x < 10, `walked to the lip and stopped: x ${L.x.toFixed(2)}`);
  L.kx = 6;
  const ev = run(W, 30, {});
  const fall = ev.find((e) => e.type === "ledgefall" && e.id === "lamb");
  assert.ok(fall && fall.into === "ground" && L.x > 10, "carried over and fell");
  assert.ok(ev.some((e) => e.type === "move" && e.id === "lamb" && e.move === "knockdown"), "a 2.5 m drop puts Lamb down");
  assert.ok(L.hp < L.hpMax, "a drop over 1.6 m hurts");
});

test("a fall into water costs Breath and puts the body under, without harm", () => {
  const G = makeG(), A = twoLevels({ water: { a: -1.6, b: 0 } }), W = makeWorld({ G, arena: A, lambAt: [9.6, 4], brains: false, foes: [] }), L = W.lamb(), st = L.st;
  L.kx = 9;
  const ev = run(W, 30, {});
  assert.ok(ev.some((e) => e.type === "ledgefall" && e.into === "water"));
  assert.equal(L.hp, L.hpMax);
  assert.ok(L.st <= st - WORLD.fall.waterBreath + 0.01);
});

test("a net trips a body that runs across it, not one that walks", () => {
  const net = [{ id: "n", kind: "net", rect: [4, 0, 6, 8] }];
  const walk = makeWorld({ G: makeG(), arena: twoLevels({ hazards: net }), lambAt: [3, 4], brains: false, foes: [] });
  assert.ok(!run(walk, 70, { lamb: { mx: 1, mz: 0 } }).some((e) => e.type === "trip"), "walking over a net slows, does not trip");
  const runW = makeWorld({ G: makeG(), arena: twoLevels({ hazards: net }), lambAt: [3, 4], brains: false, foes: [] });
  assert.ok(run(runW, 70, { lamb: { mx: 1, mz: 0, hold: { run: true } } }).some((e) => e.type === "trip" && e.hazard === "net"));
  assert.ok(terrainAt(twoLevels({ hazards: net }), 5, 4).slow < 1);
});

test("the beam lights a spot in its arm only while Mother burns", () => {
  const G = makeG(), A = { ...twoLevels(), beams: [{ x: 0, z: 4, r: 40, k: 0.75, spread: 0.12 }] }, f = createField({ G, arena: A });
  f.seconds = 0; f.terms.mother = "dark";
  const lit = () => f.lightAt(15, 4);
  const darkL = lit(); f.terms.mother = "burning";
  assert.ok(lit() > darkL + 0.3, "the arm points east at t = 0");
  f.seconds = (Math.PI / 2) / 0.35;
  assert.ok(lit() < darkL + 0.01, "a quarter turn later the spot is dark again");
});

// A long open arena, Lamb running from a holder: the clock fills and the holder answers.
// A long open strip of stone, 60 m by 8 m.
const strip = () => ({ name: "strip", place: "floor", cell: 0.5, origin: [0, 0], grid: { w: 120, h: 16, cells: Array.from({ length: 120 * 16 }, () => ({ surface: "stone", h: 0 })) }, lights: [], exits: [], spawns: { lamb: [10, 4], foes: [[5, 4]] } });

test("a Lamb who keeps walking away from an opponent meets pursuit and a lunge or a throw; one who stands in reach does not", () => {
  const G = makeG(), W = makeWorld({ G, arena: strip(), lambAt: [10, 4], foes: [["holder", [5, 4]]] });
  const ev = run(W, 60 * 9, { lamb: { mx: 1, mz: 0 } });
  assert.ok(ev.some((e) => e.type === "move" && e.id === "foe0") && W.fighters[1].mem.pur.clock > 0, "the clock ran");
  assert.ok(ev.some((e) => e.type === "punish"), "kiting drew an answer");
  const G2 = makeG(), W2 = makeWorld({ G: G2, lambAt: [7, 8], foes: [["holder", [9, 8]]] });
  const ev2 = run(W2, 60 * 9, (W) => ({ lamb: { press: W.tick % 40 === 0 ? ["light"] : [], hold: { block: W.tick % 40 > 10 } } }));
  assert.ok(!ev2.some((e) => e.type === "punish"), "standing in the fight drew none");
});

test("running out the clock after one blow is not a yield", () => {
  const G = makeG(), W = makeWorld({ G, lambAt: [4, 8], foes: [["holder", [9, 8]]] });
  W.limitFrames = 60 * 6; W.struck.push("foe0"); W.fighters[1].hp -= 3;
  run(W, 60 * 7, (W) => { const L = W.lamb(), F = W.fighters[1], d = Math.hypot(L.x - F.x, L.z - F.z) || 1; return { lamb: { mx: (L.x - F.x) / d, mz: (L.z - F.z) / d, hold: { run: true } } }; });
  assert.ok(W.result && W.result.reason === "time" && W.result.outcome === "fled", JSON.stringify(W.result));
});

test("a spawn on a ledge lip moves to flat ground", () => {
  const A = twoLevels(), p = snapClear(A, [9.8, 4]);
  assert.ok(!terrainAt(A, p[0], p[1]).ledge, `moved to ${p}`);
});
