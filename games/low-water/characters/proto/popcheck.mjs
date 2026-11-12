// Frame-by-frame check of a sequence at 60 Hz: pops (a joint jumping further in one frame than the
// motion around it explains) and slides (a planted foot moving along the ground).
//   node proto/popcheck.mjs [who]      prints the worst frames and a summary
import { readFileSync, existsSync } from "node:fs";
import { createCast } from "../runtime/actor.mjs";
import { INDEX, JOINTS } from "../rig/skeleton.mjs";
import * as lamb from "../cast/lamb.mjs";
import * as warden from "../cast/warden.mjs";
import * as salvor from "../cast/salvor.mjs";
const who = process.argv[2] || "lamb";
const timing = JSON.parse(readFileSync(new URL("../anim/timing.json", import.meta.url), "utf8"));
const cf = new URL("../../game/engine/combat/out/timing.combat.json", import.meta.url), combat = existsSync(cf) ? JSON.parse(readFileSync(cf, "utf8")) : null;
const cast = createCast({ timing, combat, members: { lamb, warden, salvor } }), a = cast.actor(who), dt = 1 / 60;
// the sequence: [frame, clip, force]
const SEQ = [[0, "idle"], [40, "walk"], [120, "run"], [190, "roll_f", true], [215, "light_1", true], [235, "light_2"], [260, "light_3"], [290, "hit", true], [320, "guard"], [340, "step_l"], [370, "heavy", true], [440, "stagger", true], [500, "guard"], [520, "walk"], [560, "turn", true], [620, "idle"], [660, "talk_b", true], [740, "idle"]];
const N = 780, frames = [];
const skip = new Set(["root", "hangL", "hangR", "hangB", "skirtL", "skirtR"]);
for (let f = 0; f < N; f++) {
  for (const [t, clip, force] of SEQ) if (t === f) { const ok = a.play(clip, { force: !!force, fade: 6 }); if (!ok) a.play(clip, { force: true, fade: 6 }); }
  a.update(dt);
  const S = a.skeleton(), W = S.map((j) => a.toWorld(j.p));
  frames.push({ f, clip: a.state.clip, W });
}
const pops = [], slides = [];
for (let f = 2; f < N - 3; f++) {
  let worst = 0, wj = "";
  for (let j = 0; j < JOINTS.length; j++) {
    if (skip.has(JOINTS[j][0])) continue;
    const p0 = frames[f - 2].W[j], p1 = frames[f - 1].W[j], p2 = frames[f].W[j];
    // acceleration: the jump this frame against the motion of the frame before
    const acc = Math.hypot(p2[0] - 2 * p1[0] + p0[0], p2[1] - 2 * p1[1] + p0[1], p2[2] - 2 * p1[2] + p0[2]);
    if (acc > worst) { worst = acc; wj = JOINTS[j][0]; }
  }
  if (worst > 0.035) pops.push({ f, clip: frames[f].clip, joint: wj, acc: worst });
  for (const s of ["L", "R"]) {
    const j = INDEX["foot" + s], p1 = frames[f - 1].W[j], p2 = frames[f].W[j];
    const ground = Math.min(...frames.slice(Math.max(0, f - 30), f + 1).map((q) => q.W[j][1]));
    // planted: low for seven frames around this one (the first frames of a swing are not a slide)
    if ([-3, -2, -1, 0, 1, 2, 3].every((o) => frames[f + o] && frames[f + o].W[j][1] < ground + 0.02)) { const d = Math.hypot(p2[0] - p1[0], p2[2] - p1[2]); if (d > 0.012) slides.push({ f, clip: frames[f].clip, foot: s, d }); }
  }
}
const by = (arr, k) => Object.entries(arr.reduce((o, x) => ((o[x.clip] = (o[x.clip] || 0) + 1), o), {})).map(([c, n]) => `${c} ${n}`).join(", ");
console.log(`${who}: ${N} frames at 60 Hz`);
console.log(`severity: worst ${(Math.max(...pops.map((p) => p.acc)) * 100).toFixed(0)} cm, frames over 20 cm ${pops.filter((p) => p.acc > 0.2).length}, summed excess ${(pops.reduce((a, p) => a + p.acc - 0.035, 0) * 100).toFixed(0)} cm`);
console.log(`pops (joint acceleration > 3.5 cm/frame^2): ${pops.length}${pops.length ? "  by clip: " + by(pops) : ""}`);
for (const p of pops.filter((p) => !process.env.CLIP || p.clip === process.env.CLIP).sort((a, b) => b.acc - a.acc).slice(0, 8)) console.log(`  frame ${p.f} ${p.clip} ${p.joint} ${(p.acc * 100).toFixed(1)} cm`);
console.log(`slides (planted foot moving > 1.2 cm/frame): ${slides.length}${slides.length ? "  by clip: " + by(slides) : ""}`);
for (const s of slides.sort((a, b) => b.d - a.d).slice(0, 8)) console.log(`  frame ${s.f} ${s.clip} foot${s.foot} ${(s.d * 100).toFixed(1)} cm`);
