// The tool clearance search in the tool worker (runtime/toolworker.mjs searchTool, on a stand-in actor from
// the pose, locks and place sent) against the drawer's own search on the actor itself (runtime/toolclear.mjs
// toolStep run whole): the same target for poles and staffs held in tight rooms, beside other bodies, over
// blocked ground, with foot locks. A control moves a neighbour and must change some answer.
//   node characters/proto/tool_test.mjs        (exits non-zero on any difference)
import { readFile } from "node:fs/promises";
const { createCast } = await import("../runtime/actor.mjs");
const { CAST } = await import("../runtime/castmap.mjs");
const { toolStep, toolOff } = await import("../runtime/toolclear.mjs");
const { searchTool } = await import("../runtime/toolworker.mjs");
const timing = JSON.parse(await readFile(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cast = createCast({ timing, combat: null, members: CAST }), cast2 = createCast({ timing, combat: null, members: CAST });
let fails = 0; const expect = (ok, msg) => { console.log((ok ? "ok   " : "FAIL ") + msg); if (!ok) fails++; };
// a walk grid: open ground with a bench of solid cells to the figure's left
const arena = { cell: 0.25, origin: [-5, -5], grid: { w: 40, h: 40, cells: Array.from({ length: 1600 }, (_, k) => { const ci = k % 40, ri = Math.floor(k / 40), x = -5 + (ci + 0.5) * 0.25, z = -5 + (ri + 0.5) * 0.25; return x < -0.4 && x > -1.6 && Math.abs(z) < 0.8 ? null : { h: 0 }; }) } };
const blockedReal = (x, z) => { const ci = Math.floor((x + 5) / 0.25), ri = Math.floor((z + 5) / 0.25); if (ci < 0 || ri < 0 || ci >= 40 || ri >= 40) return true; return !arena.grid.cells[ri * 40 + ci]; };
function crop(pos, reach = 3.5) { const c = 0.25, ox = -5, oz = -5, c0 = Math.max(0, Math.floor((pos[0] - reach - ox) / c)), c1 = Math.min(39, Math.floor((pos[0] + reach - ox) / c)), r0 = Math.max(0, Math.floor((pos[2] - reach - oz) / c)), r1 = Math.min(39, Math.floor((pos[2] + reach - oz) / c)), cw = c1 - c0 + 1, ch = r1 - r0 + 1, bits = new Uint8Array(cw * ch); for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) bits[j * cw + i] = arena.grid.cells[(r0 + j) * 40 + c0 + i] ? 0 : 1; return { ox, oz, c, w: 40, h: 40, c0, r0, cw, ch, bits }; }
const cases = [];
for (const [who, tool] of [["warden", undefined], ["lamb", undefined], ["fewell", undefined], ["strand", undefined]])
  for (const anim of ["idle", "heavy", "walk"]) for (const [ahead, side, nearD, useBlocked] of [[0.6, 0.5, 0.7, false], [1.2, 0.3, 1.0, true], [0.4, 9, 0, false], [9, 9, 0.6, true]]) cases.push({ who, tool, anim, ahead, side, nearD, useBlocked });
let same = 0, n = 0, searched = 0, changed = 0;
for (const c of cases) {
  const A = cast.actor(c.who, c.tool ? { tool: c.tool } : {}), B = cast2.actor(c.who, c.tool ? { tool: c.tool } : {});
  for (let f = 0; f < 6; f++) A.drive({ x: 0, z: 0, face: 0.4, pose: c.anim === "heavy" ? { anim: "heavy", t: 0.1 + f * 0.08 } : { anim: c.anim, loop: true }, dt: 1 / 60 });
  const fa = 0.9, fx = Math.cos(fa), fz = Math.sin(fa), R = { ahead: c.ahead, left: c.side, right: c.side, behind: c.useBlocked ? 0.5 : null };
  const near = c.nearD ? [[A.pos[0] + c.nearD * fx, A.pos[1], A.pos[2] + c.nearD * fz], [A.pos[0] - 0.8, A.pos[1], A.pos[2] + 0.3]] : [];
  const blocked = c.useBlocked ? blockedReal : null;
  for (const start of [[0, 0, 0], [20, -15, -15]]) {
    A.adjust(null, "tool");
    const msg = { who: c.who, tool: A.tool, base: A.pose(), locks: A.locksLocal(), facing: A.facing, pos: [...A.pos], fx, fz, R: { ...R }, crop: c.useBlocked ? crop(A.pos) : null, near: near.map((p) => [...p]), st: { tb: start[0], ts: start[1], to: start[2] } };
    const stA = { tb: start[0], ts: start[1], to: start[2] };
    const env = { measure: (off) => { A.adjust(off ? toolOff(off[0], off[1], off[2]) : null, "tool"); const S = A.skeleton(); return { w: A.weapon(S), S, toWorld: A.toWorld }; }, pos: A.pos, fx, fz, R: { ...R, blocked }, blocked, near };
    toolStep(env, stA, Infinity);
    const stB = searchTool(B, structuredClone(msg));
    n++; if (stA.tb === stB.tb && stA.ts === stB.ts && (stA.to || 0) === (stB.to || 0)) same++; if (stA.tb || stA.ts || stA.to) searched++;
    const moved = structuredClone(msg); moved.near = [[A.pos[0] + 0.3 * fx, A.pos[1], A.pos[2] + 0.3 * fz]]; moved.R = { ahead: 0.3, left: 0.2, right: 0.2, behind: 0.2 };
    const stC = searchTool(B, moved); if (stC.tb !== stB.tb || stC.ts !== stB.ts || (stC.to || 0) !== (stB.to || 0)) changed++;
  }
}
expect(same === n, `${same} of ${n} answers the same in the worker as on the actor (${searched} needed a turned wrist)`);
expect(searched > n / 4, `the cases exercise the search: ${searched} of ${n} turned the wrist`);
expect(changed > 0, `control: a closer neighbour and a tighter room change ${changed} of ${n} answers`);
if (fails) { console.log(`${fails} failed`); process.exit(1); }
