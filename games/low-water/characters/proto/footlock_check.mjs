// Foot slide over the locomotion set, measured on the solved skeleton in the world (characters/notes/
// ANIM-BOUNDS.md, target 1). A foot is "planted" on a frame when the clip, without any runtime lock,
// holds its ankle within 1.2 cm of its standing height (the idle clip's) or below it; a planted run of 6 or more
// frames (60 Hz) is one step. Slide for a step: the horizontal path length of the final ankle (after the
// locks and leg IK) over the run, less two frames at each end (touchdown and lift-off, 1/30 s each). On a slope the vertical error of a planted ankle
// against the ground under it is reported too.
//   node proto/footlock_check.mjs [--ik off] [--gait off] [--who lamb,tomas] [--json out/footlock.json]
// --ik off: runtime locks disabled (control). --gait off: the walk and run legs from their keyed clips at
// the clips' authored speed, no gait solve (control).
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { INDEX, restOffsets } from "../rig/skeleton.mjs";
import { roster } from "./heads_roster.mjs";
import * as lamb from "../cast/lamb.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const IK = arg("--ik", "on") !== "off", GAIT = arg("--gait", "on") !== "off", WHO = arg("--who", "lamb,tomas,aaron").split(",");
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const quota = await roster("quota"), members = { lamb };
for (const w of WHO) if (w !== "lamb") members[w] = quota[w];
const DT = 1 / 60, D2R = Math.PI / 180;

function makeActor(who, opts = {}) {
  const cast = createCast({ timing, combat, members }), a = cast.actor(who, { tool: "hands", ...opts }), L = cast.library;
  if (!IK) a.state.footIK = false;
  if (!GAIT) {
    // keyed legs at the clip's authored speed: what a figure shows without the gait solve
    L.loco = (w, v, u) => { const n = v > 2.4 ? "run" : "walk", len = L.length(w, n), T = L.timing(w, n), sp = T.speedTiming ?? T.speed; return { pose: keyed(L, w, n, u * len), cycle: sp * len / 30, w: 0 }; };
  }
  return { a, L };
}
// the clip's own keys without the gait solve (sample the raw clip)
import { sample } from "../anim/pose.mjs";
function keyed(L, who, n, f) { const p = sample(L.clips[n], L.timing(who, n), f); p.root = { ...(p.root || {}), x: 0, z: 0 }; return p; }

// the standing ankle height of a body: the idle clip's first frame, solved without any lock
import { solve } from "../rig/skeleton.mjs";
const soles = {};
function soleOf(who) { if (soles[who] == null) { const { L } = makeActor(who), S = solve(members[who].P, L.pose(who, "idle", 0)); soles[who] = Math.max(S[INDEX.footL].p[1], S[INDEX.footR].p[1]); } return soles[who]; }
// one scenario: steps(a, frame) drives the actor for one 60 Hz frame; ground(x, z) the ground height
function run(who, name, frames, step, { warm = 0, ground = () => 0, opts = {} } = {}) {
  const { a } = makeActor(who, opts), P = members[who].P, rows = [];
  for (let f = 0; f < warm + frames; f++) {
    step(a, f);
    if (f < warm) continue;
    const fin = a.skeleton(), fk = a.skeleton(a.basePose(), null), row = {};   // fk: the clip alone (no locks, no ground layer)
    for (const s of ["L", "R"]) {
      const j = INDEX["foot" + s], wf = a.toWorld(fin[j].p), wk = a.toWorld(fk[j].p);
      row[s] = { fin: wf, fkY: fk[j].p[1], g: ground(wf[0], wf[2]) };
    }
    row.clip = a.state.clip; rows.push(row);
  }
  const ankle = Math.max(0.03, restOffsets(P)._ankle), steps = [];
  for (const s of ["L", "R"]) {
    let start = -1; const lo = soleOf(who);   // the ankle's height over the ground when standing (the idle clip, no locks)
    for (let i = 0; i <= rows.length; i++) {
      // planted: the clip has the foot down, and the final foot is down too (a catch-up step's arc lifts it
      // clear of the ground; that is a step, not a slide, and it is counted in lifts)
      const planted = i < rows.length && rows[i][s].fkY < lo + 0.012 && rows[i][s].fin[1] - (rows[i][s].g + lo) < 0.012;
      if (planted && start < 0) start = i;
      if (!planted && start >= 0) {
        if (i - start >= 6) {
          let path = 0, vert = 0;
          for (let k = start + 3; k < i - 2; k++) { const p = rows[k][s].fin, q = rows[k - 1][s].fin; path += Math.hypot(p[0] - q[0], p[2] - q[2]); }
          for (let k = start + 1; k < i - 1; k++) { const r = rows[k][s]; vert = Math.max(vert, Math.abs(r.fin[1] - (r.g + lo))); }
          steps.push({ foot: s, from: start, n: i - start, slide: path, vert, clip: rows[start].clip });
        }
        start = -1;
      }
    }
  }
  const sl = steps.map((x) => x.slide).sort((x, y) => x - y);
  // lifted frames: the clip has the foot down but the final foot is held over 1.2 cm up (a catch-up step or
  // clearance); counted so a lock that hides slide by lifting feet shows here
  let lifts = 0; for (const s of ["L", "R"]) { const lo = soleOf(who); for (const r of rows) if (r[s].fkY < lo + 0.012 && r[s].fin[1] - (r[s].g + lo) >= 0.012) lifts++; }
  return { who, name, steps: steps.length, max: sl.length ? sl[sl.length - 1] : 0, p50: sl.length ? sl[Math.floor(sl.length / 2)] : 0, vert: Math.max(0, ...steps.map((x) => x.vert)), lifts, frames: rows.length, worst: steps.sort((x, y) => y.slide - x.slide)[0] || null };
}

// scenario drivers
const own = (seq) => (a, f) => { for (const [t, fn] of seq) if (t === f) fn(a); a.update(DT); };
const walkAt = (v) => (a) => { a.play("walk", { force: true }); a.state.vWant = v; };
const runAt = (v) => (a) => { a.play("run", { force: true }); a.state.vWant = v; };
const playF = (n) => (a) => a.play(n, { force: true });
const drivePath = (path, anim = (v) => (v > 2.0 ? "run" : "walk")) => {
  let prev = null;
  return (a, f) => { const t = f * DT, p = path(t); const v = prev ? Math.hypot(p.x - prev.x, p.z - prev.z) / DT : 0; prev = p; a.state.pos[1] = p.y || 0; a.drive({ x: p.x, z: p.z, face: p.face, pose: { anim: v < 0.05 ? "idle" : anim(v), loop: true }, dt: DT }); };
};
const SLOPE = Math.tan(10 * D2R);
const SCEN = [
  ["walk 1.0 m/s", 240, own([[0, walkAt(1.0)]]), { warm: 90 }],
  ["walk 1.5 m/s", 240, own([[0, walkAt(1.5)]]), { warm: 90 }],
  ["run 2.6 m/s", 240, own([[0, runAt(2.6)]]), { warm: 120 }],
  ["run 3.6 m/s", 240, own([[0, runAt(3.6)]]), { warm: 120 }],
  ["run 4.5 m/s", 240, own([[0, runAt(4.5)]]), { warm: 120 }],
  ["walk to run (accelerating)", 240, own([[0, walkAt(1.0)], [60, (a) => { a.play("run", { force: true }); a.state.vWant = 4.2; }]]), {}],
  ["start: idle to walk", 150, own([[0, playF("idle")], [20, walkAt(1.5)]]), {}],
  ["stop: walk to idle", 150, own([[0, walkAt(1.5)], [90, playF("idle")]]), { warm: 0 }],
  ["stop: run to stop", 150, own([[0, runAt(3.6)], [90, playF("stop")]]), {}],
  ["turn in place", 150, own([[0, playF("idle")], [20, playF("turn")]]), {}],
  ["turn from a run", 150, own([[0, runAt(3.6)], [80, playF("turn_run")]]), {}],
  ["drive: walk straight 1.4", 240, drivePath((t) => ({ x: 0, z: 1.4 * t, face: Math.PI / 2 })), { warm: 60 }],
  ["drive: walk a 3 m circle", 300, drivePath((t) => { const w = 1.4 / 3; return { x: 3 * Math.cos(w * t), z: 3 * Math.sin(w * t), face: w * t + Math.PI / 2 }; }), { warm: 60 }],
  ["drive: run a 4 m circle", 300, drivePath((t) => { const w = 3.6 / 4; return { x: 4 * Math.cos(w * t), z: 4 * Math.sin(w * t), face: w * t + Math.PI / 2 }; }), { warm: 60 }],
  ["drive: walk up a 10 deg slope", 240, drivePath((t) => ({ x: 0, z: 1.4 * t, y: SLOPE * 1.4 * t, face: Math.PI / 2 })), { warm: 60, ground: (x, z) => SLOPE * z }],
  ["drive: walk across a 10 deg slope", 240, drivePath((t) => ({ x: 1.4 * t, z: 0, y: 0, face: 0 })), { warm: 60, ground: (x, z) => SLOPE * z }],
];
const out = [];
for (const who of WHO) for (const [name, n, step, o] of SCEN) {
  const r = run(who, name, n, step, { ...o, opts: o.ground ? { ground: o.ground } : {} }); out.push(r);
  console.log(`${who.padEnd(6)} ${name.padEnd(34)} steps ${String(r.steps).padStart(3)}  slide max ${(r.max * 100).toFixed(2).padStart(6)} cm  p50 ${(r.p50 * 100).toFixed(2).padStart(5)} cm  vert ${(r.vert * 100).toFixed(1).padStart(5)} cm  lifted ${String(r.lifts).padStart(3)}/${r.frames * 2}${r.worst ? `  (worst ${r.worst.clip} foot${r.worst.foot} @${r.worst.from})` : ""}`);
}
const worst = Math.max(...out.map((r) => r.max));
console.log(`IK ${IK ? "on" : "off"}, gait ${GAIT ? "on" : "off"}: worst step slide ${(worst * 100).toFixed(2)} cm over ${out.reduce((s, r) => s + r.steps, 0)} steps`);
const J = arg("--json", null); if (J) { mkdirSync(new URL("../out/", import.meta.url), { recursive: true }); writeFileSync(J, JSON.stringify({ ik: IK, gait: GAIT, worst, rows: out }, null, 1)); }
