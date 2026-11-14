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
import { blendGait } from "../anim/gait.mjs";
import { INDEX, apply } from "../rig/skeleton.mjs";
import { skin, groundShift } from "../rig/body.mjs";
import { solveFigure, hiddenOf } from "../rig/solvefig.mjs";
import { gripAt, toolOf } from "../cast/tools.mjs";
import { PROP_IDS, lying, lodFor } from "../render/figure.mjs";
import { spriteView, rasterize, makeG, placeFn, castShadow, toScreen } from "../render/raster.mjs";
import { albedo, light, ink, compose, shadowDir } from "../render/shade.mjs";
import { down } from "../render/image.mjs";
import { layout } from "../anim/pose.mjs";
import { tick, tock } from "./perf.mjs";
import { renderJob } from "./figjob.mjs";

const SMEAR = 40;   // materials.mjs smear
const LOOPS = new Set(["idle", "walk", "run", "wade", "guard"]);
const D2R = Math.PI / 180, FPS = 30;
// Whole-body angles across a fade (a is the root arriving, b the root being left): how many whole turns the
// arriving angle is taken on. A leaving clip partway through a roll or spin (more than 90 degrees round) has
// the arriving angle taken a whole turn on in the direction it was turning, so a cut-short roll finishes
// forward instead of unwinding; otherwise the nearer way round. Decided once when a fade starts and kept
// for the whole fade (runtime actor st.wraps): decided per frame, an arriving clip whose own angle passed the
// threshold mid-fade (a dodge turning 40 degrees) jumped a whole turn times the fade weight.
export function fadeWraps(a = {}, b = {}) {
  const o = {};
  for (const k of ["pitch", "yaw", "roll"]) {
    const x = a[k] || 0, y = b[k] || 0;
    o[k] = Math.abs(y) > 90 ? (y >= 0 ? Math.max(0, Math.ceil((y - x - 30) / 360)) : -Math.max(0, Math.ceil((x - y - 30) / 360))) : Math.round((y - x) / 360);
  }
  return o;
}
export function blend(a, b, t, wraps = fadeWraps(a.root, b.root)) {
  const o = {};
  for (const j of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (Array.isArray(a[j]) || Array.isArray(b[j])) { o[j] = t < 0.5 ? a[j] : b[j]; continue; }
    o[j] = {}; const A = a[j] || {}, B = b[j] || {};
    for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
      const a = A[k] || 0, b = B[k] || 0, ang = j === "root" && (k === "pitch" || k === "yaw" || k === "roll");
      const a2 = ang ? a + 360 * (wraps[k] || 0) : a;
      o[j][k] = a2 * (1 - t) + b * t;
    }
  }
  return o;
}
// combat's facing (radians from +x toward +z) to the art's (degrees, 0 faces +z)
export const faceToDeg = (face) => 90 - face / D2R;

// Cross-fade weight (characters/notes/ANIM-BOUNDS.md, targets 2 and 3): smootherstep, 6t^5 - 15t^4 + 10t^3.
// Its first and second derivatives are zero at both ends, so a fade adds no step in any joint's speed or
// acceleration where it starts or ends; the linear weight it replaces put a corner in every joint's path at both.
export const fadeW = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * t * (t * (6 * t - 15) + 10));

// Upper and lower body layering: an upper clip (a strike, a carry, a gesture) over whatever the legs play.
// The mask is per joint: the legs, hips and root stay the base's; the spine takes half the upper clip, the
// chest and everything above it all of it. The upper clip's hip and root turn is moved up into the spine and
// chest, so a strike that turns from the hips still turns the shoulders over walking legs.
export const UPPER_MASK = { spine: 0.5, chest: 1, neck: 1, head: 1, clavL: 1, armL: 1, foreL: 1, handL: 1, clavR: 1, armR: 1, foreR: 1, handR: 1, hangL: 1, hangR: 1 };
export function layerPose(base, upper, w) {
  if (w <= 0) return base;
  const o = { ...base }, twist = ((upper.pelvis?.turn || 0) - (base.pelvis?.turn || 0)) + ((upper.root?.yaw || 0) - (base.root?.yaw || 0)) * 0.5;
  for (const [j, m] of Object.entries(UPPER_MASK)) {
    const a = base[j] || {}, b = upper[j] || {}, k = w * m, c = {};
    for (const ch of new Set([...Object.keys(a), ...Object.keys(b)])) c[ch] = (a[ch] || 0) * (1 - k) + (b[ch] || 0) * k;
    o[j] = c;
  }
  if (twist) { o.spine = { ...o.spine, turn: (o.spine.turn || 0) + twist * 0.4 * w }; o.chest = { ...o.chest, turn: (o.chest.turn || 0) + twist * 0.6 * w }; }
  for (const k of ["hands", "hide"]) if (upper[k] && w > 0.5) o[k] = upper[k];
  if (upper.ik && w > 0.5) o.ik = upper.ik;
  return o;
}

// Additive lean from the body's own motion: into a curve (the sideways acceleration, as a runner leans) and
// with a start or a stop (the forward acceleration), on the spine and chest only, so planted feet stay
// planted. The acceleration is low-passed (0.12 s) and the lean eased (0.08 s), so it never jumps.
export function makeLean() {
  const st = { v: null, a: [0, 0], side: 0, bend: 0, last: null };
  return {
    step(dt, pos, facing) {
      if (!dt) return; const now = [pos[0], pos[2]];
      if (!st.last) { st.last = now; return; }
      const v = [(now[0] - st.last[0]) / dt, (now[1] - st.last[1]) / dt]; st.last = now;
      if (Math.hypot(v[0], v[1]) > 12) { st.v = null; return; }   // a teleport (a place change, a set position): no lean from it
      if (st.v) { const k = Math.min(1, dt / 0.12); for (let i = 0; i < 2; i++) st.a[i] += (Math.max(-25, Math.min(25, (v[i] - st.v[i]) / dt)) - st.a[i]) * k; }
      st.v = v;
      const f = facing * D2R, fw = [Math.sin(f), Math.cos(f)], lf = [Math.cos(f), -Math.sin(f)];
      const af = st.a[0] * fw[0] + st.a[1] * fw[1], al = st.a[0] * lf[0] + st.a[1] * lf[1];
      const side = Math.max(-11, Math.min(11, (Math.atan2(al, 9.81) / D2R) * 0.75)), bend = Math.max(-7, Math.min(7, (Math.atan2(af, 9.81) / D2R) * 0.5));
      const k = Math.min(1, dt / 0.08); st.side += (side - st.side) * k; st.bend += (bend - st.bend) * k;
    },
    apply(p) {
      if (Math.abs(st.side) < 0.05 && Math.abs(st.bend) < 0.05) return p;
      return { ...p, spine: { ...(p.spine || {}), side: (p.spine?.side || 0) + st.side * 0.6, bend: (p.spine?.bend || 0) + st.bend * 0.6 }, chest: { ...(p.chest || {}), side: (p.chest?.side || 0) + st.side * 0.4, bend: (p.chest?.bend || 0) + st.bend * 0.4 } };
    },
    state: st,
  };
}

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


// p + off, channel by channel (degrees add)
export function addPose(p, off) {
  const out = { ...p };
  for (const [k, v] of Object.entries(off)) { const b = out[k] || {}; const c = { ...b }; for (const [f, d] of Object.entries(v)) c[f] = (b[f] || 0) + d; out[k] = c; }
  return out;
}

// What the pose solve and the hidden parts read from a built figure (solvefig.mjs: the tool's two-hand grip,
// the grips and the hand shapes): a figure worker builds the mesh and sends this, so this thread never builds
// one (runtime/figpool.mjs meta)
export const metaOfBuilt = (b) => ({ tool: b.tool ? { twoHand: b.tool.twoHand ?? null } : null, grips: b.grips ? { ...b.grips } : undefined, hands: b.hands ? { ...b.hands } : undefined, meta: true });

// metaOf(who, tool): that figure's metaOfBuilt from elsewhere, null while it is on its way (the actor is then
// not ready: actor.ready()), undefined for "build it here"; without it the meshes are built here as before
export function createCast({ timing, combat = null, members, metaOf = null }) {
  const styles = Object.fromEntries(Object.entries(members).filter(([, m]) => m.style).map(([k, m]) => [k, m.style]));
  const L = makeLibrary(timing, styles, combat, Object.fromEntries(Object.entries(members).map(([k, m]) => [k, m.P]))), meshes = {};
  const built = (who, lod, tool) => meshes[`${who}|${lod}|${tool}`] || (meshes[`${who}|${lod}|${tool}`] = members[who].build({ lod, tool }));
  const rigOf = (who, tool) => (metaOf && metaOf(who, tool)) || built(who, "far", tool);   // the solve's view of the figure

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

  function actor(who, { pos = [0, 0, 0], facing = 0, tool, ground = null } = {}) {
    const C = members[who], info = C.info || {};
    const st = { clip: "idle", frame: 0, prev: null, prevFrame: 0, fade: 0, fadeLen: 6, pos: [...pos], facing, rootZ: 0, rootX: 0, tool: tool || info.tool, external: false, sec: makeSecondary(coatSpring(info.coat)), locks: { L: null, R: null }, ground, lean: makeLean(), up: null };
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
      ready() { return !metaOf || metaOf(who, st.tool) !== null; },   // its build's metaOfBuilt is here (createCast metaOf)
      // combat drives: show its clip at its time
      drive({ x, z, face, pose, dt = 1 / 60 }) {
        const ox = st.pos[0], oz = st.pos[2], of = st.facing;
        if (x != null) { st.pos[0] = x; st.pos[2] = z; }
        if (face != null) st.facing = faceToDeg(face);
        let name = artName(pose.anim || pose.clip);
        if (!L.clips[name]) { (st.missing ||= new Set()).has(name) || (st.missing.add(name), console.warn(`actor ${who}: no clip for combat's "${pose.anim || pose.clip}"; showing the guard`)); name = artName("guard"); }
        const len = L.length(who, name) || 1;
        if (name !== st.clip) { const left = st.bp ? st.bp.root : null; st.prev = st.clip; st.prevFrame = st.frame; st.fade = st.fadeLen = pose.loop ? 9 : 5; st.wrapFrom = left; st.wraps = null; }   // 5 to 9 frames at 30 fps: 0.17 to 0.3 s (NOTES)
        st.clip = name; st.external = true; st.rate = pose.rate ?? 1;   // combat times the clip (t from its frames, warped per phase); rate is kept for secondary motion
        // a loop plays by the ground actually covered, so the planted foot stays planted at any speed
        const sp = L.timing(who, name).speed, moved = Math.hypot(st.pos[0] - ox, st.pos[2] - oz);
        if (name === "walk" || name === "run") { const v = moved / Math.max(1e-3, dt); st.v = st.v == null ? v : st.v + (v - st.v) * Math.min(1, dt * 8); st.u = advanceU(st.u, moved, Math.max(0.3, st.v)); }
        st.frame = pose.loop ? (st.frame + (sp ? (moved / sp) * FPS : dt * FPS)) % len : pose.t != null ? Math.min(len - 1e-3, pose.t * FPS) : (pose.u || 0) * len;
        // an upper-body clip on combat's clock (pose.upper: { anim, t }); absent, a running one fades out
        if (pose.upper && pose.upper.anim) {
          const un = artName(pose.upper.anim);
          if (L.clips[un]) { if (!st.up || st.up.clip !== un) st.up = { clip: un, frame: 0, k: 0, fadeLen: 5, out: false, ext: true }; st.up.out = false; st.up.frame = Math.min(L.length(who, un) - 1e-3, (pose.upper.t || 0) * FPS); st.up.k = Math.min(1, st.up.k + (dt * FPS) / st.up.fadeLen); }
        } else if (st.up && st.up.ext) st.up.out = true;
        if (st.up && st.up.ext && st.up.out) { st.up.k = Math.max(0, st.up.k - (dt * FPS) / st.up.fadeLen); if (!st.up.k) st.up = null; }
        st.lean.step(dt, st.pos, st.facing);
        { const bp = self.basePose(); st.sec.step(dt, st.pos, st.facing, bp); self.updateLocks(bp); self.floorTool(); }
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
        st.wraps = fadeWraps(L.pose(who, name, start).root, self.basePose().root);   // whole turns, decided once for this fade
        st.prev = st.clip; st.prevFrame = st.frame; st.clip = name; st.frame = start; st.fade = fade; st.fadeLen = fade; st.external = false;
        const p0 = L.pose(who, name, 0).root || {}; st.rootZ = p0.z || 0; st.rootX = p0.x || 0;
        return true;
      },
      // an upper-body clip over whatever the legs play (a strike while walking, a carry, a talk gesture): it
      // fades in over `fade` frames (30 fps), plays once (a loop keeps going) and fades out; stopUpper() ends it.
      // update() reports its phase and hit flags as `upper`.
      playUpper(name, { fade = 6 } = {}) {
        name = artName(name); if (!L.clips[name]) throw new Error(`no clip ${name}`);
        const from = st.up ? st.up.k : 0;   // a new upper clip over one still showing starts from that weight, not from zero
        st.up = { clip: name, frame: 0, k: Math.min(from, 1), fadeLen: fade, out: false, ext: false };
        return true;
      },
      stopUpper({ fade = 6 } = {}) { if (st.up) { st.up.out = true; st.up.fadeLen = fade; } },
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
        let upper = null;
        if (st.up && !st.up.ext) {
          const u = st.up, ul = L.length(who, u.clip), ue = L.events(who, u.clip, Math.min(u.frame, ul - 1e-3));
          upper = { clip: u.clip, frame: u.frame, phase: ue.phase, hit: ue.hit, cancel: ue.cancel, done: ue.done, w: fadeW(u.k) };
          u.frame += dt * FPS;
          // the strike gives the arm back to the walk from its cancel point (or 35 % into recovery), so the
          // follow-through is not held over walking legs while the clip plays its guard out
          const lay = layout(L.clips[u.clip], L.timing(who, u.clip)), rc = lay.starts.recovery, early = !L.clips[u.clip].loop && (ue.cancel || (rc && u.frame >= rc[0] + rc[1] * 0.35));
          if (!u.out) { u.k = Math.min(1, u.k + (dt * FPS) / u.fadeLen); if (early) { u.out = true; u.fadeLen = Math.max(u.fadeLen, 8); } else if (u.frame >= ul) { if (L.clips[u.clip].loop) u.frame -= ul; else u.out = true; } }
          else { u.frame = Math.min(u.frame, ul - 1e-3); u.k = Math.max(0, u.k - (dt * FPS) / u.fadeLen); if (!u.k) st.up = null; }
        }
        st.lean.step(dt, st.pos, st.facing);
        const bp = self.basePose(); st.sec.step(dt, st.pos, st.facing, bp); self.updateLocks(bp); self.floorTool();
        return { ...shown, move, upper };
      },
      // the sampled pose is a function of the clip state alone; it is sampled once per state (the tool's
      // clearance search asks for it dozens of times a frame) and handed out as a shallow copy, since
      // callers replace joints on it (secondary motion, the adjust layers) but never edit one in place
      basePose() {
        const k = self.basePoseKey();
        if (st.bpKey === k) return { ...st.bp };
        const p = self.samplePose(); st.bpKey = k; st.bp = { ...p }; return p;
      },
      samplePose() {
        let p;
        if ((st.clip === "walk" || st.clip === "run") && st.v != null && L.loco) {
          // speed-blended walk to run; the phase advances by distance, so feet stay planted
          p = L.loco(who, Math.max(0.3, st.v), st.u ?? 0).pose;
        } else p = L.pose(who, st.clip, Math.min(st.frame, L.length(who, st.clip) - 1e-3));
        if (st.prev && L.clips[st.prev]) {
          // the pose being left is what was on screen: the speed-blended locomotion when it was walking or running
          const q = (st.prev === "walk" || st.prev === "run") && st.prevLoco ? L.loco(who, st.prevLoco.v, st.prevLoco.u).pose : L.pose(who, st.prev, Math.min(st.prevFrame, L.length(who, st.prev) - 1e-3));
          if (!st.wraps) st.wraps = fadeWraps(p.root, st.wrapFrom || q.root);   // combat's switch: decided on the first frame of the fade
          p = blend(p, q, fadeW(st.fade / st.fadeLen), st.wraps);
        }
        if (st.up && st.up.k > 0 && L.clips[st.up.clip]) p = layerPose(p, L.pose(who, st.up.clip, Math.min(st.up.frame, L.length(who, st.up.clip) - 1e-3)), fadeW(st.up.k));
        p.root = { ...(p.root || {}), x: 0, z: 0 };   // travel is in st.pos (ours, or combat's)
        return p;
      },
      pose() { let p = st.lean.apply(st.sec.apply(self.basePose())); if (st.adjust) for (const off of Object.values(st.adjust)) p = addPose(p, off); return p; },
      // additive offsets on top of whatever plays, by layer ({ handR: { bend: -20 } } on "tool": a held
      // pole angled clear of a counter; "seat": the hips fitted to a seat); null clears that layer
      adjust(off, layer = "main") { st.adjust = { ...(st.adjust || {}) }; if (off) st.adjust[layer] = off; else delete st.adjust[layer]; if (!Object.keys(st.adjust).length) st.adjust = null; },
      // the solved skeleton of the pose now, kept until the state changes (the tool's clearance search asks for it
      // twice for each wrist it tries); a pose passed in is solved as before
      skeleton(pose, lk) {
        if (pose) return solveFigure(C, rigOf(who, st.tool), pose, lk === undefined ? self.locksLocal() : lk);   // locks: another thread's (runtime/toolworker.mjs)
        const sp = st.sec.state, locks = self.locksLocal(), k = self.basePoseKey() + "|" + JSON.stringify(st.adjust) + "|" + sp.sL[0] + "," + sp.sR[0] + "," + sp.wL[0] + "," + sp.wR[0] + "," + sp.lan[0] + "|" + JSON.stringify(locks) + "|" + st.tool + "|" + st.lean.state.side + "," + st.lean.state.bend;
        if (st.skKey === k) return st.sk;
        st.skKey = k; return (st.sk = solveFigure(C, rigOf(who, st.tool), self.pose(), locks));
      },
      basePoseKey() { return st.clip + "|" + st.v + "|" + st.u + "|" + st.frame + "|" + st.prev + "|" + (st.prevLoco ? st.prevLoco.v + "|" + st.prevLoco.u : "") + "|" + st.prevFrame + "|" + st.fade + "|" + st.fadeLen + "|" + (st.up ? st.up.clip + "@" + st.up.frame + "@" + st.up.k : ""); },
      // Foot locking (characters/notes/ANIM-BOUNDS.md, target 1). Each foot has a contact phase read from
      // the clip before any lock: in a gait, its stance (anim/gait.mjs: the phase says which foot is down);
      // otherwise, its ankle within 1.2 cm of where it stands in the idle (released above 2.2 cm). A foot that
      // comes down is pinned where it landed, in the world, and the leg reaches for it by two-bone IK
      // (rig/ik.mjs ikLeg) until its contact ends; then it lets go over six frames. When the body travels
      // away from a pinned foot (a turn's yaw, a stop's root motion, a lunge), the foot takes a short
      // stepping arc to where the clip has it and plants there, instead of skating. On ground that is not
      // flat (actor opts.ground(x, z) -> y), a planted foot sits on the ground under it, a free foot is
      // lifted or lowered with the ground, and the hips come down so the lower foot reaches.
      locksLocal() {
        if (st.footIK === false) return null;   // the control: no runtime foot locks (proto/footlock_check.mjs --ik off)
        const out = {}; let any = false;
        for (const s of ["L", "R"]) { const k = st.locks[s]; if (!k || k.w <= 0) continue; const q = fromWorld(k.at || k.p), e = Math.max(0, Math.min(1, k.w)); out[s] = { p: q, w: e * e * (3 - 2 * e) }; any = true; }
        return any ? out : null;
      },
      contactRef() {
        if (st.yIdle == null) { const S = solveFigure(C, rigOf(who, st.tool), L.pose(who, "idle", 0)); st.yIdle = Math.max(S[INDEX.footL].p[1], S[INDEX.footR].p[1]); }
        return st.yIdle;
      },
      updateLocks(pose) {
        const free = () => { st.locks.L = st.locks.R = null; if (st.adjust?.ground) self.adjust(null, "ground"); };
        if (st.footIK === false) return free();
        if (lying(pose) || (pose.root?.y || 0) > 0.05 || st.clip === "sit") return free();   // seated: the seat fit places the feet; airborne or down: none
        const tags = (n) => L.clips[n]?.tags || [], travels = (n) => tags(n).includes("dodge") || (tags(n).includes("combat") && tags(n).includes("move"));
        const dodge = travels(st.clip) || (st.prev && travels(st.prev));
        const S = solveFigure(C, rigOf(who, st.tool), pose), y0 = self.contactRef(), gnd = st.ground;
        const gait = (st.clip === "walk" || st.clip === "run") && st.v != null && !st.prev;
        const stance = gait ? blendGait(C.P, Math.max(0.3, st.v)).g.stance : 0;
        let drop = 0;
        for (const s of ["L", "R"]) {
          const f = S[INDEX["foot" + s]].p, wf = self.toWorld(f), k = st.locks[s];
          const gy = gnd ? gnd(wf[0], wf[2]) - st.pos[1] : 0;   // the ground under this foot, against the body's own
          drop = Math.max(drop, -gy);
          let contact;
          const pv = st.fkPrev?.[s], sp = pv ? Math.hypot(wf[0] - pv[0], wf[2] - pv[2]) / Math.max(1e-3, st.lockDt || 1 / 60) : 0;
          (st.fkPrev ||= {})[s] = wf;
          if (gait) { const u = ((st.u ?? 0) + (s === "R" ? 0.5 : 0)) % 1; contact = u < stance - 0.01; }
          // a fresh contact also needs the foot to have nearly stopped travelling (under 1 m/s): a blend that
          // drags a foot low across the ground is not a footfall
          else contact = k && !k.float ? f[1] < y0 + 0.022 : f[1] < y0 + 0.012 && sp < 1.0;
          if (dodge && !k) contact = false;   // no new locks in or out of a dodge: the body travels
          const sole = st.pos[1] + y0 - 0.005 + gy;   // the lowest a foot goes: its standing height over the ground under it (a keyed sweep that dips
          // under the floor would otherwise push the whole figure up through the ground fit)
          const want = [wf[0], Math.max(wf[1] + gy, sole), wf[2]];   // where the clip has the foot, on the ground under it
          // clearance: a free foot the clip drags low across the ground (a cross-fade from a stride into a
          // stand, a braking step) is lifted while it travels, so it steps instead of skating; eased up and down
          const cl = (st.clear ||= { L: 0, R: 0 }), lowFast = !gait && !dodge && (!k || k.float) && f[1] < y0 + 0.035 && sp > 1.0;
          const clWant = lowFast ? Math.min(0.06, 0.02 + 0.025 * (sp - 1)) : 0;
          cl[s] = clWant > cl[s] ? Math.min(clWant, cl[s] + 0.015) : Math.max(clWant, cl[s] - 0.008);
          if (cl[s] > 0.004) contact = false;
          if (!contact) {
            if (k && !k.float) { const off = Math.hypot(want[0] - (k.at || k.p)[0], want[2] - (k.at || k.p)[2]); k.w = off < 0.01 && !k.lift ? 0 : k.w - 1 / 6; k.lift = null; if (k.w <= 0) st.locks[s] = null; }   // where the clip's foot is still on the pinned spot (a gait's lift-off) it lets go at once; elsewhere over six frames (0.1 s)
            else if (k) st.locks[s] = null;
            if (!st.locks[s] && ((gnd && Math.abs(gy) > 1e-4) || cl[s] > 1e-4)) st.locks[s] = { p: [want[0], want[1] + cl[s], want[2]], w: 1, float: true };   // a free foot follows the ground and its clearance
            continue;
          }
          // pinned across the ground; its height is the clip's (a heel rising), never below the standing sole, and a
          // foot set down from a clearance lift comes down over a few frames rather than dropping
          if (k && !k.float) { const gk = gnd ? gnd(k.p[0], k.p[2]) - st.pos[1] : 0; k.p[1] = Math.max(Math.max(wf[1], st.pos[1] + y0 - 0.005) + gk, (k.yPrev ?? -1e9) - 0.008); k.yPrev = k.p[1]; }
          if (!k || k.float) { const y = k?.float ? Math.max(want[1], k.p[1] - 0.008) : want[1]; st.locks[s] = { p: [want[0], y, want[2]], w: 1, gait, yPrev: y }; continue; }   // touchdown: pinned where the clip put it
          if (gait) k.gait = true;   // a lock carried in from a blend stays where it is until this stance ends (the leg reaches for it)
          if (k.lift) {   // a catch-up step under way: an arc from the old spot to the clip's
            const L2 = k.lift; L2.t += 1; const t = Math.min(1, L2.t / L2.n), e = t * t * (3 - 2 * t);
            k.at = [L2.from[0] + (want[0] - L2.from[0]) * e, L2.from[1] + (want[1] - L2.from[1]) * e + L2.h * Math.sin(Math.PI * t), L2.from[2] + (want[2] - L2.from[2]) * e];
            if (t >= 1) { k.p = want; k.at = null; k.lift = null; }
            k.w = 1; continue;
          }
          // the body has travelled from the pinned foot: step to where the clip has it
          const far = Math.hypot(want[0] - k.p[0], want[2] - k.p[2]), hipW = self.toWorld(S[INDEX["thigh" + s]].p), reach = Math.hypot(k.p[0] - hipW[0], k.p[1] - hipW[1], k.p[2] - hipW[2]);
          const leg = Math.hypot(...[0, 1, 2].map((i) => S[INDEX["shin" + s]].p[i] - S[INDEX["thigh" + s]].p[i])) + Math.hypot(...[0, 1, 2].map((i) => S[INDEX["foot" + s]].p[i] - S[INDEX["shin" + s]].p[i]));
          const fkReach = Math.hypot(...[0, 1, 2].map((i) => wf[i] - hipW[i]));
          if (far > 0.14 || (!gait && reach > leg * 0.98 && reach > fkReach + 0.01)) { k.lift = { from: [...k.p], t: 0, n: Math.round(Math.max(6, Math.min(12, far * 40))), h: Math.min(0.08, 0.025 + far * 0.25) }; k.at = [...k.p]; }
          k.w = Math.min(1, k.w + 0.5);
        }
        // hips down for the lower foot on a slope (an additive layer, so the clip's own root stays its own)
        const want = Math.min(0.25, gnd ? drop : 0), cur = st.dropS || 0;
        st.dropS = want > cur ? Math.min(want, cur + 0.006) : Math.max(want, cur - 0.003);   // eased: the hips never jump
        if (st.dropS > 1e-4) self.adjust({ root: { y: -st.dropS } }, "ground"); else if (st.adjust?.ground) self.adjust(null, "ground");
      },
      // A held tool kept out of the floor (2026-10-22: Lamb's stick passed through the ground in turns and walks):
      // when the tool's tip or butt would go under the ground, the wrist turns it up by the angle that clears
      // it, eased over a few frames (an additive "floor" layer on handR); a strike's own path is left alone
      floorTool() {
        if (st.tool === "hands" || !T().blade) return;
        const strike = L.clips[st.clip]?.tags?.includes("attack") || (st.up && st.up.k > 0);
        const cur = st.adjust?.floor?.handR?.bend || 0; let want = 0;
        if (!strike) {
          const S = self.skeleton(), w = self.weapon(S), g = (p) => (st.ground ? st.ground(p[0], p[2]) : st.pos[1]) + 0.025;
          const depth = Math.max(g(w.tip) - w.tip[1], g(w.butt) - w.butt[1]);
          if (depth > 0 || cur) {
            // which way the wrist turns the tip up: try a small bend each way from here
            const h = S[INDEX.handR], len = Math.hypot(w.tip[0] - w.grip[0], w.tip[1] - w.grip[1], w.tip[2] - w.grip[2]) || 1;
            const test = (b) => { self.adjust({ handR: { bend: b } }, "floor"); const W2 = self.weapon(self.skeleton()); return Math.min(W2.tip[1] - g(W2.tip), W2.butt[1] - g(W2.butt)); };
            const up = test(cur + 4) > test(cur - 4) ? 1 : -1, need = depth > 0 ? (Math.asin(Math.min(1, depth / len)) / D2R) * 1.15 + 2 : 0;
            want = cur + up * need; if (depth <= 0) want = cur * 0.85;   // clear of the floor: ease back toward the clip's own wrist
          }
        }
        const next = Math.abs(want - cur) > 6 ? cur + Math.sign(want - cur) * 6 : want;
        self.adjust(Math.abs(next) > 0.2 ? { handR: { bend: next } } : null, "floor");
      },
      toWorld(v) { return placeFn(st.facing, st.pos).p(v); },
      // the held tool's grip, tip and butt in the world; S and toW: a skeleton and a placement given (the tool
      // worker measures poses it tries without this actor's state)
      weapon(S = self.skeleton(), toW = self.toWorld) {
        const h = S[INDEX.handR], [a, b] = T().blade || [0.1, 0.8];
        const at = (s) => { const v = apply(h.R, gripAt(s)); return toW([h.p[0] + v[0], h.p[1] + v[1], h.p[2] + v[2]]); };
        const butt = cls() === "long" ? -0.4 : cls() === "heavy" ? -0.3 : -0.06;   // the shaft's end behind the hand
        return { grip: at(a), tip: at(b), butt: at(butt), radius: info.bladeR || 0.05, tool: T().id, cls: cls() };
      },
      body() { const S = self.skeleton(); return { a: self.toWorld(S[INDEX.pelvis].p), b: self.toWorld(S[INDEX.neck].p), radius: info.radius || 0.3 }; },
      // The render, split for the figure workers (runtime/figjob.mjs): prepare() does what needs this
      // actor's state on this thread (the pose, the skin, the smear's last frame, the light's direction)
      // and returns a plain job; renderJob(job, mesh) does the pixels, here or in a worker, the same either way.
      // skinAt "worker": the skinning and the ground contact are left to the job's worker (figjob.mjs
      // resolveSkin): the job carries the solved skeleton, and the smear the last frame's; the same values
      prepare(view, w, h, rig, { ss = 1, bands = 4, tone = null, shadows = true, smear = true, skinAt = "here" } = {}) {
        const lod = lodFor((h * ss) / view.height), m = skinAt === "worker" ? rigOf(who, st.tool) : built(who, lod, st.tool), mkey = `${lod}|${st.tool}`;   // skinned in a worker: no mesh needed here
        const pose = self.pose(), skel = solveFigure(C, m, pose, self.locksLocal()), snap = lying(pose) || !!(L.clips[st.clip] && L.clips[st.clip].grounded);   // a fall or get-up (clip.grounded) keeps its lowest point on the floor throughout
        const prev = st.smear && st.smear.mesh === mkey ? st.smear : null, base = [...st.pos];
        let S = null, dy = null, at = null, sm = null;
        if (skinAt === "worker") {
          sm = prev && smear ? (prev.skel ? { skel: prev.skel, snap: prev.snap, facing: prev.facing, base: prev.base } : { pos: prev.pos, facing: prev.facing, at: prev.at }) : null;
          st.smear = { mesh: mkey, skel, snap, facing: st.facing, base };
        } else {
          S = skin(m.M, m.B, skel); dy = groundShift(m.M, S, PROP_IDS, snap); at = [st.pos[0], st.pos[1] + dy, st.pos[2]];
          if (prev && smear && prev.skel) { const P = skin(m.M, m.B, prev.skel), d = groundShift(m.M, P, PROP_IDS, prev.snap); sm = { pos: P.pos, facing: prev.facing, at: [prev.base[0], prev.base[1] + d, prev.base[2]] }; }   // the last frame went to a worker unskinned
          else sm = prev && smear ? { pos: prev.pos, facing: prev.facing, at: prev.at } : null;
          st.smear = { mesh: mkey, pos: S.pos.slice(), facing: st.facing, at };
        }
        const job = { who, lod, tool: st.tool, view, w, h, ss, bands, tone, shadows, rig, palette: C.palette, facing: st.facing, pos: base, at, dy,
          S: S ? { pos: S.pos, nrm: S.nrm } : null, skel: S ? null : skel, snap, hid: [...hiddenOf(pose, m)], smear: sm,
          shadowDir: shadows ? shadowDir(rig, st.pos) : null, drip: info.drip ? { joints: info.drip, S: self.skeleton(pose), t: (st.dripT = (st.dripT || 0) + 1 / 60) } : null };
        return job;
      },
      mesh(job) { return built(job.who, job.lod, job.tool); },
      // pool: the G-buffer and the shading arrays are the actor's own, reused every frame (the result is
      // only good until the next render of this actor); without it every call allocates, as before
      render(view, w, h, rig, opts = {}) {
        const t = tick(), job = self.prepare(view, w, h, rig, opts); tock("skin", t);
        return renderJob(job, built(job.who, job.lod, job.tool), opts.pool ? (st.buf ||= {}) : null);
      },
    };
    return self;
  }
  return { actor, clips, library: L };
}
