// Feel bounds (engine PROGRESS 37, systems engineer 2026-10-22): the input buffer, the cancel windows in
// data, input to action, and movement (acceleration, stopping, turning, diagonals, sliding along a wall).
// Each test states its number; each has a control that must fail (a broken rule the same check catches).
import { test } from "node:test";
import assert from "node:assert/strict";
import { makeWorld, run, press } from "./helpers.mjs";
import { RULES } from "../data/common.mjs";
import { DT } from "../sim/moves.mjs";

const MS = 1000 / 60;
const STONE = { surface: "stone", h: 30 };
// an open yard with one wall, x 6 to 7 for its whole depth
const WALLED = {
  name: "walled", place: "floor", cell: 1, origin: [0, 0],
  rows: Array.from({ length: 12 }, () => "......LL...."),
  legend: { ".": STONE, L: { ...STONE, solid: true } },
  water: null, lights: [{ x: 4, z: 4, r: 8, k: 0.5 }], exits: [], tideEnds: false,
  spawns: { lamb: [3, 2], foes: [[10, 10]] },
};
const speed = (L) => Math.hypot(L.vx, L.vz);

test("the input buffer holds a press 100 to 150 ms (8 frames: 133 ms)", () => {
  const ms = RULES.buffer * MS;
  assert.ok(ms >= 100 && ms <= 150, `buffer ${ms.toFixed(0)} ms`);
  // played: a roll pressed in a strike's wind-up (not yet held to the window) waits RULES.buffer frames, then goes
  const life = (at) => {
    const W = makeWorld({ brains: false, foes: [] }), L = W.lamb();
    run(W, 1, press("light"));
    while (L.act.f < at) W.step();
    run(W, 1, press("roll", { mx: 0, mz: 1 }));
    let n = 0; while (L.buf.some((b) => b.a === "roll") && n < 60) { W.step(); n++; }
    return n;
  };
  // usable on its own frame and the RULES.buffer frames after it (133 ms after the press), gone on the next
  assert.equal(life(2), RULES.buffer + 1, "a wind-up press lives exactly the buffer");
  // control: a press after the wind-up is held to the window (29 frames on), not dropped at the buffer's end
  assert.ok(life(18) > RULES.buffer + 1, "a press after the wind-up is held to its window");
});

test("cancel windows are in data: every strike of Lamb's cancels into a dodge, and a dodge's recovery into a strike", () => {
  const W = makeWorld({ brains: false, foes: [] }), lamb = Object.entries(W.moves).filter(([id]) => id.startsWith("lamb:"));
  const strikes = lamb.filter(([, m]) => m.kind === "attack"), dodges = lamb.filter(([, m]) => m.kind === "dodge");
  assert.ok(strikes.length >= 4 && dodges.length >= 3, `${strikes.length} strikes, ${dodges.length} dodges`);
  for (const [id, m] of strikes) {
    const w = m.cancel.roll || m.cancel.step;
    assert.ok(w, `${id}: no cancel into a dodge`);
    // the cancel opens after the blow lands (startup and active done) and runs to the end of the move
    assert.ok(w[0] >= m.startup + m.active && w[1] >= m.total - 2, `${id}: window ${w} for startup ${m.startup}, active ${m.active}, total ${m.total}`);
  }
  for (const [id, m] of dodges) assert.ok(m.cancel.light && m.cancel.light[1] >= m.total - 2, `${id}: no recovery cancel into a strike`);
});

test("input to action: 0 frames when free, and an attack cancelled into a dodge on the window's first frame", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb();
  const t0 = W.tick + 1, e = W.step(press("light")).find((x) => x.type === "move");
  assert.equal(e && e.t, t0);
  const m = W.moves[L.act.id];
  while (L.act.f < m.cancel.roll[0]) W.step();
  const at = W.tick + 1, r = W.step(press("roll", { mx: -1, mz: 0 })).find((x) => x.type === "move" && /roll/.test(x.move));
  assert.ok(r && r.t === at, "the roll starts on the frame it was pressed in the window");
});

test("movement: 90% of walking speed in 0.3 s or less, stopped (under 10%) in 0.3 s or less", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb(), top = W.defs[L.id].speed;
  let up = 0; while (speed(L) < top * 0.9 && up < 120) { W.step({ lamb: { mx: 1, mz: 0 } }); up++; }
  let down = 0; while (speed(L) > top * 0.1 && down < 120) { W.step({ lamb: { mx: 0, mz: 0 } }); down++; }
  assert.ok(up * DT <= 0.3, `up to speed in ${(up * DT).toFixed(3)} s`);
  assert.ok(down * DT <= 0.3, `stopped in ${(down * DT).toFixed(3)} s`);
  // and not a snap: at least 3 frames to reach speed (a curve, not a step)
  assert.ok(up >= 3, `${up} frames`);
});

test("turning: a half turn in 0.3 s or less, never more than the turn rate a frame", () => {
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb(), rate = W.defs[L.id].turn * DT;
  L.face = 0; let n = 0, worst = 0;
  while (Math.abs(Math.atan2(Math.sin(L.face - Math.PI), Math.cos(L.face - Math.PI))) > 0.05 && n < 120) { const f0 = L.face; W.step({ lamb: { mx: -1, mz: 0.001 } }); worst = Math.max(worst, Math.abs(Math.atan2(Math.sin(L.face - f0), Math.cos(L.face - f0)))); n++; }
  assert.ok(n * DT <= 0.3, `half turn in ${(n * DT).toFixed(3)} s`);
  assert.ok(worst <= rate + 1e-9, `${worst} rad in a frame, limit ${rate}`);
});

test("diagonals: the same speed as the cardinals (within 1%)", () => {
  const go = (mx, mz) => { const W = makeWorld({ brains: false, foes: [] }), L = W.lamb(); run(W, 60, { lamb: { mx, mz } }); return speed(L); };
  const card = go(1, 0), diag = go(Math.SQRT1_2, Math.SQRT1_2);
  assert.ok(Math.abs(diag / card - 1) < 0.01, `diagonal ${diag.toFixed(3)} against ${card.toFixed(3)} m/s`);
  // control: an unnormalised diagonal (keys 1, 1) is held to the cardinal speed by the sim's own clamp
  assert.ok(Math.abs(go(1, 1) / card - 1) < 0.01);
});

test("walls: a walk into a wall at 45 degrees slides along it at 60% of walking speed or more, never stuck", () => {
  const W = makeWorld({ brains: false, foes: [], arena: WALLED, lambAt: [4.5, 2] }), L = W.lamb(), top = W.defs[L.id].speed;
  run(W, 60, { lamb: { mx: Math.SQRT1_2, mz: Math.SQRT1_2 } });   // at the wall by now
  const z0 = L.z, x0 = L.x, stuck = [];
  for (let i = 0; i < 60; i++) { const z = L.z; W.step({ lamb: { mx: Math.SQRT1_2, mz: Math.SQRT1_2 } }); if (L.z - z < 1e-4) stuck.push(i); }
  const along = (L.z - z0) / (60 * DT);
  assert.ok(L.x < 6 && x0 < 6, `stayed out of the wall (x ${L.x.toFixed(2)})`);
  assert.ok(along >= 0.6 * top, `slid at ${along.toFixed(2)} m/s, walking ${top}`);
  assert.equal(stuck.length, 0, `stuck on frames ${stuck.join(",")}`);
});

test("upper-body layer: a strike from a walk plays over walking legs until the momentum is spent; a guard walked", async () => {
  const { poseOf } = await import("../anim/drive.mjs");
  const W = makeWorld({ brains: false, foes: [] }), L = W.lamb();
  run(W, 40, { lamb: { mx: 1, mz: 0 } });
  run(W, 1, press("light", { mx: 1, mz: 0 }));
  const p0 = poseOf(W, L);
  assert.ok(p0.upper && /light/.test(p0.upper.anim) && p0.anim === "walk" && p0.loop, `layered at the start: ${JSON.stringify(p0)}`);
  assert.equal(p0.phase, "startup", "the strike's phase is kept for the tells");
  run(W, 14);
  assert.ok(!poseOf(W, L).upper, "the whole body strikes once the momentum is spent");
  // control: a strike from standing is never layered
  const S = makeWorld({ brains: false, foes: [] }); run(S, 1, press("light"));
  assert.ok(!poseOf(S, S.lamb()).upper);
  // a guard raised while walking: legs walk, the guard above
  const G = makeWorld({ brains: false, foes: [] }); run(G, 20, { lamb: { mx: 1, mz: 0, hold: { block: true } } });
  const pg = poseOf(G, G.lamb());
  assert.ok(pg.anim === "walk" && pg.upper && pg.upper.anim === "guard", JSON.stringify(pg));
});
