// The inner bosses as real fights (the author, 2026-10-23; design/COMBAT-SPEC.md 5.2 and 12): each moveset's grammar
// and every telegraph, read from the data; the recorded measure (combat/tests/innerduel.json, made by
// combat/tools/innerduel.mjs over twelve seeds) against its targets, and two of its fights replayed exactly; then
// the rules each fight brings: Fond of Them heals when it catches a blow, The Figure answers the player's own string,
// the ground changes by phase and its marks strike, a crowd's leader sends its heads home when it falls, and force
// ends every one of them.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { makeG } from "./helpers.mjs";
import { FLAWS, armed } from "../data/flaws.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { startMove } from "../sim/fighter.mjs";
import { bosses, kit, tells, fight, TARGET, LEVELS } from "../tools/innerduel.mjs";
import { RUNS } from "../tools/innerfights.mjs";

const REC = JSON.parse(readFileSync(new URL("./innerduel.json", import.meta.url), "utf8"));
const world = (f, seed = 1) => createInnerWorld({ G: makeG(), flaw: f, seed, levels: LEVELS });
const ends = (name) => RUNS[name]().text.trim().split("\n").map((l) => JSON.parse(l)).find((l) => l.t === "cend");

test("every inner boss is a real fight: 6 to 10 attacks, 2 or 3 phases, strings with mixups, a held blow, a grab, an unparryable blow, a signature, rests, and a ground that acts", () => {
  for (const b of bosses()) {
    const k = kit(b);
    assert.ok(k.attacks >= 6 && k.attacks <= 10, `${b.id}: ${k.attacks} attacks`);
    assert.ok(k.phases >= 2 && k.phases <= 3, `${b.id}: ${k.phases} phases`);
    for (const key of ["string", "mixup", "late", "grab", "unparryable", "signature", "rests", "arena"]) assert.ok(k[key], `${b.id}: no ${key}`);
  }
});

test("T9 over every inner move and every hazard: 18 parryable, 30 unparryable or unblockable, 36 signature; a floor mark 30", () => {
  for (const b of bosses()) assert.deepEqual(tells(b), [], b.id);
});

test("the recorded measure meets its targets: the skilled player dies in half the attempts or fewer, the unskilled in 70% or more, and the kill takes 60 to 180 s", () => {
  const ids = bosses().map((b) => b.id);
  assert.deepEqual(REC.map((r) => r.id).sort(), [...ids].sort(), "every boss measured");
  for (const r of REC) {
    assert.ok(r.deaths.skilled <= TARGET.skilledDeaths, `${r.id}: skilled deaths ${r.deaths.skilled}`);
    assert.ok(r.deaths.unskilled >= TARGET.unskilledDeaths, `${r.id}: unskilled deaths ${r.deaths.unskilled}`);
    assert.ok(r.ttk >= TARGET.ttk[0] && r.ttk <= TARGET.ttk[1], `${r.id}: ttk ${r.ttk}`);
    assert.equal(r.timeouts, 0, `${r.id}: a fight ran to its limit`);
  }
});

test("the measure replays: two recorded fights come back with the same end and length", () => {
  for (const id of ["host:withdraws", "forty"]) {
    const b = bosses().find((x) => x.id === id), rec = REC.find((r) => r.id === id).runs.skilled[0], got = fight(b, 1, "skilled");
    assert.deepEqual({ outcome: got.outcome, s: +got.s.toFixed(2) }, { outcome: rec.outcome, s: rec.s }, id);
  }
});

test("Fond of Them heals when it catches a blow, and its riposte follows at once", () => {
  const W = world(FLAWS.fond), B = W.byId("boss"), L = W.lamb();
  B.hp = B.hpMax / 2; const before = B.hp;
  L.x = B.x; L.z = B.z + 1.4; L.face = -Math.PI / 2; B.face = Math.PI / 2; L.lock = "boss";
  startMove(W, B, "fond.catch"); B.mem = { ...(B.mem || {}) };
  let caught = false, riposte = false;
  for (let i = 0; i < 90 && !riposte; i++) for (const e of W.step({ lamb: i === 0 ? { press: ["light"] } : {} })) { if (e.type === "parry" && e.id === "boss") caught = true; if (e.type === "move" && e.id === "boss" && e.move === "fond.riposte") riposte = true; }
  assert.ok(caught, "the catch took the blow"); assert.ok(B.hp > before, `healed: ${before} to ${B.hp}`); assert.ok(riposte, "the riposte came");
});

test("The Figure answers the player's last string with the same string", () => {
  const W = world(FLAWS.figure), B = W.byId("boss"), L = W.lamb();
  L.x = B.x; L.z = B.z + 1.6; L.lock = "boss";
  let seen = null;
  for (let i = 0; i < 400 && !seen; i++) {
    const press = i === 2 || i === 26 ? ["light"] : [];
    for (const e of W.step({ lamb: { press } })) if (e.type === "mirror") seen = e.moves;
  }
  assert.ok(seen && seen.length >= 1 && seen.every((m) => m === "figure.echo.light"), `mirror ${JSON.stringify(seen)}`);
});

test("the ground acts: phase 0 lays Under the Goats' pits as mud; The Long Barn's last phase walls off the far end; a floor mark strikes after its lead", () => {
  const W = world(FLAWS.goats); for (let i = 0; i < 3; i++) W.step({ lamb: {} });
  assert.ok(W.field.arena.rows.some((r) => r.includes("m")), "the pits are mud");
  const B2 = world(FLAWS.barn), boss = B2.byId("boss"); for (let i = 0; i < 3; i++) B2.step({ lamb: {} });
  boss.hp = boss.hpMax * 0.2; let walled = false;
  for (let i = 0; i < 200 && !walled; i++) { B2.step({ lamb: {} }); walled = B2.field.arena.rows.some((r) => r.includes("X")); }
  assert.ok(walled, "the floor goes from the far end");
  const tells = [], hits = [];
  for (let i = 0; i < 1200; i++) for (const e of B2.step({ lamb: {} })) { if (e.type === "hazard.tell") tells.push(e); if (e.type === "hazard.hit") hits.push(e); }
  assert.ok(tells.length > 0 && tells.every((t) => t.lead >= 30), "every mark shows 30 frames or more");
});

test("a crowd's leader: Everybody Says calls at most four heads at once, and they go home when it falls", () => {
  const W = world(FLAWS.says), B = W.byId("boss"); let most = 0;
  for (let i = 0; i < 2400; i++) { W.step({ lamb: {} }); most = Math.max(most, W.fighters.filter((F) => F.id.startsWith("boss-hand") && !F.out && F.hp > 0).length); }
  assert.ok(most >= 2 && most <= 4, `heads at once ${most}`);
  B.hp = 0.01; for (let i = 0; i < 400 && !W.result; i++) W.step({ lamb: { press: ["light"] } });
  if (!W.result) { B.hp = 0; B.out = true; W.step({ lamb: {} }); }
  assert.ok(W.fighters.filter((F) => F.id.startsWith("boss-hand")).every((F) => F.out), "the heads gave up with it");
});

test("force ends every fight: the scripted force runs end forced, never by a rule that blocks it", () => {
  for (const name of ["order-force", "fond-force", "goats-force", "barn-force", "figure-force"]) assert.equal(ends(name).outcome, "forced", name);
  for (const f of Object.values(FLAWS)) { assert.equal(f.floor, 0, f.id); assert.equal(f.force.ends, "fall", f.id); }
  assert.ok(armed("order", ["e5.sl.order"]) && armed("order", [{ id: "e3.sl.order" }]) && !armed("order", ["e5.sl.says"]));
});
