// Era 5's inner fights (combat/data/flaws-e5.mjs), the Descent (combat/arena/descent.mjs) and the Adversary at its
// era 5 hinge: each mechanic, the wave 1 telegraph rule on every new move, and the scripted runs' traces
// (combat/tools/innerfights.mjs), which must come back byte for byte (the C++ port's golden files).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeG } from "./helpers.mjs";
import { FLAWS, HOST, armed } from "../data/flaws.mjs";
import { ORDER, SAYS } from "../data/flaws-e5.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { createDescent, ringsOf, createSnowRing } from "../arena/descent.mjs";
import { RUNS, LEVELS } from "../tools/innerfights.mjs";
import { startMove } from "../sim/fighter.mjs";
import { REEL } from "../data/innermoves.mjs";

const world = (f, seed = 1) => createInnerWorld({ G: makeG(), flaw: f, seed, levels: LEVELS });
// the optional layers open once the fight is joined (the boss in its second phase): drive it there, the player kept up
const open = (W) => { const B = W.byId("boss"); B.hp = B.hpMax * 0.45; for (let i = 0; i < 600 && !W.inner.open; i++) { W.lamb().hp = W.lamb().hpMax; W.step({ lamb: {} }); } assert.ok(W.inner.open, "the layers open"); return W; };
const live = (W) => W.fighters.filter((F) => F.id.startsWith("boss-hand") && !F.out).length;

test("T9 (wave 1) on every inner move: 18 frames from tell to first active frame, 30 unparryable, and F2's 60% tell", () => {
  // every flaw's and the Host's moves (friday.lean led by 26 until 2026-10-23; it stays unparryable and now leads by 30)
  for (const f of [...Object.values(FLAWS), HOST]) for (const [id, m] of Object.entries(f.specials || {})) {
    if (!m.tell) continue;
    const lead = m.startup - m.tell.at[0];
    assert.ok(lead >= (m.parryable === false ? 30 : 18), `${id}: lead ${lead}`);
    if ((m.hits || []).length) assert.ok(m.tell.at[1] - m.tell.at[0] >= 0.6 * m.startup, `${id}: tell too short`);
  }
});

test("Everybody Says, endured: standing at the stone quiets it; stepping off resets the clock; a blow resets it", () => {
  const W = open(world(SAYS)), L = W.lamb(), [ax, az] = W.field.arena.anchors.anchor[0];
  L.x = ax; L.z = az; for (let i = 0; i < 60; i++) { L.hp = L.hpMax; W.step({ lamb: { hold: { block: true } } }); }
  assert.ok(W.inner.standT >= 50, `stood ${W.inner.standT}`);
  L.x = ax - 4; W.step({ lamb: {} }); assert.equal(W.inner.standT, 0, "off the stone");
  const r = RUNS["says-endure"](); assert.deepEqual(r.ends, ["endured"]);
});

test("Order, yielded: the baton dropped, then three of the wall's drags outlasted, ends laid", () => {
  const r = RUNS["order-yield"](), lines = r.text.trim().split("\n").map((l) => JSON.parse(l));
  assert.deepEqual(r.ends, ["laid"]); assert.equal(lines.find((l) => l.t === "cend").reason, "outlast");
  assert.ok(!lines.some((l) => l.t === "cev" && l.n === "advance"), "no blow, so the wall never moved");
});

test("the Descent: four gates, one per great trait, weakest first; a gate is armed by a trait fed, cut back, lost to or a lesser lie heard, else snow; it fights as its most-fed trait in that trait's last phase; standing carries", () => {
  const L = { ...LEVELS };
  assert.deepEqual(ringsOf({ order: "force", prudence: "force", forty: "yield" }, [{ id: "q.sl.check" }], L).map((r) => `${r.gate}:${r.flaw}${r.empty ? ":snow" : ""}`),
    ["hat:check", "nose:goats:snow", "pen:prudence", "coat:only:snow"]);
  assert.deepEqual(ringsOf({ says: "endure" }, [], L).map((r) => r.empty), [true, true, true, true], "a run that fed nothing and resolved everything walks in silence");
  assert.equal(ringsOf({}, [], { ...L, grip: 8 }).find((r) => r.gate === "coat").flaw, "friday", "APPETITE fed to 8 is the coat gate's being");
  assert.equal(ringsOf({}, [], { ...L, grip: 8 }).find((r) => r.gate === "coat").empty, false, "a trait fed to FED arms its gate with nothing fought");
  assert.equal(ringsOf({ only: "lose" }, [], L).find((r) => r.gate === "coat").flaw, "only", "a trait that took him is the gate's being");
  const S = createSnowRing({ G: makeG(), levels: LEVELS, hp: 3 }); assert.equal(S.lamb().hp, 3, "standing carried in");
  const D = createDescent({ resolved: { prudence: "force" }, levels: LEVELS }), i = D.rings.findIndex((r) => !r.empty); D.state.i = i; const W = D.world(makeG());
  assert.equal(W.inner.flawRec.phases.length, 1, "one phase: the last"); assert.equal(W.inner.flawRec.phases[0].name, FLAWS.prudence.phases.at(-1).name);
  assert.equal(W.defs.boss.form, "suspicion", "the gate's body is the great trait's"); assert.equal(W.defs.boss.name, "Suspicion");
  const r = RUNS.descent(); assert.deepEqual(r.ends, ["forced", "passed", "down", "passed"]); assert.deepEqual(r.kept, ["prudence", "order"]);
});

test("the Adversary comes at era 5's hinge, after the Descent, and the scripted run plays its three movements", () => {
  assert.equal(HOST.hinge.after, "e5_day");
  const r = RUNS.adversary(); assert.deepEqual(r.ends, ["endured", "talk", "talk"]); assert.equal(r.stage, "morning");
});

test("the scripted runs' traces come back byte for byte (combat/tests/traces-inner/manifest.json)", () => {
  const M = JSON.parse(readFileSync(new URL("./traces-inner/manifest.json", import.meta.url), "utf8"));
  for (const [name, fn] of Object.entries(RUNS)) {
    const t = fn().text, file = readFileSync(new URL(`./traces-inner/${name}.jsonl`, import.meta.url), "utf8");
    assert.equal(createHash("sha256").update(t).digest("hex"), M[name].sha256, `${name}: the run changed`);
    assert.equal(t, file, `${name}: the file on disk differs`);
  }
});

// ---- the prop (combat/arena/innerprop.mjs) and the last four bosses (combat/data/flaws-later.mjs)
const events = (name) => RUNS[name]().text.trim().split("\n").map((l) => JSON.parse(l));
const n = (lines, type) => lines.filter((l) => l.t === "cev" && l.n === type).length;

// put the boss on its ground's prop and start a move there, the player out of reach
const atProp = (f, move) => {
  const W = world(f), P = W.inner.prop, B = W.byId("boss"), L = W.lamb();
  W.step({ lamb: {} }); B.x = P.at[0]; B.z = P.at[1]; L.x = P.at[0] + 6; L.z = P.at[1]; B.act = null; startMove(W, B, move);
  const ev = []; for (let i = 0; i < 80; i++) { L.hp = L.hpMax; ev.push(...W.step({ lamb: {} })); }
  return { W, P, B, ev };
};

test("the prop: a committed blow carried onto it smashes it and the boss reels; a jab does not", () => {
  for (const f of Object.values(FLAWS)) assert.ok(world(f).inner.prop, `${f.id} has a prop on its ground`);
  const hit = atProp(FLAWS.fond, "fond.lunge");
  assert.ok(hit.ev.some((e) => e.type === "prop.break"), "the lunge smashes the prop"); assert.equal(hit.P.up, false);
  assert.ok(hit.ev.some((e) => e.type === "move" && e.id === "boss" && e.move === REEL.id), "and the boss reels");
  const jab = atProp(FLAWS.fond, "fond.jab");
  assert.ok(!jab.ev.some((e) => e.type === "prop.break"), "a jab does not"); assert.equal(jab.P.up, true);
});

test("the prop stands again at the next phase; the door stays shut until the fight is joined", () => {
  const { W, P } = atProp(FLAWS.fond, "fond.lunge"); assert.equal(P.up, false);
  assert.equal(W.field.arena.exits.length, 0, "the door is shut before the fight is joined");
  open(W); W.step({ lamb: {} });
  assert.equal(P.up, true, "the second phase stands it again"); assert.ok(W.field.arena.exits.length > 0, "joined: the door opens");
});

test("every resolution without force in the scripted runs ends after the fight is joined; force needs no join", () => {
  for (const name of ["says-endure", "order-yield", "fond-refuse", "goats-yield", "barn-endure", "figure-endure"]) {
    const L = events(name), joined = L.findIndex((l) => l.t === "cev" && l.n === "boss.phase" && l.d.phase >= 1), end = L.findIndex((l) => l.t === "cend");
    assert.ok(joined > 0 && joined < end, `${name}: joined at ${joined}, ended at ${end}`);
  }
});

