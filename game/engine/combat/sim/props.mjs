// Props: the setups a tools build makes before or during a fight (2026-10-17 author direction).
//
//   lamp x z         the arena light nearest (x, z) can be put out with "interact" within reach;
//                    out, it stops lighting (sight shrinks for everyone near it, sodium eyes go
//                    blind there). `cut x z` starts it out.
//   sluice x z x0 z0 x1 z1 rise
//                    a lever at (x, z): interacting opens it; 40 frames later the zone floods by
//                    `rise` metres. Everyone standing in the zone at the surge is knocked down and
//                    takes 0.5 Standing; a light opponent left at waist depth is swept away (out of
//                    the fight, not dead). `flood x0 z0 x1 z1 rise` starts the zone flooded.
//   snare x z        a rigged rope: the first opponent to step within 0.7 m is snared (down for
//                    two and a half seconds, open to a free strike) and the rope is spent
//
// Encounter records name props with conditions on the game state (encounter.mjs):
//   prop: snare 9.5 6.5 ? has(floor.rope_rigged)
// A prop written at 0 0 is placed by the arena's anchors (anchorProps): `cut` puts out every
// light the anchor lists, the others go to the anchor's first point. With no anchor a cut takes
// every arena light and a lamp the first; a snare or sluice with no anchor is left out.
import { startMove, dist } from "./fighter.mjs";

export const PROPS = { reach: 1.4, surge: 40, snareR: 0.7, snareFrames: 150, sweepDepth: 0.85, surgeDmg: 0.5 };

const inZone = (F, z) => F.x >= z[0] && F.x <= z[2] && F.z >= z[1] && F.z <= z[3];

// Parse one prop line's words into a prop. Returns null for an unknown kind.
export function parseProp(words) {
  const [kind, ...a] = words, n = a.map(Number);
  if (kind === "lamp" || kind === "cut") return { kind: "lamp", x: n[0], z: n[1], on: kind === "lamp" };
  if (kind === "sluice") return { kind: "sluice", x: n[0], z: n[1], zone: n.slice(2, 6), rise: n[6] || 0.6, open: false, at: null };
  if (kind === "flood") return { kind: "sluice", x: null, z: null, zone: n.slice(0, 4), rise: n[4] || 0.6, open: true, at: -1 };
  if (kind === "snare") return { kind: "snare", x: n[0], z: n[1], armed: true };
  return null;
}

// Props written at 0 0 go where the arena says (data/arenas.mjs, arenas2.mjs: anchors).
export function anchorProps(arena, props) {
  const out = [], A = arena.anchors || {}, lights = (arena.lights || []).map((l) => [l.x, l.z]);
  for (const p of props) {
    if (!p) continue;
    const placed = p.x === 0 && p.z === 0 && !(p.kind === "sluice" && p.zone.some((v) => v !== 0));
    if (!placed) { out.push(p); continue; }
    const key = p.kind === "lamp" && !p.on ? "cut" : p.kind;
    const pts = A[key] || (key === "cut" ? lights : key === "lamp" ? lights.slice(0, 1) : []);
    const use = key === "cut" ? pts : pts.slice(0, 1);
    for (const [x, z] of use) out.push({ ...p, x, z });
  }
  return out;
}

// Fit props to the world: a lamp prop takes over the nearest arena light; floods already open
// raise their zone's water at once.
export function installProps(W, props) {
  W.props = props.map((p, i) => ({ ...p, n: i }));
  for (const p of W.props) {
    if (p.kind === "lamp") {
      const ls = W.field.arena.lights || [];
      let best = -1, bd = Infinity;
      ls.forEach((l, i) => { const d = Math.hypot(l.x - p.x, l.z - p.z); if (d < bd) { bd = d; best = i; } });
      p.light = best;
      if (best >= 0 && !p.on) ls[best].off = true;
    }
    if (p.kind === "sluice" && p.open) W.field.floods.push({ zone: p.zone, add: p.rise });
  }
}

// Lamb's "interact": the nearest prop in reach that can still be worked.
export function interact(W, F) {
  const near = (W.props || []).filter((p) => p.x != null && Math.hypot(p.x - F.x, p.z - F.z) <= PROPS.reach && usable(p)).sort((a, b) => Math.hypot(a.x - F.x, a.z - F.z) - Math.hypot(b.x - F.x, b.z - F.z));
  const p = near[0];
  if (!p) { W.emit({ type: "interact", id: F.id, prop: null }); return null; }
  if (p.kind === "lamp") { const l = W.field.arena.lights[p.light]; if (l) l.off = true; p.on = false; W.emit({ type: "lightcut", id: F.id, prop: p.n, x: p.x, z: p.z }); }
  if (p.kind === "sluice") { p.open = true; p.at = W.tick + PROPS.surge; W.emit({ type: "sluice", id: F.id, prop: p.n, frames: PROPS.surge }); }
  return p;
}

const usable = (p) => (p.kind === "lamp" ? p.on : p.kind === "sluice" ? !p.open : false);

// Each frame: a sluice reaching its surge floods its zone; snares catch the unwary.
export function stepProps(W) {
  for (const p of W.props || []) {
    if (p.kind === "sluice" && p.open && p.at === W.tick) surge(W, p);
    if (p.kind === "snare" && p.armed) snare(W, p);
  }
}

function surge(W, p) {
  W.field.floods.push({ zone: p.zone, add: p.rise });
  W.emit({ type: "surge", prop: p.n });
  W.emit({ type: "shake", amp: 0.5, frames: 20 });
  for (const F of W.fighters) {
    if (F.out || F.fallen || !inZone(F, p.zone)) continue;
    F.hp = Math.max(0, F.hp - PROPS.surgeDmg);
    const light = W.defs[F.id].load === "light" || W.defs[F.id].style === "skirmisher";
    if (F.team !== "lamb" && light && W.field.depthAt(F.x, F.z) >= PROPS.sweepDepth) { F.hp = 0; startMove(W, F, "fall"); W.emit({ type: "swept", id: F.id }); continue; }
    if (F.hp <= 0) { startMove(W, F, "fall"); W.emit({ type: "fall", id: F.id, by: "sluice" }); continue; }
    startMove(W, F, "knockdown"); W.emit({ type: "knockdown", id: F.id, by: "sluice" });
  }
}

function snare(W, p) {
  for (const F of W.fighters) {
    if (F.team === "lamb" || F.out || F.fallen || F.hp <= 0 || dist(F, p) > PROPS.snareR) continue;
    p.armed = false;
    startMove(W, F, "snared"); F.aware = true;
    W.emit({ type: "snared", id: F.id, prop: p.n });
    return;
  }
}
