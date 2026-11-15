// The inner arena's ground as a threat (design/COMBAT-SPEC.md 12, the rework of 2026-10-23): hazards with a tell,
// terrain that changes by phase, and attacks the room itself makes. Every hazard shows its mark on the floor for
// its lead (30 frames or more, COMBAT-SPEC T9 for unparryable blows) before it strikes, and a roll's safe frames
// pass through it as through any blow. A phase lists its hazards; a boss move can call one as it starts.
//   kinds   spot   a circle at the player, an anchor or a scatter round the player (falling beams, a burst of mud)
//           lane   a band across the room along x or z (a cart down the road, a sweep of the table)
//           ring   a circle that closes on its centre from outside (the ice cracking in)
//   ground  rows changed by a phase: `close` n (the bowl), `cells` { ch, at: [[x, z, r]] } (mud pits, ice), `wall`
//   phase.hazards: [{ kind, every, first, n, at, r, lead, active, dmg, poise, knock, knockdown, both, w, from }]
//   move.hazard: the same record, fired on the move's first active frame from the boss's own place or facing
//   installHazards(W)   stepHazards(W, phaseIdx, phases)   W.inner.hazards (for the drawer and the measures)
import { applyHit } from "../sim/hits.mjs";
import { within } from "../sim/moves.mjs";
import { settleClear } from "../sim/fighter.mjs";
import { rand01 } from "../../core/rng.mjs";
import { dcos, dsin, dhypot } from "../sim/math.mjs";

export const HAZ = { minLead: 30, active: 6 };
const LEGEND = { m: { surface: "mud", h: 60 }, f: { surface: "frost", h: 60 }, X: { surface: "stone", h: 60, solid: true } };

export function installHazards(W) {
  const A = W.field.arena; A.legend = { ...LEGEND, ...A.legend };
  W.inner.hazards = []; W.inner.hazNext = {}; W.inner.hazN = 0;
}

// one frame: due phase hazards are laid, laid ones strike when their lead runs out, spent ones go
export function stepHazards(W, P, ev) {
  const I = W.inner; if (!I.hazards) return;
  if (P) for (const [k, h] of (P.hazards || []).entries()) {
    const key = `${I.phase}:${k}`; I.hazNext[key] ??= W.tick + (h.first ?? h.every);
    if (W.tick >= I.hazNext[key]) { I.hazNext[key] = W.tick + h.every; lay(W, h); }
  }
  for (const e of ev) if (e.type === "move" && W.moves[e.move] && W.moves[e.move].hazard) { const B = W.byId(e.id); if (B) lay(W, W.moves[e.move].hazard, B, W.moves[e.move].startup); }
  for (const H of I.hazards) if (!H.done && W.tick >= H.hitAt && W.tick < H.hitAt + H.active) strike(W, H);
  I.hazards = I.hazards.filter((H) => W.tick < H.hitAt + H.active);
}

// where a hazard falls: on the player (with a scatter), at an anchor, along the boss's facing, or anywhere open
function lay(W, h, B = null, delay = 0) {
  const I = W.inner, L = W.lamb(), b = W.field.bounds, n = h.n || 1;
  for (let k = 0; k < n; k++) {
    const u = rand01(W.seed ^ 0x4a2, `${I.hazN}:${k}:${W.tick}`), v = rand01(W.seed ^ 0x4a3, `${I.hazN}:${k}:${W.tick}`);
    let x = L.x, z = L.z;
    if (h.at === "boss" && B) { x = B.x + dcos(B.face) * (h.ahead || 0); z = B.z + dsin(B.face) * (h.ahead || 0); }
    else if (typeof h.at === "string" && h.at.startsWith("anchor:")) { const pts = W.field.arena.anchors[h.at.slice(7)] || [[x, z]]; [x, z] = pts[(I.hazN + k) % pts.length]; }
    else if (h.at === "open") { x = b.x0 + 1 + u * (b.x1 - b.x0 - 2); z = b.z0 + 1 + v * (b.z1 - b.z0 - 2); }
    else if (h.scatter) { x += (u - 0.5) * 2 * h.scatter; z += (v - 0.5) * 2 * h.scatter; }
    if (h.kind === "spot" && W.field.solid(x, z)) continue;
    const H = { n: I.hazN++, kind: h.kind, x, z, r: h.r || 1.2, axis: h.axis || "x", w: h.w || 1.6, lead: Math.max(HAZ.minLead, h.lead || 36), active: h.active || HAZ.active,
      dmg: h.dmg ?? 1, poise: h.poise ?? 3, knock: h.knock ?? 2, knockdown: !!h.knockdown, both: !!h.both, owner: B ? B.id : "boss", id: h.id || h.kind, hit: [] };
    H.laidAt = W.tick; H.hitAt = W.tick + Math.max(H.lead, delay);
    if (H.kind === "lane") { if (H.axis === "x") H.z = z; else H.x = x; }
    I.hazards.push(H); W.emit({ type: "hazard.tell", id: H.id, n: H.n, kind: H.kind, x: +x.toFixed(2), z: +z.toFixed(2), lead: H.hitAt - W.tick });
  }
}

const inside = (W, H, F) => {
  if (H.kind === "spot") return dhypot(F.x - H.x, F.z - H.z) <= H.r + 0.3;
  if (H.kind === "lane") return H.axis === "x" ? Math.abs(F.z - H.z) <= H.w / 2 : Math.abs(F.x - H.x) <= H.w / 2;
  if (H.kind === "ring") { const d = dhypot(F.x - H.x, F.z - H.z); return d >= H.r && d <= H.r + 1.4; }
  return false;
};

function strike(W, H) {
  const owner = W.byId(H.owner) || W.lamb();
  const m = { id: `haz:${H.id}`, dmg: H.dmg, poise: H.poise, knock: H.knock, hitstop: 6, shake: 0.4, knockdown: H.knockdown, blockable: false, parryable: false, guardBreak: false, grapple: false, toward: null, kind: "attack", startup: 0 };
  for (const F of W.fighters) {
    if (F.out || F.hp <= 0 || H.hit.includes(F.id) || (F.team !== "lamb" && !H.both)) continue;
    if (!inside(W, H, F)) continue;
    const tm = F.act && W.moves[F.act.id];
    if (tm && within(tm.iframes, F.act.f)) { if (!H.hit.includes(`e:${F.id}`)) { H.hit.push(`e:${F.id}`); W.emit({ type: "evade", id: F.id, by: H.owner, move: m.id }); } continue; }
    H.hit.push(F.id); applyHit(W, owner === F ? W.lamb() : owner, F, m, { x: H.x, z: H.z });
    W.emit({ type: "hazard.hit", id: H.id, n: H.n, on: F.id });
  }
}

// a phase's ground: cells turned to mud or frost round given points, walls pushed in; bodies stepped clear
export function changeGround(W, G) {
  if (!G) return;
  const A = W.field.arena;
  if (G.cells) A.rows = A.rows.map((r, z) => [...r].map((ch, x) => (ch !== "K" && ch !== "D" && G.cells.at.some(([cx, cz, cr]) => dhypot(x + 0.5 - cx, z + 0.5 - cz) <= cr) ? G.cells.ch : ch)).join(""));
  if (G.walls) A.rows = A.rows.map((r, z) => [...r].map((ch, x) => (G.walls.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1) ? "X" : ch)).join(""));
  for (const F of W.fighters) { const b = W.field.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2; for (let k = 0; k < 40 && W.field.solid(F.x, F.z); k++) { const d = dhypot(cx - F.x, cz - F.z) || 1; F.x += ((cx - F.x) / d) * 0.25; F.z += ((cz - F.z) / d) * 0.25; } settleClear(W, F); }
  W.emit({ type: "ground", cells: !!G.cells, walls: !!G.walls });
}
