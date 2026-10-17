// Combat drives the animation; the art supplies timings as data (design/NOTES-FOR-ENGINEER.md,
// "Combat and animation: the interface").
//
// Gameplay frames are the authority. Each move names an animation (move.anim, default the move
// id). For an actor, the clip is the @anim record `<actor>.<anim>` (world/anim.mjs). The clip's
// phases named windup, active and recovery mark where the art's key poses fall; combat warps
// clip time piecewise so the clip's windup ends on the move's last startup frame and its active
// span covers the move's active frames. A clip without those phases plays in proportion. So an
// animator can retime a clip freely and the fight never changes; a designer can retime a move and
// the clip follows.
//
// Outside moves: idle, walk, wade, guard (the block stance), by state and speed.
// poseOf() is what a renderer reads each frame; checkClips() lists every move whose clip is
// missing or whose phases disagree with the frames by more than a tolerance.
import { phaseOf, FPS } from "../sim/moves.mjs";

const LOCO = { idle: "idle", walk: "walk", wade: "wade", guard: "guard" };

export function actorOf(W, F) {
  const d = W.defs[F.id];
  return d.char || d.style || d.kind;
}

function locomotion(W, F) {
  const sp = Math.hypot(F.vx, F.vz), foot = W.field.footing(F.x, F.z);
  if (F.guardT > 0) return LOCO.guard;
  if (sp < 0.2) return LOCO.idle;
  return foot.band === "knee" || foot.band === "waist" ? LOCO.wade : LOCO.walk;
}

// Clip time in seconds for move frame f, given the clip (or null for a proportional placeholder).
export function warp(m, f, clip) {
  const len = clip ? clip.length : m.total / FPS;
  const ph = clip ? Object.fromEntries(clip.phases.map((p) => [p.name, p])) : {};
  if (!ph.windup || !ph.active) return (len * Math.min(f, m.total)) / m.total;
  const a1 = m.startup, a2 = m.startup + m.active, c1 = ph.windup.to, c2 = ph.active.to;
  // a telegraph reads as a held pose then a sharp strike: slow first, fast last (COMBAT-FEEL v2 6)
  // a clip with a sweep phase (the swing's travel) plays it over the move's sweep frames, the end of
  // the wind-up, so the active frames show only contact; the wind-up before it holds the tell
  if (ph.sweep && m.sweep && f <= a1) {
    const s1 = m.sweep[0], b1 = ph.sweep.from;
    if (f <= s1) return b1 * (m.tell ? Math.pow(f / Math.max(1, s1), 1.8) : f / Math.max(1, s1));
    return b1 + ((c1 - b1) * (f - s1)) / Math.max(1, a1 - s1);
  }
  if (f <= a1) return c1 * (m.tell ? Math.pow(f / Math.max(1, a1), 1.8) : f / Math.max(1, a1));
  if (f <= a2) return c1 + ((c2 - c1) * (f - a1)) / Math.max(1, a2 - a1);
  return c2 + ((len - c2) * (f - a2)) / Math.max(1, m.total - a2);
}

// A dodge's direction against the facing: f, b, l or r (the art's dodge_f/b/l/r).
export function side(F) {
  const d = Math.atan2(Math.sin(F.act.dir - F.face), Math.cos(F.act.dir - F.face)), q = Math.PI / 4;
  return Math.abs(d) <= q ? "f" : Math.abs(d) >= 3 * q ? "b" : d > 0 ? "r" : "l";
}

// What to draw for this fighter this frame.
export function poseOf(W, F, clips = {}) {
  const actor = actorOf(W, F);
  if (!F.act) { const name = locomotion(W, F); return { actor, anim: name, clip: `${actor}.${name}`, loop: true, phase: "free", f: 0, u: 0, t: null }; }
  const m = W.moves[F.act.id], anim = m.kind === "dodge" ? `${m.anim}_${side(F)}` : m.anim, id = `${actor}.${anim}`, clip = clips[id] || clips[`${actor}.${m.anim}`] || null;
  const f = F.act.charging ? m.charge.at : F.act.f;
  // the clip's playback rate: how fast this body plays the clip, from its tempo (sim/tempo.mjs);
  // with t driven from the frames the two never drift, and rate tells the renderer the speed
  const len = clip ? clip.length : (m.baseTotal || m.total) / FPS, rate = len / Math.max(1 / FPS, F.act.end / FPS);
  return { actor, anim, clip: id, loop: false, phase: phaseOf(m, f), f, u: f / m.total, t: warp(m, f, clip), rate: +rate.toFixed(3), charging: !!F.act.charging, have: !!clip, kind: m.kind };
}

// Every move a fighter can make, checked against the clips: missing clips, and clips whose
// windup or active end is more than tol seconds from the move's frames when played unwarped.
export function checkClips(W, clips, { tol = 2 / FPS } = {}) {
  const out = [];
  for (const F of W.fighters) {
    const actor = actorOf(W, F);
    for (const id of W.defs[F.id].moves) {
      const m = W.moves[id], cid = `${actor}.${m.anim}`, c = clips[cid];
      if (!c) { out.push({ actor, move: id, clip: cid, problem: "missing" }); continue; }
      const ph = Object.fromEntries(c.phases.map((p) => [p.name, p]));
      if (!ph.windup || !ph.active) { out.push({ actor, move: id, clip: cid, problem: "no windup or active phase (plays in proportion)" }); continue; }
      const dw = Math.abs(ph.windup.to - m.startup / FPS), da = Math.abs(ph.active.to - (m.startup + m.active) / FPS);
      if (dw > tol || da > tol) out.push({ actor, move: id, clip: cid, problem: `timing differs: windup ${dw.toFixed(3)} s, active ${da.toFixed(3)} s (warped to fit)` });
    }
  }
  return out;
}
