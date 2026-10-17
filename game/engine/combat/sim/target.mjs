// Seeing and choosing targets: lock-on, soft targeting and the riposte check. Everything goes
// through the field's sight rule, so in fog or the dark a fighter cannot lock what it cannot see,
// and neither can the enemy.
import { RULES } from "../data/common.mjs";
import { wrapAngle, angleTo, dist } from "./fighter.mjs";
import { beamAt } from "./field.mjs";
import { WORLD } from "../data/world.mjs";

const DEG = 180 / Math.PI;
const alive = (F) => !F.out && !F.fallen && !F.yielded && F.hp > 0;

// Carried lanterns and lanterns burning on the ground.
export function lamps(W) {
  W.groundLights = W.groundLights.filter((L) => L.until > W.tick);
  return [...W.fighters.filter((F) => F.lantern > 0 && alive(F)).map((F) => ({ x: F.x, z: F.z, r: F.lantern, k: 0.45 })), ...W.groundLights];
}

// Can A see (or otherwise find) B? Eyes: B's light against the fog. Sodium-trained eyes see
// further under sodium and less in the dark. A nose finds a body upwind (the wind carries it)
// and anything at arm's length (5 m in still air, where scent pools), whatever the light. Mud in the eyes cuts sight; Dread narrows
// Lamb's view (def.view).
export function visible(W, A, B) {
  const def = W.defs[A.id], d = Math.hypot(B.x - A.x, B.z - A.z), f = W.field;
  if (!f.sightClear(A.x, A.z, B.x, B.z)) return d <= 1.2 && def.sight === "smell";
  if (def.sight === "smell") return d <= (f.terms.windSpeed < 1 ? 5 : 2.5) || downwind(f, A, B, d);
  // a body in Mother's beam stands out against the lit fog, whatever the fog (data/world.mjs beam)
  if (WORLD.beam.reveal && d <= WORLD.beam.reveal && beamAt(f, B.x, B.z) > 0) return true;
  let range = f.seenRange(f.lightAt(B.x, B.z, W.lampsNow || lamps(W))) * (def.view || 1);
  if (def.sight === "sodium") range *= f.sodiumAt(B.x, B.z) ? 1.4 : 0.6;
  if (A.blind > 0) range *= 0.35;
  return d <= Math.max(1.2, range);
}

// B is upwind of A: the wind blows from B toward A, within 12 m.
function downwind(f, A, B, d) {
  const w = Math.hypot(f.terms.windX, f.terms.windZ);
  if (w < 1 || d > 12) return false;
  return ((A.x - B.x) * f.terms.windX + (A.z - B.z) * f.terms.windZ) / (d * w) > 0.7;
}
const foesOf = (W, F) => W.fighters.filter((T) => T.team !== F.team && alive(T) && visible(W, F, T));

// The best target near a direction, for aim assist when nothing is locked.
export function softTarget(W, F, angle) {
  let best = null, score = Infinity;
  for (const T of foesOf(W, F)) {
    const d = dist(F, T), off = Math.abs(wrapAngle(angleTo(F, T) - angle)) * DEG;
    if (d > RULES.softRange || off > RULES.softCone) continue;
    const s = d + off / 30;
    if (s < score) { score = s; best = T; }
  }
  return best;
}

// A parried enemy in front and in reach: a light press becomes a riposte.
export function riposteTarget(W, F) {
  for (const T of W.fighters) {
    if (T.team === F.team || !alive(T) || !T.act || T.act.id !== "parried" || T.act.f > 52) continue;
    if (dist(F, T) > RULES.riposteRange) continue;
    if (Math.abs(wrapAngle(angleTo(F, T) - F.face)) * DEG <= RULES.riposteCone) return T;
  }
  return null;
}

// Toggle lock: the visible enemy nearest the facing, weighted by distance.
export function toggleLock(W, F) {
  if (F.lock != null) { F.lock = null; W.emit({ type: "lock", id: F.id, target: null }); return null; }
  let best = null, score = Infinity;
  for (const T of foesOf(W, F)) {
    const d = dist(F, T);
    if (d > RULES.lockRange) continue;
    const s = Math.abs(wrapAngle(angleTo(F, T) - F.face)) * DEG / 20 + d;
    if (s < score) { score = s; best = T; }
  }
  F.lock = best ? best.id : null; F.lockLost = 0;
  W.emit({ type: "lock", id: F.id, target: F.lock });
  return best;
}

// Switch lock to the next visible enemy clockwise (+1) or anticlockwise (-1) around the fighter.
export function switchLock(W, F, sign) {
  const cur = F.lock != null && W.byId(F.lock);
  if (!cur) return toggleLock(W, F);
  const base = angleTo(F, cur);
  let best = null, gap = Infinity;
  for (const T of foesOf(W, F)) {
    if (T.id === cur.id || dist(F, T) > RULES.lockRange) continue;
    let d = wrapAngle(angleTo(F, T) - base) * sign;
    if (d <= 0) d += Math.PI * 2;
    if (d < gap) { gap = d; best = T; }
  }
  if (best) { F.lock = best.id; F.lockLost = 0; W.emit({ type: "lock", id: F.id, target: F.lock }); }
  return best;
}

// Drop a lock on a body that is gone, or that has been out of sight too long.
export function keepLock(W, F) {
  if (F.lock == null) return;
  const T = W.byId(F.lock);
  if (!T || !alive(T)) { F.lock = null; W.emit({ type: "lock", id: F.id, target: null }); return; }
  F.lockLost = visible(W, F, T) ? 0 : F.lockLost + 1;
  if (F.lockLost > RULES.lockLost || dist(F, T) > RULES.lockRange * 1.4) { F.lock = null; W.emit({ type: "lock", id: F.id, target: null }); }
}
