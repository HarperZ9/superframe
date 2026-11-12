// How opponents answer a Lamb who keeps away (design/COMBAT-WORLD.md; reference behaviour from
// cleanroom/spec/WORLD-COMBAT-CONSTRAINTS.md sections 2 to 5, in our own expression and scale).
//
//   the kiting clock  each opponent keeps its own count of how long Lamb has stayed out of its
//                     reach while moving away from it (or stood far out of reach). Standing in the
//                     fight drains it twice as fast as it fills, so spacing between exchanges never
//                     reaches it; retreat-and-poke does.
//   the answers       once the clock passes WORLD.kite.punishAt (3.5 s), or Lamb cannot be reached
//                     at all (up a ledge, across deep water) for a second: a lunge from 4 m out, else
//                     a slow, readable throw. Each has its own cooldown (6 to 10 s for the throw).
//                     These answers do not wait for an attack token: they exist only for a Lamb who
//                     is not in the fight, so fair play never meets them.
//   pursuit           while the clock runs an opponent runs too (paying Breath like Lamb), for up
//                     to 4 s, then rests 5 s.
//   cutting off       an opponent without the token aims for the ground Lamb is running toward,
//                     not for Lamb's back, so a pack closes lines instead of queueing.
//   the sight leash   there is no home to go back to and nothing heals. After 7 s without sight
//                     an opponent calls the others to where Lamb was last seen and goes to hold the
//                     way out nearest it.
// Choices that vary use the world's seeded hash, so fights replay exactly.
import { rand01 } from "../../core/rng.mjs";
import { dist, angleTo } from "../sim/fighter.mjs";
import { ledgeClear } from "../sim/terrain.mjs";
import { go, wayToward } from "../sim/paths.mjs";
import { WORLD, OFF } from "../data/world.mjs";

const K = WORLD.kite, P = WORLD.punish;
const r01 = (W, F, k) => rand01(W.seed, `${F.id}:${k}:${W.tick}`);
const reachOf = (W, F) => { const id = `${F.id}:${F.tool ? "" : "hands:"}light_1`, m = W.moves[id]; return m && m.hits.length ? Math.max(...m.hits.map((h) => h.r[1])) : 1.5; };

const awayFrom = (F, T) => { const d = dist(F, T) || 1; return (T.vx * (T.x - F.x) + T.vz * (T.z - F.z)) / d; };

// Is Lamb in nobody's reach? (fighting one opponent while another hangs back is not kiting)
export const apart = (W, T) => !W.fighters.some((O) => O.team !== T.team && !O.out && !O.fallen && !O.yielded && O.aware !== false && dist(O, T) <= reachOf(W, O) + K.margin);

// Is Lamb opening the gap on this opponent while in nobody's reach? (the strict count the time cap's
// break-off reads: an opponent that walks away from Lamb does not make Lamb a kiter)
export function retreatingFrom(W, F, T) {
  const d = dist(F, T);
  return d > reachOf(W, F) + K.margin && apart(W, T) && awayFrom(F, T) > K.away && !(T.guardT > 0);
}

// Is Lamb kiting this opponent this frame? Out of everyone's reach and opening the gap on this one,
// or far out of its reach.
// A guarded retreat (the guard up, walking back at guard speed) is defence, not kiting: it is slow
// enough that any opponent closes it, and the fair player backs off this way to get Breath back.
export function kitingNow(W, F, T) {
  const d = dist(F, T), reach = reachOf(W, F) + K.margin;
  if (d <= reach || !apart(W, T) || T.guardT > 0) return false;
  const ux = (T.x - F.x) / d, uz = (T.z - F.z) / d, away = T.vx * ux + T.vz * uz;
  return away > K.away || d > reach + K.far;
}

// Can this opponent reach Lamb on foot, straight or round (sim/paths.mjs)? Lamb up a ledge it cannot
// climb, out past waist-deep water, or walled off says no.
const straight = (W, F, T) => W.field.lineClear(F.x, F.z, T.x, T.z) && ledgeClear(W.field.arena, F.x, F.z, T.x, T.z);
export function reachable(W, F, T) {
  if (W.field.depthAt(T.x, T.z) >= 0.85) return false;
  return straight(W, F, T) || !W.field.arena.grid || !!wayToward(W, F, T.x, T.z);
}

// Called every frame the brain sees its target: runs the clock and returns an answer or null.
export function pursue(W, F, T, M) {
  const P0 = (M.pur ||= { clock: 0, cut: 0, thrown: 0, lunged: 0, chase: 0, rest: 0 });
  P0.clock = kitingNow(W, F, T) ? P0.clock + 1 : Math.max(0, P0.clock - K.decay);
  P0.away = awayFrom(F, T) > K.away;
  P0.cut = reachable(W, F, T) ? 0 : P0.cut + 1;
  T.kitedBy = Math.max(T.kitedBy || 0, P0.clock);
  if (OFF.has("pursuit")) return null;
  const due = P0.clock >= K.punishAt || P0.cut >= K.unreachableAt, d = dist(F, T);
  if (F.act || F.st < 1) return null;
  // a chase arrives with a blow, not a stroll into Lamb's reach (so meeting the approach does not pay)
  if (P0.chase > 0 && d <= reachOf(W, F) + 0.3) {
    const id = `${F.id}:${F.tool ? "" : "hands:"}light_1`;
    if (W.moves[id]) { P0.chase = 0; P0.rest = W.tick + WORLD.chase.cool; F.face = angleTo(F, T); W.emit({ type: "punish", id: F.id, how: "chase", clock: P0.clock }); return { press: [id], mx: 0, mz: 0 }; }
  }
  if (!due) return null;
  const has = (id) => W.moves[id] && W.defs[F.id].moves.includes(id);
  if (has("world.lunge") && P0.cut === 0 && straight(W, F, T) && d >= P.lungeMin && d <= P.lungeMax && W.tick >= P0.lunged) {
    P0.lunged = W.tick + P.lungeCool[0] + Math.floor(r01(W, F, "lc") * (P.lungeCool[1] - P.lungeCool[0]));
    F.face = angleTo(F, T);
    W.emit({ type: "punish", id: F.id, how: "lunge", clock: P0.clock });
    return { press: ["world.lunge"], mx: 0, mz: 0 };
  }
  if (has("world.throw") && (F.items.stone || 0) > 0 && d >= P.throwMin && d <= P.throwMax && W.tick >= P0.thrown && W.field.sightClear(F.x, F.z, T.x, T.z)) {
    P0.thrown = W.tick + P.throwCool[0] + Math.floor(r01(W, F, "tc") * (P.throwCool[1] - P.throwCool[0]));
    F.face = angleTo(F, T); F.lock = T.id;
    W.emit({ type: "punish", id: F.id, how: "throw", clock: P0.clock });
    return { press: ["world.throw"], mx: 0, mz: 0 };
  }
  return null;
}

// Should this opponent run this frame? While the clock runs past WORLD.chase.from, for a burst.
export function chasing(W, F, M) {
  const P0 = M.pur; if (!P0 || OFF.has("pursuit")) return false;
  const C = WORLD.chase;
  if (P0.chase > 0) {
    if (F.st <= C.reserve) { P0.chase = 0; P0.rest = W.tick + C.cool; return false; } // keeps Breath for the answer
    P0.chase--; if (P0.chase === 0) P0.rest = W.tick + C.cool; return true;
  }
  // only after a Lamb who is opening the gap, and never into the last of its own Breath
  if (P0.clock >= C.from && P0.away && F.st > C.reserve && W.tick >= P0.rest && P0.cut === 0) { P0.chase = C.frames; return true; }
  return false;
}

// Where an opponent without the token should stand while Lamb runs: ahead of Lamb on its line.
export function cutOffPoint(W, F, T, M) {
  if (OFF.has("pursuit") || !M.pur || M.pur.clock < WORLD.chase.from) return null;
  const v = Math.hypot(T.vx, T.vz); if (v < 0.8) return null;
  const x = T.x + (T.vx / v) * 3, z = T.z + (T.vz / v) * 3;
  return W.field.solid(x, z) ? null : { x, z };
}

// The sight leash: returns an input when the opponent has lost Lamb long enough to hold a way out.
export function leash(W, F, M) {
  M.lost = (M.lost || 0) + 1;
  if (OFF.has("leash")) return null;
  if (M.lost < WORLD.leash.lost || !M.seen) return null;
  if (!M.called) {
    M.called = true;
    for (const O of W.fighters) if (O !== F && O.team === F.team && O.mem && !O.out) O.mem.seen = { ...M.seen };
    W.emit({ type: "call", id: F.id });
  }
  const exits = W.field.arena.exits || [];
  if (!exits.length) return null;
  const centre = (e) => [(e[0] + e[2]) / 2, (e[1] + e[3]) / 2];
  const [x, z] = exits.map(centre).sort((a, b) => Math.hypot(a[0] - M.seen.x, a[1] - M.seen.z) - Math.hypot(b[0] - M.seen.x, b[1] - M.seen.z))[0];
  const d = Math.hypot(x - F.x, z - F.z);
  if (d < 0.8) return { mx: 0, mz: 0 };
  return { ...go(W, F, x, z, 0.8), choke: true };
}
