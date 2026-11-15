// The inner arena's verbs and feel (combat/PROGRESS.md 29: bounds V1 to V5, F1 and F3), on the simulator.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeG } from "./helpers.mjs";
import { FLAWS, HOST } from "../data/flaws.mjs";
import { createInnerWorld } from "../arena/innerworld.mjs";
import { createHostWorld } from "../arena/hostworld.mjs";
import { createInnerRun } from "../arena/inner.mjs";
import { endureStep, LAY, NAME, MORPH } from "../arena/innerverbs.mjs";
import { forceBot } from "../tools/innerbots.mjs";
import { FEEL } from "../sim/hits.mjs";
import { startMove } from "../sim/fighter.mjs";

const LV = { grip: 5, ballast: 5, coat: 5, knees: 5, pen: 4, nose: 4 };
// the verbs' own mechanics
const world = (id, seed = 1) => createInnerWorld({ G: makeG(), flaw: FLAWS[id], seed, levels: LV });
// the optional layers open once the fight is joined (the boss in its second phase): drive it there, the player kept up
const open = (W) => { const B = W.byId("boss"); B.hp = B.hpMax * 0.45; for (let i = 0; i < 600 && !W.inner.open; i++) { W.lamb().hp = W.lamb().hpMax; W.step({ lamb: {} }); } assert.ok(W.inner.open, "the layers open"); return W; };
const kept = (W, inp) => { W.lamb().hp = W.lamb().hpMax; return W.step(inp); }; // a step with the player kept standing

test("V1: only a refuse flaw has a door; half a second steering inside it ends as fled", () => {
  for (const f of Object.values(FLAWS)) { const W = world(f.id); assert.equal(W.field.arena.exits.length, 0, `${f.id}: shut until the fight is joined`); open(W); assert.equal(W.field.arena.exits.length > 0, !!f.verbs.refuse, f.id); }
  const W = open(world("only")), L = W.lamb(), [x0, z0, x1, z1] = W.field.arena.exits[0];
  L.x = (x0 + x1) / 2; L.z = (z0 + z1) / 2;
  let n = 0; for (; n < 40 && !W.result; n++) kept(W, { lamb: { mx: 0, mz: 1 } });
  assert.equal(W.result.outcome, "fled"); assert.equal(W.result.verb, "refuse"); assert.ok(n >= 30 && n <= 31, `ended after ${n} frames`);
});

test("V2: endure ends after `rounds` rests with no blow landed, and a landed blow sets the count back to 0", () => {
  const W = world("check"), rest = { type: "boss.rest", id: "boss" }, hit = { type: "hit", by: "lamb", id: "boss" };
  W.inner.rested = 0; const seq = [rest, rest, hit, rest, rest, rest];
  const ended = seq.map((e) => endureStep(W, [e], 4));
  assert.deepEqual(ended, [false, false, false, false, false, false], "the blow after two rests starts the count again");
  assert.equal(endureStep(W, [rest], 4), true, "the fourth rest in a row ends it");
});

test("V3: guard and interact held 60 frames lay the tool down; 59 do not; a laid tool refuses every strike", () => {
  const W0 = world("prudence"); for (let i = 0; i < LAY.frames + 5; i++) W0.step({ lamb: { hold: { block: true, interact: true } } });
  assert.equal(W0.inner.laid, false, "no lay before the fight is joined");
  const W = open(world("prudence")), L = W.lamb(), hold = { lamb: { hold: { block: true, interact: true } } };
  for (let i = 0; i < LAY.frames - 1; i++) kept(W, hold);
  assert.equal(W.inner.laid, false, "59 frames");
  kept(W, hold); assert.equal(W.inner.laid, true, "60 frames"); assert.equal(L.tool, null, "the tool is down");
  for (let i = 0; i < 20; i++) W.step({ lamb: { press: ["light", "heavy"] } });
  assert.ok(!L.act || !/light|heavy/.test(L.act.id), `no strike starts (${L.act && L.act.id})`);
});

test("V4: a loss ends as down, records the loss beat, and the run goes on to the morning", () => {
  const got = [], R = createInnerRun({ flaw: "prudence", onRecord: (e) => got.push(e) });
  R.finish({ result: { outcome: "down", verb: "lose", reason: "standing" } });
  assert.equal(R.stage().kind, "morning");
  assert.equal(got[0].verb, "lose"); assert.equal(got[0].beat, FLAWS.prudence.verbs.lose.beat.text);
});

test("V5: facing it needs 90 frames standing still under its blows; a move cancels; without the press nothing ends", () => {
  const mk = () => open(createHostWorld({ G: makeG(), movement: 2, limbs: ["prudence"], seed: 1, levels: LV }));
  let W = mk(); for (let i = 0; i < 120; i++) kept(W, { lamb: {} });
  assert.equal(W.result, null, "standing still without facing it ends nothing");
  W = mk(); kept(W, { lamb: { press: ["name"] } });
  for (let i = 0; i < NAME.hold - 1; i++) kept(W, { lamb: {} });
  assert.equal(W.result, null, "89 frames"); kept(W, { lamb: {} });
  assert.equal(W.result.outcome, "talk"); assert.equal(W.inner.card, HOST.movements[2].verbs.name.card);
  W = mk(); kept(W, { lamb: { press: ["name"] } });
  for (let i = 0; i < 60; i++) kept(W, { lamb: {} }); kept(W, { lamb: { mx: 1, mz: 0 } });
  for (let i = 0; i < 60; i++) kept(W, { lamb: {} });
  assert.equal(W.result, null, "a move on frame 60 of the hold ends nothing");
});

test("V5: the Host loses a limb each time it is faced, smaller each time, and ends when every limb is gone", () => {
  const W = open(createHostWorld({ G: makeG(), movement: 1, limbs: ["prudence", "friday"], seed: 1, levels: LV }));
  const name = () => { kept(W, { lamb: { press: ["name"] } }); for (let i = 0; i < NAME.hold && !W.result; i++) kept(W, { lamb: {} }); };
  name(); assert.equal(W.inner.named.length, 1); assert.ok(W.inner.scale < 1);
  name(); assert.equal(W.result.outcome, "talk"); assert.equal(W.result.reason, "named");
});

// every contact's freeze, read right after it lands: light 0, heavy 2, at most 4 with three or more standing
function hitstops(W, frames) {
  const bad = [], bot = forceBot();
  for (let i = 0; i < frames && !W.result; i++) {
    for (const e of W.step({ lamb: bot(W) })) {
      if (e.type !== "hit") continue;
      const T = W.byId(e.id), crowd = W.fighters.filter((F) => F.team !== "lamb" && !F.out && !F.fallen).length;
      if (T.hitstop !== 0 && T.hitstop !== 2 && !(crowd >= 3 && T.hitstop <= 4)) bad.push(`${e.move} ${T.hitstop}`);
    }
  }
  return bad;
}

test("F1: every inner contact freezes as the feel checklist says (light 0, heavy 2, at most 4 in a crowd); 6 on heavy fails", () => {
  for (const id of Object.keys(FLAWS)) assert.deepEqual(hitstops(world(id, 2), 60 * 30), [], id);
  const keep = FEEL.hitstop.heavy; FEEL.hitstop.heavy = 6;
  try { assert.ok(hitstops(world("prudence", 2), 60 * 30).length > 0, "the control (heavy 6) must fail"); } finally { FEEL.hitstop.heavy = keep; }
});

// after each morph, no blow from the boss's side lands on the character for MORPH.quiet frames
function morphQuiet(W, frames, plant = null) {
  const bad = [], bot = forceBot(); let at = null;
  for (let i = 0; i < frames && !W.result; i++) {
    for (const e of W.step({ lamb: W.idle ? {} : bot(W) })) {
      if (e.type === "morph") { at = W.tick; if (plant) plant(W); }
      if (e.type === "hit" && e.id === "lamb" && at != null && W.tick - at < MORPH.quiet) bad.push(`${e.move} at +${W.tick - at}`);
    }
  }
  return { bad, morphed: at != null };
}

test("F3: a morph opens with the roar: no blow lands for 50 frames; a phase that strikes at once fails", () => {
  let morphed = 0;
  for (const id of Object.keys(FLAWS)) { const r = morphQuiet(world(id, 2), 60 * 60); assert.deepEqual(r.bad, [], id); morphed += r.morphed ? 1 : 0; }
  assert.ok(morphed >= 4, `only ${morphed} fights reached a morph: the check saw too little`);
  const W = world("forty", 2);
  const r = morphQuiet(W, 60 * 60, (W2) => { const B = W2.byId("boss"), L = W2.lamb(); L.x = B.x + Math.cos(B.face) * 1.2; L.z = B.z + Math.sin(B.face) * 1.2; B.act = null; startMove(W2, B, "forty.thrust"); W2.idle = true; });
  assert.ok(r.morphed && r.bad.length > 0, "the control (a strike at the morph) must fail");
});

test("an inner fight never ends as win, and a meant-to-lose boss never reaches 0 standing", () => {
  for (const id of Object.keys(FLAWS)) for (const seed of [1, 2]) {
    const W = world(id, seed), bot = forceBot(); let low = Infinity;
    for (let i = 0; i < 60 * 200 && !W.result; i++) { W.step({ lamb: bot(W) }); low = Math.min(low, W.byId("boss").hp); }
    assert.notEqual(W.result.outcome, "win", id);
    if (FLAWS[id].meantToLose) assert.ok(low > 0, `${id} reached ${low}`);
  }
});

test("the Accuser ends on silence after the rows the run has, even when it has fewer than three", () => {
  for (const rows of [[], [{ id: "a", text: "row a" }, { id: "b", text: "row b" }]]) {
    const W = open(createHostWorld({ G: makeG(), movement: 0, limbs: ["prudence"], rows, seed: 1, levels: LV }));
    for (let i = 0; i < 60 * 60 && !W.result; i++) kept(W, { lamb: {} });
    assert.equal(W.result && W.result.outcome, "endured", `${rows.length} rows`); assert.equal(W.result.reason, "silence");
  }
});
