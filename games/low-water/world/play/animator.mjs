// The walker's animation: which clip plays and how the feet meet the ground. It reads the body
// (play/controller.mjs) and writes a solved skeleton in the figure's own space (rig/skeleton.mjs),
// with the root's place on the map beside it. Engine-free: the clips, gaits and IK are the
// characters/ modules every Low Water figure uses.
//   const A = makeAnimator({ lib, P, who, coat }); const out = A.step(dt, body.state, ctx)
//   ctx: { ground(x, z), fp (0..1 first-person share), look (view pitch, radians), reach (bool, starts
//          a reach), wind: [x, z] (metres a second the air moves), lock (default true) }
// The states: idle, walk and run blended by speed (the gait solved from the leg, so the stance foot
// keeps pace with the ground), start and stop (the stride settles onto a double-support pose before
// the idle takes over), turning on the spot in small steps, wading, leaning into slopes, starts and
// curves. Each foot is locked to the ground while it bears weight and set on the ground's real height
// by two-bone IK, and the hips drop so the lower foot reaches.
import { solve, INDEX } from "../../characters/rig/skeleton.mjs";
import { ikLeg } from "../../characters/rig/ik.mjs";
import { sample } from "../../characters/anim/pose.mjs";
import { applyGait, blendGait, stanceHalf, GAITS } from "../../characters/anim/gait.mjs";
import { CLIPS } from "../../characters/anim/library.mjs";
import { makeLean, makeSecondary, coatSpring } from "../../characters/runtime/actor.mjs";
import { clamp, damp, smooth, lerp } from "./math.mjs";

const D = 180 / Math.PI;
export function mixPose(a, b, t) {
  if (t <= 0) return a; if (t >= 1) return b;
  const o = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (Array.isArray(a[j]) || Array.isArray(b[j])) { o[j] = (t < 0.5 ? a[j] : b[j]) ?? a[j] ?? b[j]; continue; }
    o[j] = {}; for (const k of new Set([...Object.keys(a[j] || {}), ...Object.keys(b[j] || {})])) o[j][k] = lerp(a[j]?.[k] ?? 0, b[j]?.[k] ?? 0, t);
  }
  return o;
}
const addTo = (p, j, k, v) => { p[j] = { ...(p[j] || {}) }; p[j][k] = (p[j][k] || 0) + v; };
// figure space (x to the figure's left, z ahead) to the map and back, for a figure facing `f`
export const toWorld = (r, p) => [r.x + p[0] * -Math.cos(r.face) + p[2] * Math.sin(r.face), r.y + p[1], r.z + p[0] * -Math.sin(r.face) - p[2] * Math.cos(r.face)];
export const toLocal = (r, w) => { const dx = w[0] - r.x, dz = w[2] - r.z; return [-dx * Math.cos(r.face) - dz * Math.sin(r.face), w[1] - r.y, dx * Math.sin(r.face) - dz * Math.cos(r.face)]; };
const rx = (a) => { const c = Math.cos(a), s = Math.sin(a); return [1, 0, 0, 0, c, -s, 0, s, c]; };
const ry = (a) => { const c = Math.cos(a), s = Math.sin(a); return [c, 0, s, 0, 1, 0, -s, 0, c]; };
const mul3 = (a, b) => [0, 1, 2].flatMap((r) => [0, 1, 2].map((c) => a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c]));

// First-person arms: the lantern brought up into the lower left of the view, the rod hand low and
// ready; the chest follows the look a little so the arms rise into view when the eyes go down.
const FP_ARMS = { clavL: { lift: 6, fwd: 8 }, armL: { fwd: 52, out: 4 }, foreL: { bend: 78 }, handL: { bend: -10 }, armR: { fwd: 30, out: 10 }, foreR: { bend: 64 }, handR: { bend: -6 }, hangL: { swing: 0 } };
const REACH = { clavR: { fwd: 14, lift: 4 }, armR: { fwd: 84, out: 2 }, foreR: { bend: 8 }, handR: { bend: -20 }, chest: { turn: -10, bend: 6 } };

export function makeAnimator({ lib, P, who = "lamb", coat = { kg: 3, stiff: 0.25 } }) {
  const lean = makeLean(), sec = makeSecondary(coatSpring(coat)), idleT = lib.timing(who, "idle"), wadeT = lib.timing(who, "wade");
  const st = { u: 0, mw: 0, wade: 0, t: 0, off: 0, reach: -1, fp: 0, settle: false, lockOn: true };
  const feet = { L: { on: false, p: null, w: 0, step: -1, from: null }, R: { on: false, p: null, w: 0, step: -1, from: null } };
  const ankle = Math.max(0.03, P.h * P.leg * 0.04), legLen = P.h * P.leg * 0.96;   // thigh and shin (rig/skeleton.mjs restOffsets)
  let lastRoot = null;

  function locoPose(v, u, wade) {
    const L = lib.loco(who, v, u);
    let g = blendGait(P, v).g, pose = L.pose, cycle = L.cycle;
    if (wade > 0) {
      const gw = {}; for (const k of new Set([...Object.keys(g), ...Object.keys(GAITS.wade)])) gw[k] = lerp(g[k] ?? 0, GAITS.wade[k] ?? (k === "reach" ? 0.92 : 0), wade);
      const wp = sample(CLIPS.wade, wadeT, u * (wadeT.frames || CLIPS.wade.frames));
      if (wp.pelvis) wp.pelvis = { ...wp.pelvis, turn: 0, side: 0 };
      applyGait(wp, gw, P, u * 24, 24); wp.root.x = 0; wp.root.z = 0;
      pose = mixPose(pose, wp, wade); g = gw; cycle = (2 * stanceHalf(P, gw)) / gw.stance;
    }
    return { pose, g, cycle };
  }

  function step(dt, body, ctx) {
    st.t += dt;
    const v = body.speed, ground = ctx.ground, useLock = ctx.lock !== false;
    st.wade = damp(st.wade, body.wade || 0, 0.25, dt);
    // moving share: the stride fades in over the first half metre a second
    const wantMove = smooth(v / 0.55);
    st.mw = damp(st.mw, wantMove, wantMove > st.mw ? 0.06 : 0.12, dt);
    const { pose: lp, g, cycle } = locoPose(Math.max(v, 0.6), st.u, st.wade);
    // the phase runs by distance, so the stance foot moves back exactly as far as the body goes forward
    if (v > 0.12) { st.u = (st.u + body.moved / cycle) % 1; st.settle = false; }
    else if (st.mw > 0.02) {
      // stopping: carry the stride on to the nearer double support (both heels down) and hold there
      const goal = st.u < 0.25 ? 0 : st.u < 0.75 ? 0.5 : 1, du = goal - st.u;
      st.u = (st.u + Math.sign(du) * Math.min(Math.abs(du), dt * 1.4) + 1) % 1; st.settle = true;
    }
    const idle = sample(CLIPS.idle, idleT, (st.t * 30) % (idleT.frames || CLIPS.idle.frames));
    let pose = mixPose(idle, lp, st.mw);
    // lean: into curves and starts (the shared lean), and into the hill
    lean.step(dt, [body.x, 0, body.z], 180 - body.face * D);
    pose = lean.apply(pose);
    addTo(pose, "spine", "bend", clamp(body.grade, -0.6, 0.6) * 14 * st.mw);
    // coat: the springs of every figure, plus the wind pressing the skirts back and aside
    sec.step(dt, [body.x, 0, body.z], 180 - body.face * D, pose);
    pose = sec.apply(pose);
    if (ctx.wind) {
      const fw = [Math.sin(body.face), -Math.cos(body.face)], lf = [-Math.cos(body.face), -Math.sin(body.face)], wf = ctx.wind[0] * fw[0] + ctx.wind[1] * fw[1], wl = ctx.wind[0] * lf[0] + ctx.wind[1] * lf[1];
      const gust = 0.65 + 0.35 * Math.sin(st.t * 1.7) * Math.sin(st.t * 0.63 + 1.3);
      for (const s of ["L", "R"]) { addTo(pose, "skirt" + s, "swing", clamp(-wf * 2.2 * gust, -35, 35)); addTo(pose, "skirt" + s, "sway", clamp((s === "L" ? wl : -wl) * 1.6 * gust, -25, 25)); }
      addTo(pose, "hangL", "swing", clamp(-wf * 0.8 * gust, -12, 12));
    }
    // first person: the arms come up into view, the chest follows the look
    st.fp = damp(st.fp, ctx.fp || 0, 0.12, dt);
    if (st.fp > 0.001) {
      const look = (ctx.look || 0) * D, sway = Math.sin(st.u * 2 * Math.PI) * 4 * st.mw;
      const arms = mixPose(pose, { ...pose, ...Object.fromEntries(Object.entries(FP_ARMS).map(([j, c]) => [j, { ...(pose[j] || {}), ...c }])) }, st.fp);
      pose = arms;
      addTo(pose, "chest", "bend", -look * 0.25 * st.fp); addTo(pose, "armL", "fwd", (-look * 0.5 + sway) * st.fp); addTo(pose, "armR", "fwd", (-look * 0.4 - sway) * st.fp);
    }
    // a reach: the rod hand goes out and comes back over 0.9 s
    if (ctx.reach && st.reach < 0) st.reach = 0;
    if (st.reach >= 0) {
      st.reach += dt; const k = Math.sin(Math.PI * clamp(st.reach / 0.9, 0, 1));
      pose = mixPose(pose, { ...pose, ...Object.fromEntries(Object.entries(REACH).map(([j, c]) => [j, { ...(pose[j] || {}), ...c }])) }, smooth(k * 1.4));
      if (st.reach > 0.9) st.reach = -1;
    }
    // a sole on the ground: the ankle's height for a foot at (x, z) along the body's heading, and its
    // pitch. The heel and the toe are both kept above the ground, so on a stair the foot stands on
    // the step its toe reaches; the pitch is held within 21 degrees.
    const fwx = Math.sin(body.face), fwz = -Math.cos(body.face);
    const sole = (x, z) => {
      const hs = ground(x - fwx * 0.04, z - fwz * 0.04), ht = ground(x + fwx * 0.14, z + fwz * 0.14), sl = clamp((ht - hs) / 0.18, -0.38, 0.38);
      return { y: ankle + Math.max(hs + 0.04 * sl, ht - 0.14 * sl), pitch: -Math.atan(sl) };
    };
    const S = solve(P, pose), root = { x: body.x, y: body.y + st.off, z: body.z, face: body.face };
    // ---- the feet on the ground
    const planted = { L: st.mw < 0.5 || st.u < g.stance, R: st.mw < 0.5 || ((st.u + 0.5) % 1) < g.stance };
    const want = {}, gy = {};
    for (const s of ["L", "R"]) {
      const a = S[INDEX["foot" + s]].p, w = toWorld(root, a);
      gy[s] = sole(w[0], w[2]); want[s] = { anim: w, h: a[1] };
    }
    // the hips come down so the lower foot reaches its ground; never up past the stand
    const lowest = Math.min(gy.L.y, gy.R.y) - ankle - body.y;
    st.off = damp(st.off, clamp(lowest, -0.45, 0.02), 0.06, dt);
    root.y = body.y + st.off;
    if (lastRoot && Math.hypot(root.x - lastRoot.x, root.z - lastRoot.z) > 3) for (const s of ["L", "R"]) feet[s].on = false;   // a jump to a new place
    const bearing = {};
    for (const s of ["L", "R"]) {
      const F = feet[s], W = want[s];
      let tgt = [W.anim[0], gy[s].y - ankle + Math.max(ankle, W.h), W.anim[2]], pitchTo = gy[s].pitch;
      if (useLock) {
        if (planted[s]) {
          if (!F.on) { F.on = true; F.p = [W.anim[0], W.anim[2]]; F.step = -1; }
          // standing: when the body has turned or drifted off a planted foot, that foot steps back under it
          const off = Math.hypot(F.p[0] - W.anim[0], F.p[1] - W.anim[2]), other = feet[s === "L" ? "R" : "L"];
          if (st.mw < 0.5 && F.step < 0 && other.step < 0 && off > 0.16) { F.step = 0; F.from = F.p.slice(); }
          if (F.step >= 0) {
            F.step += dt / 0.3; const k = smooth(F.step);
            F.p = [lerp(F.from[0], W.anim[0], k), lerp(F.from[1], W.anim[2], k)];
            const g = sole(F.p[0], F.p[1]); tgt = [F.p[0], g.y + 0.09 * Math.sin(Math.PI * Math.min(1, F.step)), F.p[1]]; pitchTo = g.pitch;
            if (F.step >= 1) F.step = -1;
          } else { const g = sole(F.p[0], F.p[1]); tgt = [F.p[0], g.y, F.p[1]]; pitchTo = g.pitch; }
        } else if (F.on) { F.on = false; F.rel = F.p.slice(); F.relT = 0; F.gap = Math.hypot(F.p[0] - W.anim[0], F.p[1] - W.anim[2]); F.gaps = (F.gaps || 0) + 1; }
        // just lifted: the foot leaves from where it was held, not from where the clip had drifted to
        if (!planted[s] && F.rel) {
          F.relT += dt; const k = smooth(F.relT / 0.12);
          tgt = [lerp(F.rel[0], tgt[0], k), tgt[1], lerp(F.rel[1], tgt[2], k)];
          if (k >= 1) F.rel = null;
        }
      }
      bearing[s] = planted[s] && F.step < 0;
      F.w = damp(F.w, 1, 0.02, dt);
      // the heel comes up before the leg runs out of reach (a toe-off), so a held foot is never dragged
      const hip = toWorld(root, S[INDEX["thigh" + s]].p), reachMax = legLen * 0.96, hz = Math.hypot(tgt[0] - hip[0], tgt[2] - hip[2]);
      if (hz < reachMax && Math.hypot(hz, hip[1] - tgt[1]) > reachMax) tgt[1] = hip[1] - Math.sqrt(reachMax * reachMax - hz * hz);
      ikLeg(S, s, toLocal(root, tgt), F.w);
      // the sole lies along the ground while it bears weight
      const fi = INDEX["foot" + s], fwdC = [S[fi].R[2], S[fi].R[5], S[fi].R[8]], cur = Math.atan2(-fwdC[1], Math.hypot(fwdC[0], fwdC[2]));
      const yaw = Math.atan2(fwdC[0], fwdC[2]);
      S[fi].R = mul3(ry(yaw), rx(planted[s] ? pitchTo : lerp(cur, pitchTo, 0.3)));
      F.world = tgt;
    }
    lastRoot = { ...root };
    return { S, root, pose, planted: bearing, phase: st.u, moving: st.mw, feet, settle: st.settle, fp: st.fp };
  }
  return { step, state: st };
}
