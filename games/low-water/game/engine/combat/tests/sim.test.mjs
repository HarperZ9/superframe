// The simulation's rules one at a time, against a still opponent (no brain) placed by hand.
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, makeG, run, press } from "./helpers.mjs";

// Lamb at (6.5, 3.5) on dry slabs facing south; a holder 2 m south, facing Lamb.
const duel = (o = {}) => makeWorld({ brains: false, foes: [["holder", [6.5, 5.5], o.foe || {}]], ...o });
const foe = (W) => W.byId("foe0");
const startFoe = (W, key) => W.step({ foe0: { press: [key.includes(".") ? key : `foe0:${key}`] } });
const until = (W, type, n = 60, inp = {}) => { for (let i = 0; i < n; i++) { const ev = W.step(inp); const e = ev.find((x) => x.type === type); if (e) return e; } return null; };

test("a light strike lands on its active frames, costs Breath, and freezes both bodies", () => {
  const W = duel(), L = W.lamb(), st = L.st;
  run(W, 1, press("light"));
  const hit = until(W, "hit");
  assert.ok(hit && hit.by === "lamb", "the strike landed");
  assert.ok(L.st < st);
  assert.ok(foe(W).hp < foe(W).hpMax);
  assert.ok(L.hitstop > 0 && foe(W).hitstop > 0, "hit-stop on both");
});

test("a roll's window lets a swing pass, and the swing lands without it", () => {
  // the chain lands on frame 30; the roll's window is frames 6 to 26 of the roll
  const W = duel(); startFoe(W, "holder.chain");
  run(W, 18);
  const ev = run(W, 1, press("roll", { mx: 1, mz: 0 })).concat(run(W, 40));
  assert.ok(ev.some((e) => e.type === "evade" && e.id === "lamb"), JSON.stringify(ev.filter((e) => e.type !== "lock")));
  const W2 = duel(); startFoe(W2, "holder.chain");
  assert.ok(run(W2, 60).some((e) => e.type === "hit" && e.id === "lamb"));
});

test("a catch in time turns the blow, opens the opponent, and a light press becomes a riposte", () => {
  // the case's catch is live on frames 5 to 15; the chain lands on frame 30
  const W = duel(); startFoe(W, "holder.chain");
  run(W, 20);
  const ev = run(W, 1, press("catch")).concat(run(W, 14));
  assert.ok(ev.some((e) => e.type === "parry" && e.id === "lamb"), "caught");
  assert.equal(foe(W).act.id, "parried");
  const ev2 = run(W, 1, press("light")).concat(run(W, 30));
  assert.ok(ev2.some((e) => e.type === "move" && e.move === "riposte"));
  assert.ok(ev2.some((e) => e.type === "hit" && e.move === "riposte"));
});

test("the drag cannot be caught", () => {
  const W = duel(); startFoe(W, "holder.drag");
  run(W, 41);
  const ev = run(W, 1, press("catch")).concat(run(W, 12));
  assert.ok(!ev.some((e) => e.type === "parry"));
  assert.ok(ev.some((e) => e.type === "hit" && e.id === "lamb" && e.move === "holder.drag"));
});

test("a raised guard pays Breath per blow; a heavy breaks a guard that is not a shield", () => {
  const hold = { lamb: { hold: { block: true } } };
  const W = duel({ tool: "w.stick" }), L = W.lamb();
  run(W, 6, hold); startFoe(W, "light_1");
  const st = L.st, ev = run(W, 30, hold);
  assert.ok(ev.some((e) => e.type === "block"), "blocked");
  assert.ok(L.st < st);
  const W2 = duel({ tool: "w.stick" }); run(W2, 6, hold); startFoe(W2, "heavy");
  assert.ok(run(W2, 50, hold).some((e) => e.type === "guardbreak"));
  const W3 = duel({ tool: "w.case" }); run(W3, 6, hold); startFoe(W3, "heavy");
  const ev3 = run(W3, 50, hold);
  assert.ok(ev3.some((e) => e.type === "block") && !ev3.some((e) => e.type === "guardbreak"), "the case holds a heavy");
});

test("an action is refused without Breath, and a press waits in the buffer for 10 frames", () => {
  const W = duel(), L = W.lamb(); L.st = 0.5; L.stWait = 500;
  assert.ok(run(W, 1, press("light")).some((e) => e.type === "breathless"));
  const rollAfter = (frame) => {
    const W2 = duel(); run(W2, 1, press("light"));
    const m = W2.moves[W2.lamb().act.id];
    while (W2.lamb().act && W2.lamb().act.f < frame(m)) W2.step();
    run(W2, 1, press("roll", { mx: -1, mz: 0 }));
    return run(W2, 40).some((e) => e.type === "move" && e.id === "lamb" && e.move === "lamb:roll");
  };
  assert.ok(rollAfter((m) => m.cancel.roll[0] - 6), "pressed 6 frames before the window: it comes out");
  assert.ok(!rollAfter(() => 3), "pressed during the startup: it is dropped, nothing cancels the committed part");
});

test("holding heavy charges it into the charged strike, which knocks down", () => {
  const W = duel();
  run(W, 1, { lamb: { press: ["heavy"], hold: { heavy: true } } });
  const ev = run(W, 40, { lamb: { hold: { heavy: true } } }).concat(run(W, 60));
  assert.ok(ev.some((e) => e.type === "move" && e.move === "lamb:heavy_charged"));
  assert.ok(ev.some((e) => e.type === "knockdown" && e.id === "foe0"));
});

test("a foe at its yield line gives in; Lamb at Standing 0 is down and the fight says so", () => {
  const W = duel({ foe: { def: { yields: 11.5 } } });
  run(W, 1, press("light")); run(W, 160);
  assert.ok(foe(W).yielded);
  assert.equal(W.result.outcome, "yield");
  const W2 = duel(); W2.lamb().hp = 1; startFoe(W2, "holder.chain");
  run(W2, 200);
  assert.equal(W2.result.outcome, "down");
});

test("a shove into knee-deep water puts the target under for a moment", () => {
  // 23:50 on night 1: the gully (x 10 to 11 on row 5) is at the knee
  const W = makeWorld({ G: makeG({ clock: "23:50" }), brains: false, lambAt: [8.2, 5.5], foes: [["holder", [9.3, 5.5]]] });
  W.lamb().face = 0;
  const ev = run(W, 1, press("shove")).concat(run(W, 40));
  assert.ok(ev.some((e) => e.type === "ducked" && e.id === "foe0"), JSON.stringify(ev.filter((e) => e.type === "hit")));
});

test("under a lock a roll keeps the eyes on the target and goes where the stick says", () => {
  const W = duel(), L = W.lamb();
  run(W, 1, { lamb: { press: ["lock"] } });
  const face = L.face;
  run(W, 1, press("roll", { mx: 1, mz: 0 }));
  assert.ok(Math.abs(L.face - face) < 0.2, "still facing the holder");
  const x0 = L.x; run(W, 10);
  assert.ok(L.x - x0 > 0.8, "moved east along the stick");
});
