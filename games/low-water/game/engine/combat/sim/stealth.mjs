// Openings and awareness: a fight can begin from a sneak, from an alert, or in the open.
//
//   open      a confrontation: opponents know where Lamb stood at the start (the default)
//   sneak     opponents are unaware and face away; Lamb's lantern starts shuttered. An unaware
//             opponent notices Lamb by sight (in its front cone, at the light rule's range, over a
//             fraction of a second) or by noise (a roll within 5 m; any blow landing or body
//             falling within 10 m). One who notices calls the others within 8 m. From behind and close, a
//             light press on an unaware opponent is a takedown: the small go down at once, the big
//             take a heavy free strike and are knocked down. Any first blow on an unaware body
//             lands double.
//   alerted   the stealth layer handed over an alert: opponents are aware and search from the
//             place Lamb was last seen; nobody gets a free strike
//
// Lamb can shutter or unshutter the lantern at any time (action "lantern"): a lit lantern helps
// Lamb see and lets everyone see Lamb.
import { wrapAngle, angleTo, dist } from "./fighter.mjs";

export const STEALTH = { cone: 70, noticeFrames: 36, noise: 5, fightNoise: 10, call: 8, callDelay: 30, decay: 0.01, behind: 110, takedownRange: 1.5, smallStanding: 10 };
const DEG = 180 / Math.PI;
const live = (F) => !F.out && !F.fallen && !F.yielded && F.hp > 0;

// Set the fight's opening on a fresh world. lastSeen: [x, z] for an alert (default Lamb's spot).
export function applyOpening(W, opening = "open", { lastSeen = null } = {}) {
  W.opening = opening;
  const L = W.lamb();
  for (const F of W.fighters) {
    if (F.team === L.team) continue;
    if (opening === "sneak") { F.aware = false; F.notice = 0; F.face = angleTo(L, F); }
    if (opening === "alerted") { const at = lastSeen || [L.x, L.z]; F.mem = { ...(F.mem || {}), seen: { x: at[0], z: at[1], t: 0 } }; }
    // an open fight begins with a confrontation: they know where Lamb stood, then sight rules
    if (opening === "open") F.mem = { ...(F.mem || {}), seen: { x: L.x, z: L.z, t: 0 } };
  }
  if (opening === "sneak") L.lantern = 0;
  W.emit({ type: "opening", opening });
}

export const unaware = (F) => F.aware === false;

// Each frame: unaware opponents look and listen; noise and blows nearby wake them.
export function stepAwareness(W) {
  const L = W.lamb(); if (!L) return;
  const loud = noise(W, L);
  for (const F of W.fighters) {
    if (!unaware(F) || !live(F)) continue;
    const d = dist(F, L), inCone = Math.abs(wrapAngle(angleTo(F, L) - F.face)) * DEG <= STEALTH.cone;
    const sees = inCone && W.visible(F, L), near = Math.max(0.2, 1 - d / Math.max(2, W.field.seenRange(W.field.lightAt(L.x, L.z, W.lampsNow))));
    if (sees) F.notice += near / STEALTH.noticeFrames; else F.notice = Math.max(0, F.notice - STEALTH.decay);
    if (loud.some(([x, z, r]) => Math.hypot(F.x - x, F.z - z) <= r)) F.notice = 1;
    if (F.notice >= 1) alert(W, F, sees ? "sight" : "noise");
  }
  for (const F of W.fighters) if (unaware(F) && F.calledAt != null && W.tick >= F.calledAt) alert(W, F, "called");
}

// Noises this frame: Lamb rolling (5 m); any blow landing or body falling (10 m). A strike is
// heard when it lands, not when it is drawn back, so a takedown is silent until it connects.
function noise(W, L) {
  const out = [];
  if (L.act && W.events.some((e) => e.type === "move" && e.id === L.id && W.moves[e.move].kind === "dodge")) out.push([L.x, L.z, STEALTH.noise]);
  for (const e of W.events) if (["hit", "fall", "knockdown", "flinch"].includes(e.type)) { const T = W.byId(e.id); if (T) out.push([T.x, T.z, STEALTH.fightNoise]); }
  return out;
}

export function alert(W, F, why) {
  if (!unaware(F)) return;
  F.aware = true; F.notice = 1;
  const L = W.lamb();
  F.mem = { ...(F.mem || {}), seen: { x: L.x, z: L.z, t: W.tick } };
  W.emit({ type: "alert", id: F.id, why });
  for (const G2 of W.fighters) if (unaware(G2) && G2.team === F.team && dist(G2, F) <= STEALTH.call && G2.calledAt == null) G2.calledAt = W.tick + STEALTH.callDelay;
}

// An unaware opponent behind and close enough for a takedown.
export function takedownTarget(W, F) {
  for (const T of W.fighters) {
    if (T.team === F.team || !live(T) || !unaware(T) || dist(F, T) > STEALTH.takedownRange) continue;
    const behind = Math.abs(wrapAngle(angleTo(T, F) - T.face)) * DEG >= STEALTH.behind;
    const facing = Math.abs(wrapAngle(angleTo(F, T) - F.face)) * DEG <= 70;
    if (behind && facing) return T;
  }
  return null;
}

// What a takedown does: the small (Standing up to smallStanding) go down; the big take a free
// heavy blow and a knockdown.
export function takedownFor(W, T) {
  return W.defs[T.id].hp <= STEALTH.smallStanding ? "out" : "strike";
}

export const SNEAK_BONUS = 2;
