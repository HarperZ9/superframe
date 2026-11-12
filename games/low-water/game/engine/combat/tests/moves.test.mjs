// Move data: validation, phases, the per-class strikes, and the cancel rule (SYSTEMS-FULL 18.1:
// nothing cancels into anything except a dodge, and only after the committed part).
import { test } from "node:test";
import assert from "node:assert/strict";
import { defineMoves, phaseOf, canCancel, rootSpeed } from "../sim/moves.mjs";
import { TOOL_CLASSES, profileOf, buildToolMoves } from "../data/tools.mjs";
import { BODY } from "../data/body.mjs";
import { SPECIALS } from "../data/foes.mjs";
import { COMMON } from "../data/common.mjs";

test("bad move data is refused with the move named", () => {
  assert.throws(() => defineMoves({ x: { recovery: 0 } }), /move x: needs at least one frame/);
  assert.throws(() => defineMoves({ x: { recovery: 5, iframes: [3] } }), /move x: iframes/);
  assert.throws(() => defineMoves({ x: { recovery: 5, next: { light: "nope" } } }), /unknown move nope/);
});

test("phases and root motion follow the frame counts", () => {
  const M = defineMoves({ a: { startup: 3, active: 2, recovery: 4, root: [[0, 2, 5], [1, 1, 1]] } });
  assert.deepEqual([0, 2, 3, 4, 5, 8, 9].map((f) => phaseOf(M.a, f)), ["startup", "startup", "active", "active", "recovery", "recovery", "done"]);
  assert.equal(M.a.total, 9);
  assert.equal(rootSpeed(M.a, 1), 6);
  assert.equal(rootSpeed(M.a, 3), 0);
});

test("every tool class, body move, special and common move is valid together", () => {
  const table = { ...COMMON, ...BODY, ...SPECIALS };
  for (const cls of Object.keys(TOOL_CLASSES)) Object.assign(table, buildToolMoves(profileOf("x", { cls }), { prefix: `${cls}:` }));
  assert.ok(Object.keys(defineMoves(table)).length >= 55);
});

test("strikes cancel only into a step or roll after the active frames, and chain to the next link", () => {
  const M = defineMoves(buildToolMoves(profileOf("w.stick"), { prefix: "p:" }));
  for (const m of Object.values(M)) {
    for (const a of Object.keys(m.cancel)) assert.ok(["step", "roll", "light"].includes(a), `${m.id} cancels into ${a}`);
    if (m.cancel.light) assert.ok(m.next.light, `${m.id} has a light window without a chain link`);
    for (const a of ["step", "roll"]) if (m.cancel[a]) assert.ok(m.cancel[a][0] >= m.startup + m.active, `${m.id} cancels before its active frames end`);
    assert.ok(!canCancel(m, 0, "heavy"), `${m.id} cancels into heavy`);
  }
  assert.equal(M["p:light_1"].next.light, "p:light_2");
  assert.equal(M["p:light_3"].next.light, undefined, "the third link ends the string");
});

test("a tool heavier than GRIP allows swings slower and costs double Breath (18.2)", () => {
  const P = profileOf("w.hammer"), fast = buildToolMoves(P), slow = buildToolMoves(P, { slow: true });
  assert.ok(slow.light_1.startup > fast.light_1.startup);
  assert.equal(slow.light_1.stamina, fast.light_1.stamina * 2);
});

test("the three roll forms keep the reference's proportions (COMBAT-FEEL v2 1.2)", () => {
  const M = defineMoves(BODY), win = (m) => m.iframes[1] - m.iframes[0] + 1;
  assert.ok(M.roll_dash.total < M.roll.total && M.roll.total < M.roll_hop.total, "light, medium, heavy: longer each step");
  assert.ok(win(M.roll_dash) / M.roll_dash.total > 0.35, "the light dodge is mostly invulnerable");
  assert.ok(M.roll_dash.iframes[0] < M.roll.iframes[0] && M.roll.iframes[0] < M.roll_hop.iframes[0], "the window opens later as load rises");
  assert.ok(M.roll_hop.total > 1.6 * M.roll.total, "the heavy form almost doubles the commitment");
  assert.ok(rootSpeed(M.roll, 35) > 0 && M.roll.iframes[1] < 35, "the roll slides out after its window, open to a hit");
});

test("a swing's travel sits in the end of the wind-up: heavies and last links carry a sweep ending on startup, at every tempo", async () => {
  const { warp } = await import("../anim/drive.mjs");
  const { scaleMove, tempoOf, tempoMoves } = await import("../sim/tempo.mjs");
  for (const cls of Object.keys(TOOL_CLASSES)) {
    const P = profileOf("t.test", { cls }), M = defineMoves(buildToolMoves(P));
    const last = M[`light_${P.chain}`], heavy = M.heavy;
    for (const m of [last, heavy, M.heavy_charged]) assert.ok(m.sweep && m.sweep[1] === m.startup && m.sweep[0] < m.startup, `${cls} ${m.anim} has a sweep`);
    assert.ok(heavy.sweep[1] - heavy.sweep[0] >= 10 * Math.min(1, P.speed) - 1, `${cls} heavy travels over ~10 frames`);
    assert.ok(heavy.sweep[0] > heavy.charge.at, `${cls} heavy sweeps after the charge point`);
    for (const k of [0.82, 1.1]) { const raw = buildToolMoves(P), s = defineMoves({ ...raw, heavy: scaleMove(raw.heavy, k) }).heavy; assert.equal(s.sweep[1], s.startup); }
    // a clip with a sweep phase: the travel plays over the sweep frames, the active span shows contact
    const clip = { length: 2, phases: [{ name: "windup", from: 0, to: 0.8 }, { name: "sweep", from: 0.5, to: 0.8 }, { name: "active", from: 0.8, to: 0.9 }, { name: "recovery", from: 0.9, to: 2 }] };
    assert.ok(Math.abs(warp(heavy, heavy.sweep[0], clip) - 0.5) < 1e-9);
    assert.ok(Math.abs(warp(heavy, heavy.startup, clip) - 0.8) < 1e-9);
    assert.ok(warp(heavy, heavy.startup + heavy.active, clip) - 0.8 <= 0.1 + 1e-9);
  }
  // Lamb's tempo keeps the sweep on the wind-up's end
  const t = tempoOf({ nose: 10, coat: 10 }), L = tempoMoves(buildToolMoves(profileOf("w.case"), { prefix: "lamb:" }), "lamb:", t);
  for (const m of Object.values(defineMoves(L))) if (m.sweep) assert.equal(m.sweep[1], m.startup);
});
