// A held staff or pole kept inside the room around the figure (runtime/fightdrawer.mjs keepToolClear):
// the limits it is tested against and the search for a wrist and arm pose that fits, pure, so the drawer
// runs it on its own thread (searching TOOL_STEP candidates a frame) or the tool worker runs it whole
// (runtime/toolworker.mjs) and sends the answer back.
//   env = { measure(off) -> { w, S, toWorld } the weapon and skeleton with the tool layer off ([bend,
//           side, out], or null for none), pos, fx, fz (facing), R (room: ahead, left, right, behind),
//           blocked(x, z) | null, near: [[x, y, z] ...] other bodies' positions }
//   toolStep(env, st, budget)   one frame of the decision: st.tb, st.ts, st.to (the target) and st.search
//   toolExcess(env, off)        metres by which the shaft and the arms that hold it break the limits
import { INDEX } from "../rig/skeleton.mjs";

export const BODY_R = 0.5, BODY_TOP = 2.1;   // a standing body with its arms, coat and hat brim (0.36 and 0.45 let a pole and an arm graze a hat and a coat: PROGRESS 62)
export const TOOL_TRY = (() => { const o = []; for (const arm of [0, -15, -30]) for (let b = -60; b <= 60; b += 10) for (let sd = -60; sd <= 60; sd += 15) o.push([b, sd, arm]); o.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) + 1.5 * Math.abs(p[2]) - Math.abs(q[0]) - Math.abs(q[1]) - 1.5 * Math.abs(q[2])); return o; })();
export const toolOff = (b, sd, o) => ({ handR: { bend: b, side: sd }, armR: { out: o }, armL: { out: o } });

export function toolExcess(env, off) {
  const { pos, fx, fz, R, blocked, near } = env, m = env.measure(off), w = m.w; if (!w) return 0; let x = 0;
  for (const e of [w.tip, w.butt]) {
    if (!e) continue;
    const dx = e[0] - pos[0], dz = e[2] - pos[2], ahead = dx * fx + dz * fz, left = -dx * fz + dz * fx;
    x += Math.max(0, 0.05 - (e[1] - pos[1]));
    if (R) x += Math.max(0, ahead - R.ahead) + Math.max(0, left - R.left) + Math.max(0, -left - R.right) + (R.behind != null ? Math.max(0, -ahead - R.behind) : 0);
  }
  // and the shaft clear of the room's props in any direction (a bench beside, a counter behind): samples under 1.1 m
  if (R && blocked && w.butt) for (let i = 0; i <= 8; i++) { const t = i / 8, px = w.butt[0] + (w.tip[0] - w.butt[0]) * t, py = w.butt[1] + (w.tip[1] - w.butt[1]) * t - pos[1], pz = w.butt[2] + (w.tip[2] - w.butt[2]) * t; if (py < 1.1 && Math.hypot(px - pos[0], pz - pos[2]) > 0.3 && blocked(px, pz)) x += 0.1; }   // the body's own footprint aside
  // and the whole shaft clear of every other body drawn this frame (a standing capsule BODY_R round, to BODY_TOP with the hat)
  if (near.length) {   // the hands and forearms that hold it, too (a two-handed grip reaches across)
    const S = m.S;
    for (const sd of ["L", "R"]) {   // each forearm, elbow to hand, sampled
      const e = m.toWorld(S[INDEX["fore" + sd]].p), h = m.toWorld(S[INDEX["hand" + sd]].p);
      for (let i = 0; i <= 4; i++) { const t = i / 4, q = [e[0] + (h[0] - e[0]) * t, e[1] + (h[1] - e[1]) * t, e[2] + (h[2] - e[2]) * t];
        for (const o of near) { const qy = q[1] - o[1]; if (qy >= 0 && qy <= BODY_TOP) x += Math.max(0, BODY_R - Math.hypot(q[0] - o[0], q[2] - o[2])) / 5; } }
    }
  }
  if (w.butt) for (const o of near) for (let i = 0; i <= 8; i++) {
    const t = i / 8, px = w.butt[0] + (w.tip[0] - w.butt[0]) * t, py = w.butt[1] + (w.tip[1] - w.butt[1]) * t - o[1], pz = w.butt[2] + (w.tip[2] - w.butt[2]) * t;
    if (py < 0 || py > BODY_TOP) continue; x += Math.max(0, BODY_R - Math.hypot(px - o[0], pz - o[2])) / 8;
  }
  return x;
}

// One frame of the decision. A tool short of 0.5 m, or one that fits with no change, wants none; a target
// that still fits is kept; otherwise the first pose that fits, else the one that breaks the limits least,
// searched `budget` candidates this frame and carried on the next (st.search).
export function toolStep(env, st, budget = Infinity, count = null) {
  const fits = (off) => toolExcess(env, off) < 1e-3;
  const w = env.measure(null).w, long = w && Math.hypot(w.tip[0] - w.grip[0], w.tip[1] - w.grip[1], w.tip[2] - w.grip[2]) > 0.5;   // 0.5: a walking stick or a hook trailed into a bench counts (it was 0.8)
  if (!long || fits(null)) { st.tb = 0; st.ts = 0; st.to = 0; st.search = null; return; }
  if (!(st.tb || st.ts || st.to) || !fits([st.tb, st.ts, st.to || 0])) {
    const q = (st.search ||= { i: 0, best: [0, 0, 0], low: toolExcess(env, [0, 0, 0]) });
    for (let n = 0; n < budget && q.i < TOOL_TRY.length; n++, q.i++) {
      const [b, sd, o] = TOOL_TRY[q.i]; if (!b && !sd && !o) continue; const x = toolExcess(env, [b, sd, o]); if (count) count.tries++;
      if (x < q.low - 0.02) { q.low = x; q.best = [b, sd, o]; } if (x < 1e-3) { q.i = TOOL_TRY.length; break; }
    }
    if (q.i >= TOOL_TRY.length) { [st.tb, st.ts, st.to] = q.best; st.search = null; }
  } else st.search = null;
}
