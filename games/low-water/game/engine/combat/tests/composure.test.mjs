// Composure from words and held ground (director's ask, PROGRESS step 101; SYSTEMS-FULL 19.2): a blow
// blocked, caught or sidestepped while Lamb has not struck fills it, and so does a HAT voice's bark; a
// talk exit costs 2, or 1 at HAT 4 or more. Events are put in through W.barks, the hook the world calls
// on each frame just before it counts them (sim/world.mjs step). Also the body-edge rule for plates.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, run, press } from "./helpers.mjs";
import { COMPOSURE, HAT_TALK } from "../data/build.mjs";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { createGame } from "../../game.mjs";
import { installCombat } from "../encounter.mjs";
import { loadPlateArena } from "../data/plates.mjs";
import { createPilot } from "../tools/pilot.mjs";
import { HERE, ARENA_LWD } from "./helpers.mjs";
const CONTENT = join(HERE, "..", "..", "..", "..", "content");
// Plate bakes (geo-pos.f32, geo-id.u8) are reproducible and stay out of the repository. A test that reads one
// runs where the bake exists and reports as skipped elsewhere.
const BAKED = existsSync(join(CONTENT, "brine", "geo-pos.f32")) ? false : "plate bake not present; bake the plates to run this";
const fights = () => [{ file: "arena.lwd", text: ARENA_LWD }, { file: "combat.lwd", text: readFileSync(join(CONTENT, "act1", "combat.lwd"), "utf8") }, { file: "encounters1.lwd", text: readFileSync(join(CONTENT, "act1", "encounters1.lwd"), "utf8") }];

const plain = (lamb = {}) => { const W = makeWorld({ brains: false, foes: [["holder", [6.5, 5.5]]], lamb }), L = W.lamb(); L.composure = 0; return { W, L }; };
const once = (W, ev) => { let done = false; W.barks = (W2) => { if (!done) { done = true; for (const e of ev) W2.emit(e); } }; run(W, 1); W.barks = null; };

test("a block, a sidestep and a catch each fill Composure while Lamb holds ground", () => {
  for (const [type, amt] of [["block", COMPOSURE.block], ["evade", COMPOSURE.evade], ["parry", COMPOSURE.catch]]) {
    const { W, L } = plain();
    once(W, [{ type, id: L.id }]);
    assert.ok(Math.abs(L.composure - amt) < 1e-9, `${type}: ${L.composure} against ${amt}`);
  }
});

test("held ground pays only when Lamb has not struck in the last second", () => {
  const { W, L } = plain();
  L.struckAt = W.tick;   // Lamb just landed a blow
  once(W, [{ type: "block", id: L.id }]);
  assert.equal(L.composure, 0, "a block straight after striking is trading blows, not holding ground");
  run(W, 61);
  once(W, [{ type: "block", id: L.id }]);
  assert.ok(L.composure > 0, "a second later it counts");
});

test("a HAT voice's bark fills Composure; another voice's does not", () => {
  const { W, L } = plain();
  once(W, [{ type: "bark", voice: "condolence" }]);
  assert.ok(Math.abs(L.composure - COMPOSURE.words) < 1e-9);
  const b = plain();
  once(b.W, [{ type: "bark", voice: "undertow" }]);
  assert.equal(b.L.composure, 0);
});

test("Composure never fills past its maximum", () => {
  const { W, L } = plain();
  once(W, Array.from({ length: 200 }, () => ({ type: "bark", voice: "hearsay" })));
  assert.equal(L.composure, L.composureMax);
});

test(`a talk exit costs ${COMPOSURE.talk}, and ${COMPOSURE.talkHat} at HAT ${HAT_TALK} or more`, () => {
  for (const [hat, cost] of [[0, COMPOSURE.talk], [HAT_TALK - 1, COMPOSURE.talk], [HAT_TALK, COMPOSURE.talkHat], [8, COMPOSURE.talkHat]]) {
    const { W, L } = plain({ hat });
    assert.equal(((W.defs[L.id].levels || {}).hat ?? 0), hat, "the level reaches the fighter");
    W.talk = { label: "Put it down" }; L.composure = 3;
    run(W, 1, press("talk"));
    assert.ok(W.talkTaken, `HAT ${hat}: the exit is taken`);
    // a free first exit (the HAT 8 break) costs nothing; otherwise the cost above
    const free = !!(W.defs[L.id].breaks || {}).hat8;
    assert.ok(Math.abs(L.composure - (free ? 3 : 3 - cost)) < 1e-9, `HAT ${hat}: ${L.composure} left`);
  }
});

test("without the Composure to pay, the talk exit is refused", () => {
  const { W, L } = plain();
  W.talk = { label: "Put it down" }; L.composure = COMPOSURE.talk - 0.5;
  const ev = run(W, 1, press("talk"));
  assert.ok(ev.some((e) => e.type === "nocomposure" && e.action === "talk"));
  assert.ok(!W.talkTaken);
});

// Bodies on a painted plate keep their edge out of the furniture (author 2026-10-17: "Characters
// clipping through objects"). Before the edge rule a brawl in the Brine put a rim point 0.12 m out from
// a body inside solid ground on about one frame in five.
for (const [plate, area, enc] of [["brine", "brine", "e.brawl"], ["weigh", "weigh", "e.afterdark"]]) {
  test(`${enc} on the ${plate} plate: no body's edge enters solid ground, and the fight still ends`, { timeout: 120000, skip: BAKED }, async () => {
    const A = await loadPlateArena(CONTENT, plate);
    const G = createGame({ sources: fights(), seed: 5 }), C = installCombat(G);
    G.state.place = { brine: "brine", weigh: "weigh_in" }[plate]; C.usePlate(area, A);
    const W = C.start(enc), pilot = createPilot({ style: "fighter" });
    let rim = 0;
    for (let i = 0; i < 60 * 125 && !W.result; i++) {
      C.step(pilot(W));
      for (const F of W.fighters) if (!F.out) for (let a = 0; a < 8; a++) if (W.field.solid(F.x + Math.cos((a * Math.PI) / 4) * 0.12, F.z + Math.sin((a * Math.PI) / 4) * 0.12)) { rim++; break; }
    }
    assert.ok(W.result, "the fight ended");
    assert.equal(rim, 0, "fighter-frames with an edge in solid ground");
  });
}
