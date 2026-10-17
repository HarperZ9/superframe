// What the ground does to a body (design/COMBAT-WORLD.md): ledges stop a walk but not a knockback
// or a roll, and a body carried over one falls; nets and ropes trip a body that runs or rolls over
// them; slopes slow the feet. Both sides obey the same rules: a shove that sends an opponent off the
// quay is as real as a roll that takes Lamb off it. Values: data/world.mjs.
import { WORLD } from "../data/world.mjs";
import { stepDrop, terrainAt } from "./terrain.mjs";
import { startMove } from "./fighter.mjs";

// Is this body carried (a knockback or a dodge's root motion), rather than walking?
const carried = (W, F) => Math.hypot(F.kx, F.kz) > 1.5 || (F.act && W.moves[F.act.id].kind === "dodge");

// A move from (F.x, F.z) to (nx, nz) on one axis: true when it may happen. A climb never may; a
// drop only when carried, and it is remembered so the fall lands after the move.
export function mayStep(W, F, nx, nz) {
  const d = stepDrop(W.field.arena, F.x, F.z, nx, nz);
  if (d === 0) return true;
  if (d < 0 || !carried(W, F)) return false;
  F.dropped = Math.max(F.dropped || 0, d);
  return true;
}

// The fall, once the body has gone over: into water it goes under and loses Breath; onto ground it
// goes down, and a long drop hurts (more for an opponent: a ledge cuts both ways).
export function land(W, F) {
  const drop = F.dropped; F.dropped = 0;
  if (!drop || F.out || F.fallen) return;
  const R = WORLD.fall, deep = W.field.depthAt(F.x, F.z) >= 0.4, foe = F.team !== "lamb";
  F.kx *= 0.3; F.kz *= 0.3;
  if (deep) {
    F.st = Math.max(0, F.st - R.waterBreath); F.stWait = W.defs[F.id].staminaDelay * 2;
    startMove(W, F, "ducked");
    W.emit({ type: "ledgefall", id: F.id, drop: +drop.toFixed(2), into: "water" });
    return;
  }
  const dmg = Math.max(0, drop - R.hurtFrom) * R.perMetre * (foe ? R.foeScale : 1);
  F.hp = Math.max(0, F.hp - dmg);
  W.emit({ type: "ledgefall", id: F.id, drop: +drop.toFixed(2), into: "ground", dmg: +dmg.toFixed(2) });
  W.emit({ type: "shake", amp: Math.min(0.8, 0.2 + drop * 0.15), frames: 12, dir: [0, 1], spring: { k: 220, damp: 16 } });
  if (F.hp <= 0) { startMove(W, F, "fall"); W.emit({ type: "fall", id: F.id, by: F.lastHitBy }); return; }
  if (drop >= R.knockdown) { F.buf = []; startMove(W, F, "knockdown"); }
}

// A net or a rope underfoot trips a body that runs or rolls across it (once in a while).
export function trip(W, F) {
  if (F.out || F.fallen) return;
  const t = terrainAt(W.field.arena, F.x, F.z);
  if (!t.hazard || !(WORLD.hazards[t.hazard] || {}).trip) return;
  const rolling = F.act && W.moves[F.act.id].kind === "dodge";
  if (!(F.running || rolling) || W.tick - (F.tripAt ?? -1e9) < WORLD.trip.guard) return;
  F.tripAt = W.tick; F.buf = [];
  startMove(W, F, "stagger");
  W.emit({ type: "trip", id: F.id, hazard: t.hazard });
}

// Is this body engaged: an opponent standing and aware within WORLD.run.engageRange?
export function engaged(W, F) {
  for (const O of W.fighters) if (O.team !== F.team && !O.out && !O.fallen && !O.yielded && O.aware !== false && Math.hypot(O.x - F.x, O.z - F.z) <= WORLD.run.engageRange) return true;
  return false;
}
