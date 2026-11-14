// Transition continuity (characters/notes/ANIM-BOUNDS.md, targets 2 and 3). For every pair of a locomotion
// clip (idle, walk, run) and a combat clip in anim/library.mjs, both ways, the switch is played as the actor
// plays it (the clip being left keeps running, the one arriving starts, a cross-fade of `fade` frames at
// 30 fps) and sampled at 60 Hz. Per joint, per frame: the world angular acceleration (the change of angular
// velocity between frames, degrees/frame^2) and the position acceleration (cm/frame^2). A pop is what the
// blend adds over the two clips themselves: the blend's value less the larger of the two clips' own at the
// same clip times, at the ticks where the fade starts and ends (the step a fade can add). Reported: the worst
// edge excess over all pairs, the pairs over the threshold, and the worst excess inside the fade (no step: a
// fast clip mixed with a slow one bends the path there; reported, not bounded).
//   node proto/blend_check.mjs [--curve linear|smooth] [--wrap old|once] [--layer] [--json out/blend.json]
// --curve: the cross-fade weight (linear: what the actor did before 2026-10-22; smooth: runtime/actor.mjs fadeW)
// --layer: upper-body layering instead (the combat clip on the upper body over walking or running)
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createCast, blend, fadeW, layerPose, fadeWraps } from "../runtime/actor.mjs";
import { solve, JOINTS, INDEX } from "../rig/skeleton.mjs";
import * as lamb from "../cast/lamb.mjs";

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const CURVE = arg("--curve", "smooth"), LAYER = process.argv.includes("--layer"), WRAP = arg("--wrap", "once");
// --wrap old: the whole-turn rule the actor used before 2026-10-22 (decided every frame, from the leaving angle's sign)
function blendOld(a, b, t) {
  const o = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (Array.isArray(a[j]) || Array.isArray(b[j])) { o[j] = t < 0.5 ? a[j] : b[j]; continue; }
    o[j] = {}; const A = a[j] || {}, B = b[j] || {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const x = A[k] || 0, y = B[k] || 0, ang = j === "root" && (k === "pitch" || k === "yaw" || k === "roll");
      let x2 = x; if (ang) x2 = y >= 0 ? x + 360 * Math.max(0, Math.ceil((y - x - 30) / 360)) : x - 360 * Math.max(0, Math.ceil((x - y - 30) / 360));
      o[j][k] = x2 * (1 - t) + y * t;
    }
  }
  return o;
}
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const cast = createCast({ timing, combat, members: { lamb } }), L = cast.library, P = lamb.P;
const SKIP = new Set(["root", "hangL", "hangR", "hangB", "skirtL", "skirtR"]), JS = JOINTS.map(([n], i) => i).filter((i) => !SKIP.has(JOINTS[i][0]));
const W = (t) => (CURVE === "linear" ? t : fadeW(t));
const LOCO = ["idle", "walk", "run"];
const COMBAT = Object.keys(L.clips).filter((n) => { const t = L.clips[n].tags || []; return t.includes("combat") && !LOCO.includes(n) && n !== "wade"; });

// angle of the rotation taking A to B (row-major 3x3), as an axis-angle vector in degrees
function rotVec(A, B) {
  // R = B * A^T
  const R = [0, 1, 2].map((r) => [0, 1, 2].map((c) => B[r * 3] * A[c * 3] + B[r * 3 + 1] * A[c * 3 + 1] + B[r * 3 + 2] * A[c * 3 + 2]));
  const tr = R[0][0] + R[1][1] + R[2][2], ang = Math.acos(Math.max(-1, Math.min(1, (tr - 1) / 2)));
  if (ang < 1e-9) return [0, 0, 0];
  const s = 2 * Math.sin(ang), k = (ang * 180) / Math.PI / (s || 1);
  return [(R[2][1] - R[1][2]) * k, (R[0][2] - R[2][0]) * k, (R[1][0] - R[0][1]) * k];
}
const acc3 = (a, b, c) => Math.hypot(c[0] - 2 * b[0] + a[0], c[1] - 2 * b[1] + a[1], c[2] - 2 * b[2] + a[2]);
// per joint: [angular acc deg/frame^2, position acc cm/frame^2] at the middle of three skeletons
function accs(S0, S1, S2) {
  const out = [];
  for (const j of JS) { const w1 = rotVec(S0[j].R, S1[j].R), w2 = rotVec(S1[j].R, S2[j].R); out.push([Math.hypot(w2[0] - w1[0], w2[1] - w1[1], w2[2] - w1[2]), acc3(S0[j].p, S1[j].p, S2[j].p) * 100]); }
  return out;
}
const len = (n) => L.length("lamb", n), at = (n, f) => { const c = L.clips[n]; const l = len(n); return L.pose("lamb", n, c.loop ? ((f % l) + l) % l : Math.min(f, l - 1e-3)); };
const flat = (p) => { const q = { ...p, root: { ...(p.root || {}), x: 0, z: 0 } }; return q; };

// one transition: A playing from aStart, B starts at tick 0; fade frames at 30 fps; ticks at 60 Hz
function transition(A, B, aStart, fade = 6) {
  let worst = { ang: 0, pos: 0, f: -1, joint: "" };
  const ticks = [], N = fade * 2 + 8, wraps = WRAP === "once" ? fadeWraps(flat(at(B, 0)).root, flat(at(A, aStart)).root) : undefined;
  for (let k = -3; k < N; k++) {
    const fa = aStart + k / 2, fb = Math.max(0, k / 2), pa = flat(at(A, fa)), pb = flat(at(B, fb));
    let pBlend;
    if (k < 0) pBlend = pa;
    else if (LAYER) pBlend = layerPose(pa, pb, W(Math.min(1, k / (fade * 2))));
    else pBlend = WRAP === "old" ? blendOld(pb, pa, 1 - W(Math.min(1, k / (fade * 2)))) : blend(pb, pa, 1 - W(Math.min(1, k / (fade * 2))), wraps);   // actor: blend(arriving, leaving, remaining)
    ticks.push({ S: solve(P, pBlend), SA: solve(P, pa), SB: solve(P, pb), k });
  }
  // the boundary ticks: the acceleration centred on the tick where the fade starts and the one where it ends
  // (a step in a joint's speed shows there as a spike); the ticks between are reported as `mid`: the fade's
  // own ease, which any blend of two different poses over 12 ticks has, and which has no step in it
  const N2 = fade * 2, edge = new Set([0, N2]);
  worst.midAng = 0;
  for (let i = 2; i < ticks.length; i++) {
    const a = accs(ticks[i - 2].S, ticks[i - 1].S, ticks[i].S), aA = accs(ticks[i - 2].SA, ticks[i - 1].SA, ticks[i].SA), aB = accs(ticks[i - 2].SB, ticks[i - 1].SB, ticks[i].SB), k = ticks[i - 1].k;
    for (let j = 0; j < JS.length; j++) {
      const ex = a[j][0] - Math.max(aA[j][0], aB[j][0]), ep = a[j][1] - Math.max(aA[j][1], aB[j][1]);
      if (!edge.has(k)) { worst.midAng = Math.max(worst.midAng, ex); continue; }
      if (ex > worst.ang) worst = { ...worst, ang: ex, f: k, joint: JOINTS[JS[j]][0] };
      if (ep > worst.pos) worst.pos = ep;
    }
  }
  return worst;
}
const ANG = +arg("--ang", 4), POS = +arg("--pos", 1.5);   // thresholds: degrees/frame^2 and cm/frame^2 at 60 Hz (ANIM-BOUNDS.md)
const rows = [];
for (const lo of LAYER ? ["walk", "run"] : LOCO) for (const c of COMBAT) {
  if (LAYER && !(L.clips[c].tags || []).some((t) => t === "attack" || t === "use")) continue;
  const lA = len(lo);
  for (const ph of [0, 0.37, 0.71]) rows.push({ from: lo, to: c, ...transition(lo, c, ph * lA) });
  if (!LAYER) { const lc = len(c); rows.push({ from: c, to: lo, ...transition(c, lo, lc * 0.85) }); }
}
const over = rows.filter((r) => r.ang > ANG || r.pos > POS), wa = rows.reduce((m, r) => (r.ang > m.ang ? r : m), rows[0]), wp = rows.reduce((m, r) => (r.pos > m.pos ? r : m), rows[0]);
console.log(`${LAYER ? "layered" : "cross-fade"} ${CURVE}: ${rows.length} transitions over ${COMBAT.length} combat clips`);
console.log(`worst angular excess ${wa.ang.toFixed(2)} deg/frame^2 (${wa.from} -> ${wa.to}, ${wa.joint}, tick ${wa.f}); worst position excess ${wp.pos.toFixed(2)} cm/frame^2 (${wp.from} -> ${wp.to})`);
console.log(`over the thresholds at the fade's edges (${ANG} deg, ${POS} cm): ${over.length}; mid-fade excess, worst ${Math.max(...rows.map((r) => r.midAng)).toFixed(1)} deg/frame^2 (not a step; reported)`);
for (const r of over.sort((a, b) => b.ang - a.ang).slice(0, 8)) console.log(`  ${r.from} -> ${r.to}: ${r.ang.toFixed(2)} deg ${r.joint} @${r.f}, ${r.pos.toFixed(2)} cm`);
const J = arg("--json", null); if (J) writeFileSync(J, JSON.stringify({ curve: CURVE, layer: LAYER, n: rows.length, worstAng: wa.ang, worstPos: wp.pos, over: over.length, rows }, null, 0));
