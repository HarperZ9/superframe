// Actors: the runtime face of the character pipeline. Pure ES module (browser and Node).
//
// Two ways to drive an actor:
//  1. In a fight, combat is the clock (design/NOTES-FOR-ENGINEER.md, combat engineer's interface):
//       a.drive({ x, z, face, pose })   where pose is combat's poseOf(W, F) (anim/drive.mjs):
//       { clip: "<actor>.<anim>", anim, t (clip seconds), loop }. The actor shows that clip at that
//       time and keeps no clock, cancel window or root motion of its own.
//  2. Outside a fight (walking the quay, talking), the actor keeps its own clock:
//       a.play("talk_b"); a.update(dt)  -> { clip, frame, phase, iframes, hit, cancel, done, move }
// Either way:
//   a.weapon()   { grip, tip, radius } in world space (the tool's striking length, from the skeleton)
//   a.body()     the hurt capsule;   a.render(view, w, h, rig, opts)  a float RGBA image
//   cast.clips(who)  the clip table combat's drive.mjs warps against: { "<actor>.<anim>": { length, phases } }
import { makeLibrary, COMBAT_ACTOR } from "../anim/library.mjs";
import { INDEX, apply } from "../rig/skeleton.mjs";
import { skin, groundShift } from "../rig/body.mjs";
import { solveFigure, hiddenOf } from "../rig/solvefig.mjs";
import { gripAt, toolOf } from "../cast/tools.mjs";
import { PROP_IDS, lying, lodFor } from "../render/figure.mjs";
import { spriteView, rasterize, makeG, placeFn, castShadow, toScreen } from "../render/raster.mjs";
import { albedo, light, ink, compose, shadowDir } from "../render/shade.mjs";
import { down } from "../render/image.mjs";
import { layout } from "../anim/pose.mjs";

const SMEAR = 40;   // materials.mjs smear
const LOOPS = new Set(["idle", "walk", "run", "wade", "guard"]);
const D2R = Math.PI / 180, FPS = 30;
export function blend(a, b, t) {
  const o = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (Array.isArray(a[j]) || Array.isArray(b[j])) { o[j] = t < 0.5 ? a[j] : b[j]; continue; }
    o[j] = {}; const A = a[j] || {}, B = b[j] || {};
    // whole-body angles (a is the pose arriving, b the pose being left): the arriving angle is taken a
    // whole turn on, in the direction the leaving clip was turning, so a cut-short roll or spin finishes
    // its turn forward instead of unwinding, and never jumps across a wrap
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[k] || 0, b = B[k] || 0, ang = j === "root" && (k === "pitch" || k === "yaw" || k === "roll");
      let a2 = a; if (ang) a2 = b >= 0 ? a + 360 * Math.max(0, Math.ceil((b - a - 30) / 360)) : a - 360 * Math.max(0, Math.ceil((a - b - 30) / 360));
      o[j][k] = a2 * (1 - t) + b * t;
    }
  }
  return o;
}
// combat's facing (radians from +x toward +z) to the art's (degrees, 0 faces +z)
export const faceToDeg = (face) => 90 - face / D2R;

// Secondary motion: springs for the two coat-skirt panels and the lantern. Targets come from the
// clip (a panel follows its thigh), from the body's acceleration (the hem trails a start and swings
// on into a stop), from turning (the hem flares outward) and from speed (it streams behind).
// Underdamped, so a stop leaves a swing that settles.
export function makeSecondary({ k = 70, zeta = 0.32 } = {}) {
  const sp = { sL: [0, 0], sR: [0, 0], wL: [0, 0], wR: [0, 0], lan: [0, 0] }; let last = null;
  const step1 = (s, target, dt) => { const c = 2 * zeta * Math.sqrt(k); s[1] += (k * (target - s[0]) - c * s[1]) * dt; s[0] += s[1] * dt; };
  return {
    step(dt, pos, facing, pose) {
      if (!dt) return; const f = facing * D2R, fw = [Math.sin(f), Math.cos(f)], lf = [Math.cos(f), -Math.sin(f)];
      const now = { x: pos[0], z: pos[2], facing };
      if (!last) { last = { ...now, vf: 0, vl: 0 }; return; }
      const vx = (now.x - last.x) / dt, vz = (now.z - last.z) / dt, vf = vx * fw[0] + vz * fw[1], vl = vx * lf[0] + vz * lf[1];
      const af = Math.max(-30, Math.min(30, (vf - last.vf) / dt)), al = Math.max(-30, Math.min(30, (vl - last.vl) / dt));
      let dy = now.facing - last.facing; dy = ((dy + 540) % 360) - 180; const yaw = Math.max(-900, Math.min(900, dy / dt));
      const thL = pose.thighL?.fwd || 0, thR = pose.thighR?.fwd || 0, trail = -Math.min(25, 6 * Math.abs(vf));
      const swing = (th) => Math.max(-70, Math.min(70, 0.35 * th + trail - 2.2 * af)), flare = Math.min(40, Math.abs(yaw) * 0.035);
      for (let i = 0; i < 4; i++) {   // substeps keep the spring stable at 30 Hz
        const h = dt / 4;
        step1(sp.sL, swing(thL), h); step1(sp.sR, swing(thR), h);
        step1(sp.wL, flare - 1.6 * al, h); step1(sp.wR, flare + 1.6 * al, h);
        step1(sp.lan, -2.5 * af - 0.4 * vf, h);
      }
      last = { ...now, vf, vl };
    },
    apply(p) {
      p.skirtL = { swing: (p.skirtL?.swing || 0) + sp.sL[0], sway: (p.skirtL?.sway || 0) + sp.wL[0] };
      p.skirtR = { swing: (p.skirtR?.swing || 0) + sp.sR[0], sway: (p.skirtR?.sway || 0) + sp.wR[0] };
      for (const h of ["hangL", "hangB"]) p[h] = { ...(p[h] || {}), swing: (p[h]?.swing || 0) + sp.lan[0] };
      return p;
    },
    state: sp,
  };
}

// Coat weight shows in its swing: heavier and stiffer cloth swings slower and flares less.
// coat { kg, stiff 0..1 }: a light oilskin cape about 1.5 kg, Lamb's wool greatcoat 3, a waxed
// riding coat with plates sewn in 6 (builds will change this; see characters/GEAR.md).
export const coatSpring = (coat = { kg: 3, stiff: 0.3 }) => ({ k: 90 / Math.sqrt(Math.max(0.5, coat.kg)) * (1 + coat.stiff), zeta: 0.25 + 0.25 * coat.stiff + 0.03 * coat.kg });

// Water dripping from a figure (Keel): drops fall from the given joints (a hand's fingertips, the
// cap's brim) under gravity, each a short pale streak lit like wet light, cycling forever.
function drip(out, G, V, pl, S, joints, t) {
  const ppm = V.ppm, g = 9.8;
  joints.forEach((j, ji) => {
    const at = S[INDEX[j]]; if (!at) return;
    const o = j === "head" ? [0, 0.3, 0.14] : [0, -0.11, 0.02], base = pl.p(apply(at.R, o).map((v, k) => v + at.p[k]));
    for (let d = 0; d < 3; d++) {
      const per = 0.55 + 0.17 * ((ji * 3 + d) % 4), ph = (t + (ji * 0.37 + d * 0.41)) % per, fall = 0.5 * g * ph * ph;
      if (fall > base[1]) continue;
      const q = toScreen(V, [base[0] + (j === "head" ? (d - 1) * 0.06 : 0), base[1] - fall, base[2]]), len = Math.max(2, Math.min(10, g * ph * ppm * 0.012));
      for (let k = 0; k < len; k++) { const x = Math.round(q[0]), y = Math.round(q[1]) - k; if (x < 0 || y < 0 || x >= G.w || y >= G.h) continue; const i = (y * G.w + x) * 4, a = 0.75 * (1 - k / len); out[i] = out[i] * (1 - a) + 0.85 * a; out[i + 1] = out[i + 1] * (1 - a) + 0.82 * a; out[i + 2] = out[i + 2] * (1 - a) + 0.75 * a; out[i + 3] = Math.max(out[i + 3], a); }
    }
  });
}

export function createCast({ timing, combat = null, members }) {
  const styles = Object.fromEntries(Object.entries(members).filter(([, m]) => m.style).map(([k, m]) => [k, m.style]));
  const L = makeLibrary(timing, styles, combat, Object.fromEntries(Object.entries(members).map(([k, m]) => [k, m.P]))), meshes = {};
  const built = (who, lod, tool) => meshes[`${who}|${lod}|${tool}`] || (meshes[`${who}|${lod}|${tool}`] = members[who].build({ lod, tool }));

  // The clip table for combat's warp: phases named windup, active, recovery, in seconds.
  function clips(who) {
    const out = {}, actor = COMBAT_ACTOR[who] || who;
    for (const [name, c] of Object.entries(L.clips)) {
      const lay = layout(c, L.timing(who, name)), phases = [];
      for (const [ph, [s, n]] of Object.entries(lay.starts)) phases.push({ name: ph === "startup" ? "windup" : ph, from: s / FPS, to: (s + n) / FPS });
      out[`${actor}.${name}`] = { length: lay.length / FPS, phases, loop: !!c.loop };
    }
    return out;
  }

  function actor(who, { pos = [0, 0, 0], facing = 0, tool } = {}) {
    const C = members[who], info = C.info || {};
    const st = { clip: "idle", frame: 0, prev: null, prevFrame: 0, fade: 0, fadeLen: 6, pos: [...pos], facing, rootZ: 0, rootX: 0, tool: tool || info.tool, external: false, sec: makeSecondary(coatSpring(info.coat)), locks: { L: null, R: null } };
    const T = () => toolOf(st.tool), cls = () => T().cls;
    // a clip name as the art knows it: combat's "<actor>.<anim>" loses its actor prefix; strikes and
    // the guard take the tool's class ("light_1" with the stick is "light.light_1")
    // lookup order: this weapon's own clip (a weapon special, a weapon-specific moveset), its class's,
    // then the generic one. Weapon ids drop combat's "w." (w.boathook -> boathook.heavy).
    const artName = (name) => {
      if (LOOPS.has(name) && name !== "guard") return name;   // locomotion is never a weapon clip (light.run is the running strike)
      const wid = (T().id || "").replace(/^w\./, "");
      for (const n of [name, name.slice(name.indexOf(".") + 1)]) {
        if (wid && L.clips[`${wid}.${n}`]) return `${wid}.${n}`;
        if (L.clips[`${cls()}.${n}`]) return `${cls()}.${n}`; if (L.clips[n]) return n;
      }
      return name;
    };
    const ev = () => L.events(who, st.clip, st.frame);
    const advanceU = (u, dist, v) => ((((u ?? 0) + dist / L.loco(who, v, 0).cycle) % 1) + 1) % 1;
    const fromWorld = (w) => { const r = st.facing * D2R, c = Math.cos(r), s = Math.sin(r), dx = w[0] - st.pos[0], dz = w[2] - st.pos[2]; return [c * dx - s * dz, w[1] - st.pos[1], s * dx + c * dz]; };
    const self = {
      who, info, state: st, library: L,
      get pos() { return st.pos; }, get facing() { return st.facing; }, set facing(v) { st.facing = v; },
      get tool() { return st.tool; }, set tool(t) { st.tool = t; },
      // combat drives: show its clip at its time
      drive({ x, z, face, pose, dt = 1 / 60 }) {
        const ox = st.pos[0], oz = st.pos[2], of = st.facing;
        if (x != null) { st.pos[0] = x; st.pos[2] = z; }
        if (face != null) st.facing = faceToDeg(face);
        let name = artName(pose.anim || pose.clip);
        if (!L.clips[name]) { (st.missing ||= new Set()).has(name) || (st.missing.add(name), console.warn(`actor ${who}: no clip for combat's "${pose.anim || pose.clip}"; showing the guard`)); name = artName("guard"); }
        const len = L.length(who, name) || 1;
        if (name !== st.clip) { st.prev = st.clip; st.prevFrame = st.frame; st.fade = st.fadeLen = pose.loop ? 9 : 5; }   // 5 to 9 frames at 30 fps: 0.17 to 0.3 s (NOTES)
        st.clip = name; st.external = true; st.rate = pose.rate ?? 1;   // combat times the clip (t from its frames, warped per phase); rate is kept for secondary motion
        // a loop plays by the ground actually covered, so the planted foot stays planted at any speed
        const sp = L.timing(who, name).speed, moved = Math.hypot(st.pos[0] - ox, st.pos[2] - oz);
        if (name === "walk" || name === "run") { const v = moved / Math.max(1e-3, dt); st.v = st.v == null ? v : st.v + (v - st.v) * Math.min(1, dt * 8); st.u = advanceU(st.u, moved, Math.max(0.3, st.v)); }
        st.frame = pose.loop ? (st.frame + (sp ? (moved / sp) * FPS : dt * FPS)) % len : pose.t != null ? Math.min(len - 1e-3, pose.t * FPS) : (pose.u || 0) * len;
        { const bp = self.basePose(); st.sec.step(dt, st.pos, st.facing, bp); self.updateLocks(bp); }
        if (st.prev) { st.prevFrame += dt * FPS; st.fade = Math.max(0, st.fade - dt * FPS); if (!st.fade) st.prev = null; }   // fades count 30 fps frames whatever the caller's rate
      },
      // the game drives: start a clip (locomotion loops interrupt each other; anything else waits
      // for its cancel window unless forced)
      play(name, { force = false, fade = 6 } = {}) {
        name = artName(name); if (!L.clips[name]) throw new Error(`no clip ${name}`);
        if (name === st.clip && LOOPS.has(name)) return true;
        if ((name === "walk" || name === "run") && (st.clip === "walk" || st.clip === "run")) { st.clip = name; return true; }   // one locomotion: the speed blends, the phase carries on
        const e = ev();
        if (!force && !LOOPS.has(st.clip) && !e.done && !e.cancel) return false;
        // a loop starts at the phase whose legs are nearest the pose it leaves, so the blend has little to cover
        let start = 0;
        if (LOOPS.has(name) && L.clips[st.clip]) {
          const from = self.basePose(), n = L.length(who, name); let best = 1e9;
          for (let k = 0; k < 12; k++) { const q = L.pose(who, name, (k / 12) * n), dlt = ["thighL", "thighR", "shinL", "shinR"].reduce((acc, j) => acc + Math.abs((q[j]?.fwd ?? q[j]?.bend ?? 0) - (from[j]?.fwd ?? from[j]?.bend ?? 0)), 0); if (dlt < best) { best = dlt; start = (k / 12) * n; } }
        }
        if ((st.clip === "walk" || st.clip === "run") && st.v != null) st.prevLoco = { v: Math.max(0.3, st.v), u: st.u ?? 0 };
        if (name !== "walk" && name !== "run") st.v = null;
        st.prev = st.clip; st.prevFrame = st.frame; st.clip = name; st.frame = start; st.fade = fade; st.fadeLen = fade; st.external = false;
        const p0 = L.pose(who, name, 0).root || {}; st.rootZ = p0.z || 0; st.rootX = p0.x || 0;
        return true;
      },
      update(dt) {
        const Tm = L.timing(who, st.clip), len = L.length(who, st.clip), shown = { clip: st.clip, frame: st.frame, ...ev() };
        st.frame += dt * FPS;
        if (st.prev) { st.prevFrame += dt * FPS; st.fade = Math.max(0, st.fade - dt * FPS); if (!st.fade) st.prev = null; }
        let dz = 0, dx = 0;
        if (LOOPS.has(st.clip)) { dz = (Tm.speed || 0) * dt; if (st.frame >= len) st.frame -= len; if (st.clip === "walk" || st.clip === "run") { const want = st.vWant ?? (st.clip === "run" ? 3.6 : 1.5), acc = 7 * dt; st.v = st.v == null ? Math.min(want, 0.6) : st.v + Math.max(-acc, Math.min(acc, want - st.v)); dz = st.v * dt; st.u = advanceU(st.u, dz, st.v); } }   // speed eases (about 7 m/s per second), so the stride grows, it does not jump
        else {
          const r = L.pose(who, st.clip, Math.min(st.frame, len)).root || {};
          dz = (r.z || 0) - st.rootZ; dx = (r.x || 0) - st.rootX; st.rootZ = r.z || 0; st.rootX = r.x || 0;
        }
        if (ev().done && !LOOPS.has(st.clip)) {
          if (st.clip === "turn" || st.clip === "turn_run") st.facing += 180;
          self.play(st.clip === "fall" || st.clip === "knockdown" ? "getup" : L.clips[st.clip].tags?.includes("combat") ? "guard" : "idle", { force: true, fade: 8 });
        }
        const c = Math.cos(st.facing * D2R), s = Math.sin(st.facing * D2R), move = [c * dx + s * dz, -s * dx + c * dz];
        st.pos[0] += move[0]; st.pos[2] += move[1];
        const bp = self.basePose(); st.sec.step(dt, st.pos, st.facing, bp); self.updateLocks(bp);
        return { ...shown, move };
      },
      basePose() {
        let p;
        if ((st.clip === "walk" || st.clip === "run") && st.v != null && L.loco) {
          // speed-blended walk to run; the phase advances by distance, so feet stay planted
          p = L.loco(who, Math.max(0.3, st.v), st.u ?? 0).pose;
        } else p = L.pose(who, st.clip, Math.min(st.frame, L.length(who, st.clip) - 1e-3));
        if (st.prev && L.clips[st.prev]) {
          // the pose being left is what was on screen: the speed-blended locomotion when it was walking or running
          const q = (st.prev === "walk" || st.prev === "run") && st.prevLoco ? L.loco(who, st.prevLoco.v, st.prevLoco.u).pose : L.pose(who, st.prev, Math.min(st.prevFrame, L.length(who, st.prev) - 1e-3));
          p = blend(p, q, st.fade / st.fadeLen);
        }
        p.root = { ...(p.root || {}), x: 0, z: 0 };   // travel is in st.pos (ours, or combat's)
        return p;
      },
      pose() { return st.sec.apply(self.basePose()); },
      skeleton(pose = self.pose()) { return solveFigure(C, built(who, "far", st.tool), pose, self.locksLocal()); },
      // Foot locking: a foot that comes down is pinned where it landed (world space) and the leg
      // reaches for it by IK until the clip lifts it, so feet never skate under turns, blends,
      // root motion or a shell that moves the body at its own speed.
      locksLocal() {
        const out = {}; let any = false;
        for (const s of ["L", "R"]) { const k = st.locks[s]; if (!k) continue; const q = fromWorld(k.p), e = Math.max(0, Math.min(1, k.w)); out[s] = { p: [q[0], k.y, q[2]], w: e * e * (3 - 2 * e) }; any = true; }
        return any ? out : null;
      },
      updateLocks(pose) {
        if (lying(pose) || (pose.root?.y || 0) > 0.05) { st.locks.L = st.locks.R = null; return; }
        // gaits plant their own feet (anim/gait.mjs): let any lock go over a few frames
        // entering a gait, the locks hand over across the blend (their weight follows the blend), so
        // nothing is let go at once when the blend ends
        if (["walk", "run", "wade"].includes(st.clip) && st.prev) { const f = st.fade / Math.max(1e-6, st.fadeLen); for (const s of ["L", "R"]) { const k = st.locks[s]; if (k) { k.w = Math.min(k.w, f); if (k.w <= 0.01) st.locks[s] = null; } } return; }
        if (["walk", "run", "wade"].includes(st.clip) && !st.prev) { for (const s of ["L", "R"]) { const k = st.locks[s]; if (k) { k.w -= 0.2; if (k.w <= 0) st.locks[s] = null; } } return; }
        const S = solveFigure(C, built(who, "far", st.tool), pose), prev = st.prevFoot || (st.prevFoot = {});
        for (const s of ["L", "R"]) {
          const f = S[INDEX["foot" + s]].p, k = st.locks[s], back = prev[s] ? f[2] - prev[s][2] <= 0.004 : false;
          prev[s] = [...f];
          // planted: low, and no longer travelling forward under the body (the heel has struck)
          const down = f[1] < (k ? 0.13 : 0.1) && (k || back);
          if (!down) { if (k) { k.w -= 0.06; if (k.w <= 0) st.locks[s] = null; } continue; }
          if (!k && (L.clips[st.clip]?.tags?.includes("move") || (st.prev && L.clips[st.prev]?.tags?.includes("move")))) continue;   // no new locks in or out of a dodge: the body travels
          if (!k) { const wp = self.toWorld(f); st.locks[s] = { p: [wp[0], 0, wp[2]], y: Math.min(f[1], 0.05), w: 0.15 }; }
          else {
            // held until the clip lifts the foot; when the clip carries the body away from the planted
            // spot (a lunge, root motion) the lock lets go over a few frames instead of stretching the leg
            const wp = self.toWorld(f), far = Math.hypot(wp[0] - k.p[0], wp[2] - k.p[2]);
            if (far > 0.22) { k.w -= far > 0.6 ? 0.34 : 0.2; if (k.w <= 0) st.locks[s] = null; }
            else k.w = Math.min(1, k.w + 0.2);
          }
        }
      },
      toWorld(v) { return placeFn(st.facing, st.pos).p(v); },
      weapon() {
        const S = self.skeleton(), h = S[INDEX.handR], [a, b] = T().blade || [0.1, 0.8];
        const at = (s) => { const v = apply(h.R, gripAt(s)); return self.toWorld([h.p[0] + v[0], h.p[1] + v[1], h.p[2] + v[2]]); };
        return { grip: at(a), tip: at(b), radius: info.bladeR || 0.05, tool: T().id, cls: cls() };
      },
      body() { const S = self.skeleton(); return { a: self.toWorld(S[INDEX.pelvis].p), b: self.toWorld(S[INDEX.neck].p), radius: info.radius || 0.3 }; },
      render(view, w, h, rig, { ss = 1, bands = 4, tone = null, shadows = true, smear = true } = {}) {
        const V = spriteView(view, { w: w * ss, h: h * ss, height: view.height, centre: view.centre }), G = makeG(w * ss, h * ss), m = built(who, lodFor((h * ss) / view.height), st.tool);
        const pose = self.pose(), S = skin(m.M, m.B, solveFigure(C, m, pose, self.locksLocal())), dy = groundShift(m.M, S, PROP_IDS, lying(pose)), pl = placeFn(st.facing, [st.pos[0], st.pos[1] + dy, st.pos[2]]);
        const hid = hiddenOf(pose, m); rasterize(V, m.M, S, G, pl, hid);
        // smear: when the tool sweeps far in one frame (a fast strike's two-frame hit window), draw it
        // again at points between last frame and this one, so the swing reads as an arc, not a jump
        const prev = st.smear && st.smear.mesh === m ? st.smear : null;
        if (prev && smear) {
          const ti = m.M.parts.indexOf("tool"); let far = 0;
          if (ti >= 0) for (let v = 0; v < m.M.part.length; v += 7) if (m.M.part[v] === ti) far = Math.max(far, Math.hypot(S.pos[v * 3] - prev.pos[v * 3], S.pos[v * 3 + 1] - prev.pos[v * 3 + 1], S.pos[v * 3 + 2] - prev.pos[v * 3 + 2]));
          if (far > 0.18) {
            const n = Math.min(20, Math.ceil(far / 0.03)), pplPrev = placeFn(prev.facing, prev.at), tmp = { pos: new Float32Array(S.pos.length), nrm: S.nrm };
            for (let k = 1; k < n; k++) {
              const t = k / n;   // positions blended in world space between the two frames
              for (let v = 0; v < S.pos.length / 3; v++) { const a = pplPrev.p([prev.pos[v * 3], prev.pos[v * 3 + 1], prev.pos[v * 3 + 2]]), b = pl.p([S.pos[v * 3], S.pos[v * 3 + 1], S.pos[v * 3 + 2]]); const q = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], r = (st.facing * Math.PI) / 180, c = Math.cos(r), sn = Math.sin(r), dx = q[0] - st.pos[0], dz = q[2] - st.pos[2]; tmp.pos[v * 3] = c * dx - sn * dz; tmp.pos[v * 3 + 1] = q[1] - (st.pos[1] + dy); tmp.pos[v * 3 + 2] = sn * dx + c * dz; }
              rasterize(V, m.M, tmp, G, pl, hid, ["tool"], SMEAR);
            }
          }
        }
        st.smear = { mesh: m, pos: S.pos.slice(), facing: st.facing, at: [st.pos[0], st.pos[1] + dy, st.pos[2]] }; if (shadows) castShadow(G, m.M, S, pl, shadowDir(rig, st.pos), { hidden: hid });
        const out = compose(G, albedo(G, C.palette), light(G, rig, C.palette), ink(G, { scale: ss }), { bands });
        if (tone) for (let i = 0; i < G.w * G.h; i++) if (G.id[i]) out.set(tone([out[i * 4], out[i * 4 + 1], out[i * 4 + 2]]), i * 4);
        if (info.drip) drip(out, G, V, pl, self.skeleton(pose), info.drip, (st.dripT = (st.dripT || 0) + 1 / 60));
        return { ...down(out, G.w, G.h, ss), G, full: out };
      },
    };
    return self;
  }
  return { actor, clips, library: L };
}
