// The arena mode: bosses (combat/data/bosses.mjs, combat/ai/boss.mjs) and the run (combat/arena/run.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeG } from "./helpers.mjs";
import { createWorld } from "../sim/world.mjs";
import { lambDef, fighterSpec } from "../roster.mjs";
import { FLOOR } from "../data/arenas.mjs";
import { BOSSES, BOSS_SPECIALS } from "../data/bosses.mjs";
import { bossSpec, summoner } from "../arena/spawn.mjs";
import { createRun, LADDER } from "../arena/run.mjs";

test("every boss move that strikes winds up 18 frames or more and shows its tell for most of it", () => {
  for (const [id, m] of Object.entries(BOSS_SPECIALS)) {
    if (!(m.hits || []).length) continue;
    assert.ok(m.tell && m.startup >= 18 && m.tell.at[1] - m.tell.at[0] >= 0.6 * m.startup, id);
  }
});

const bossWorld = (id, seed = 1) => {
  const W = createWorld({ G: makeG(), arena: FLOOR, seed, fighters: [fighterSpec("lamb", "lamb", lambDef({}), FLOOR.spawns.lamb, { face: Math.PI / 2 }), bossSpec("boss", id, [9, 8])] });
  W.summon = summoner(W); return W;
};

test("a boss plays its phase's pattern in order, rests after each round of it, and roars into the next phase", () => {
  for (const id of Object.keys(BOSSES)) {
    const W = bossWorld(id), B = W.byId("boss"), seq = [], ev = [];
    for (let i = 0; i < 60 * 40 && !W.result; i++) { W.lamb().hp = W.lamb().hpMax; for (const e of W.step({ lamb: {} })) { ev.push(e); if (e.type === "move" && e.id === "boss" && BOSS_SPECIALS[e.move] && e.move !== "boss.roar") seq.push(e.move); } }
    const P = BOSSES[id].phases[0].pattern.map((s) => s.move);
    assert.deepEqual(seq.slice(0, P.length), P, `${id}: phase 1 in order`);
    assert.ok(ev.some((e) => e.type === "boss.rest"), `${id}: rests`);
    B.hp = B.hpMax * (BOSSES[id].phases[0].until - 0.05);
    const ev2 = []; for (let i = 0; i < 60 * 4; i++) { W.lamb().hp = W.lamb().hpMax; ev2.push(...W.step({ lamb: {} })); }
    assert.ok(ev2.some((e) => e.type === "boss.phase" && e.phase === 1), `${id}: phase 2`);
    assert.ok(ev2.some((e) => e.type === "move" && e.move === "boss.roar"), `${id}: roars`);
  }
});

test("the warden's whistle brings two hands into the fight", () => {
  const W = bossWorld("warden"), B = W.byId("boss"); B.hp = B.hpMax * 0.4;
  for (let i = 0; i < 60 * 10; i++) { W.lamb().hp = W.lamb().hpMax; W.step({ lamb: {} }); }
  assert.equal(W.fighters.filter((F) => F.id.startsWith("boss-hand")).length, 2);
});

test("the foreman's charge into a wall dazes it", () => {
  const W = bossWorld("foreman"), B = W.byId("boss"), L = W.lamb();
  L.x = 20; L.z = 10; B.x = 12; B.z = 6.5; B.face = -Math.PI / 2; // facing the quay wall (rows 0 and 1 of the floor)
  let fired = false; W.brains.boss = () => (fired ? {} : ((fired = true), { press: ["foreman.charge"] }));
  const ev = []; for (let i = 0; i < 120; i++) ev.push(...W.step({ lamb: {} }));
  assert.ok(ev.some((e) => e.type === "wallhit" && e.id === "boss"), "a wall hit");
  assert.ok(ev.some((e) => e.type === "move" && e.id === "boss" && e.move === "foreman.dazed"), "dazed");
});

test("a run's ladder is the same for a seed, holds three live opponents at most, and puts a boss every fourth round", () => {
  const a = createRun({ seed: 7 }), b = createRun({ seed: 7 });
  assert.deepEqual(a.stage(), b.stage());
  for (let r = 1; r <= 8; r++) {
    const R = createRun({ seed: 7 }); R.state.round = r; const st = R.stage();
    if (r % LADDER.bossEvery === 0) assert.ok(st.boss, `round ${r}: a boss`); else assert.ok(st.foes.length >= 1 && st.foes.length <= LADDER.maxLive, `round ${r}: ${st.foes.length}`);
  }
});

test("offers between rounds change the build, and records stay on this machine", () => {
  const R = createRun({ seed: 3, storage: memory() });
  R.state.offer = [{ id: "level:grip", kind: "level", lv: "grip" }, { id: "temper", kind: "temper" }, { id: "tool:w.pole", kind: "tool", tool: "w.pole" }];
  R.choose(2); assert.equal(R.state.tool, "w.pole");
  R.state.offer = [{ id: "level:grip", kind: "level", lv: "grip" }]; R.choose(0); assert.equal(R.state.levels.grip, 4);
  R.state.cleared = 5; const rec = R.record(); assert.equal(rec.best, 5);
});
function memory() { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v) }; }
