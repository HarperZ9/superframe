// The prop on every inner ground (combat/data/props.mjs): one heavy thing the boss can be baited into. A committed
// blow (one that breaks a guard, carries the boss forward or seizes) that brings the boss's body onto the prop in its
// active frames smashes it, and the boss reels (`inner.reel`, REEL.frames): the fight's punish window, earned by
// spacing. The prop stands again at the start of each phase. Nothing here is a count on screen.
//   installProp(W, flaw)   propStep(W)   REEL
import { dhypot } from "../sim/math.mjs";
import { startMove } from "../sim/fighter.mjs";
import { REEL } from "../data/innermoves.mjs";
import { PROPS } from "../data/props.mjs";

export { REEL };

// a move that commits the boss's body: a guard-breaker, a gap closer or a grab
const committed = (m) => !!m && (m.guardBreak || m.blockable === false || (m.root || []).some(([, , v]) => v >= 3));

export function installProp(W, flaw) {
  const A = W.field.arena, P = PROPS[flaw.arena], at = (A.anchors.prop || (P && [P.at]) || [])[0];
  if (!at || !W.moves[REEL.id]) return null;
  W.inner.prop = { at: [at[0], at[1]], up: true, broken: 0, name: P ? P.name : "the post" };
  return W.inner.prop;
}

// a new phase stands the prop again
export function propPhase(W) { if (W.inner.prop) W.inner.prop.up = true; }

export function propStep(W) {
  const P = W.inner && W.inner.prop; if (!P || !P.up) return;
  const B = W.byId("boss"); if (!B || B.out || B.fallen || !B.act) return;
  const m = W.moves[B.act.id]; if (!committed(m) || B.act.f < m.startup || B.act.f >= m.startup + (m.active || 1)) return;
  if (dhypot(B.x - P.at[0], B.z - P.at[1]) > REEL.r + (W.defs.boss.radius || 0.5)) return;
  P.up = false; P.broken++; B.vx = 0; B.vz = 0;
  W.emit({ type: "prop.break", id: "boss", move: B.act.id });
  startMove(W, B, REEL.id); B.hitstop = Math.max(B.hitstop || 0, 8);
}
