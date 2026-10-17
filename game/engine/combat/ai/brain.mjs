// Enemy behaviour. A brain turns the world into the same input a player gives (stick, presses),
// so enemies obey every rule Lamb does: stamina, footing, water, sight, cancel windows.
//
// What a brain does, in order of priority:
//   reel      while staggered or down it does nothing; on getting up it answers by its kind
//             (brace: an armoured sweep at once; scramble: a step back and a retreat)
//   commit    inside a move it only presses the next link of a chain
//   blind     without sight of the target it walks to where it last saw it, then searches
//   retreat   below its health line (once) or out of stamina it backs off to range
//   punish    a target recovering from a whiff, or drinking, in reach: attack now
//   attack    attack tokens limit how many attack at once (one, rising with time and with a
//             passive Lamb: ai/pressure.mjs); a holder picks
//             a move whose range fits, weighted, and the move's own wind-up is the telegraph
//   space     the rest hold a ring at their preferred range, in flank slots around the target
//             (slot 0 in front of it, slot 1 out to its side), strafing
// Choices that vary use the seeded hash of (seed, fighter, frame), so a fight replays exactly.
import { rand01 } from "../../core/rng.mjs";
import { dist, angleTo, wrapAngle } from "../sim/fighter.mjs";
import { phaseOf } from "../sim/moves.mjs";
import { tokensAllowed, coolScale, passive } from "./pressure.mjs";

const alive = (F) => F && !F.out && !F.fallen && F.hp > 0;
const r01 = (W, F, k) => rand01(W.seed, `${F.id}:${k}:${W.tick}`);
const toward = (F, x, z, s = 1) => { const d = Math.hypot(x - F.x, z - F.z) || 1; return { mx: ((x - F.x) / d) * s, mz: ((z - F.z) / d) * s }; };

export function createBrain(cfg) {
  return (W, F) => think(W, F, cfg);
}

function think(W, F, cfg) {
  // an opening may have seeded the memory (a last-seen point); fill in whatever it left out
  if (!F.mem || F.mem.next === undefined) F.mem = { next: 0, seen: null, move: { mx: 0, mz: 0 }, cool: 0, stag: false, retreat: 0, retreated: false, side: 0, searched: 0, ...(F.mem || {}) };
  const M = F.mem;
  const T = pickTarget(W, F);
  if (!T) return { mx: 0, mz: 0 };
  if (F.aware === false) return idleWatch(W, F, M);
  const see = W.visible(F, T);
  if (see) { M.seen = { x: T.x, z: T.z, t: W.tick }; F.lock = T.id; } else if (F.lock === T.id && !see) F.lock = null;
  const cur = F.act && W.moves[F.act.id];
  if (cur && (cur.kind === "stagger" || cur.kind === "down")) { M.stag = true; return {}; }
  if (M.stag && !F.act) { M.stag = false; return reel(W, F, cfg, T, M); }
  if (cur) return commit(W, F, cfg, M, cur);
  if (!M.seen) return {};
  if (!see) return seek(W, F, M);
  return engage(W, F, cfg, T, M);
}

// Unaware: stand the post, turning a little now and then (a seeded drift, so a sneak can time it).
function idleWatch(W, F, M) {
  M.home ||= { x: F.x, z: F.z, face: F.face };
  const t = Math.floor(W.tick / 240), turn = (rand01(W.seed, `${F.id}:w${t}`) - 0.5) * 0.9;
  F.face = M.home.face + turn * Math.min(1, (W.tick % 240) / 60);
  return { mx: 0, mz: 0 };
}

function pickTarget(W, F) {
  let best = null, bd = Infinity;
  for (const T of W.fighters) if (T.team !== F.team && alive(T)) { const d = dist(F, T); if (d < bd) { bd = d; best = T; } }
  return best;
}

function reel(W, F, cfg, T, M) {
  if (cfg.onStagger === "brace" && F.st >= 1) return { press: [cfg.braced] };
  if (cfg.onStagger === "scramble") { M.retreat = W.tick + 70; return { press: [cfg.dodge], ...away(F, T) }; }
  return {};
}

function commit(W, F, cfg, M, cur) {
  if (cur.next.light && M.chain > 0 && phaseOf(cur, F.act.f) === "recovery") { M.chain--; return { press: ["light"] }; }
  return {};
}

function seek(W, F, M) {
  const d = Math.hypot(M.seen.x - F.x, M.seen.z - F.z);
  if (d > 0.8) return avoidDeep(W, F, toward(F, M.seen.x, M.seen.z, 0.7));
  // a fight is loud: after three seconds of finding nothing they go toward where Lamb is now
  if (++M.searched > 180) { const L = W.lamb(); M.seen = { x: L.x, z: L.z, t: W.tick }; M.searched = 0; }
  return { mx: 0, mz: 0 };
}

// A brain's move key as this fighter's move id: a special it owns, or its tool's strike (bare
// hands once the tool has been taken).
export function moveId(W, F, key) {
  if (W.moves[key] && W.defs[F.id].moves.includes(key)) return key;
  const id = `${F.id}:${F.tool ? "" : "hands:"}${key}`;
  return W.moves[id] ? id : null;
}

const away = (F, T, s = 1) => { const m = toward(F, T.x, T.z, s); return { mx: -m.mx, mz: -m.mz }; };

function engage(W, F, cfg, T, M) {
  M.searched = 0;
  const d = dist(F, T), def = W.defs[F.id];
  const dodge = react(W, F, cfg, T, d);
  if (dodge) return dodge;
  if (!M.retreated && F.hp < F.hpMax * cfg.retreatHp) { M.retreated = true; M.retreat = W.tick + 120; }
  if (W.tick < M.retreat || F.st < cfg.lowStamina) return retreat(W, F, cfg, T, M, d);
  const open = T.act && (phaseOf(W.moves[T.act.id], T.act.f) === "recovery" || W.moves[T.act.id].kind === "item");
  if (open) { const a = choose(W, F, cfg, d, true); if (a && takeToken(W, F, T, W.moves[a.id].total + 24)) return fire(W, F, cfg, T, M, a); }
  if (W.tick >= M.next) {
    M.next = W.tick + cfg.think + Math.floor(r01(W, F, "think") * cfg.think);
    const a = W.tick >= M.cool ? choose(W, F, cfg, d, false) : null;
    if (a && takeToken(W, F, T, W.moves[a.id].total + (a.ranged ? 6 : 24))) return fire(W, F, cfg, T, M, a);
    M.move = space(W, F, cfg, T, M, d);
  }
  return { ...M.move };
}

// Dodge a swing that is about to land, if this kind dodges at all (a seeded chance).
function react(W, F, cfg, T, d) {
  if (!cfg.dodge || !T.act || F.st < 1) return null;
  const m = W.moves[T.act.id], left = m.startup - T.act.f;
  if (m.kind !== "attack" && m.kind !== "riposte") return null;
  if (left < 2 || left > 6 || d > 3) return null;
  if (r01(W, F, "dodge") > 0.4) return null;
  return { press: [cfg.dodge], ...away(F, T) };
}

function retreat(W, F, cfg, T, M, d) {
  const far = cfg.range[1];
  const throwA = resolved(W, F, cfg).find((a) => W.moves[a.id].item && d >= a.min && d <= a.max && usable(W, F, a.id));
  if (throwA && W.tick >= M.cool && takeToken(W, F, T, W.moves[throwA.id].total + 6)) return fire(W, F, cfg, T, M, { ...throwA, ranged: true });
  if (d < far) return away(F, T, 1);
  return strafe(W, F, T, M, 0.5);
}

const resolved = (W, F, cfg) => cfg.attacks.map((a) => ({ ...a, id: moveId(W, F, a.move) })).filter((a) => a.id);

function choose(W, F, cfg, d, quick) {
  const T = pickTarget(W, F), press = T && passive(W, T);
  const list = resolved(W, F, cfg).filter((a) => d >= a.min && d <= a.max && F.st >= 1 && usable(W, F, a.id) && (!quick || W.moves[a.id].startup <= QUICK))
    // against a Lamb who does not fight back: quick strikes, and not the ones that put Lamb down (a body on the ground cannot be hit)
    .map((a) => ({ ...a, w: !press ? a.w : W.moves[a.id].knockdown ? a.w * 0.3 : W.moves[a.id].startup <= QUICK && !W.moves[a.id].item ? a.w * 3 : a.w }));
  if (!list.length) return null;
  const sum = list.reduce((s, a) => s + a.w, 0);
  let x = r01(W, F, "pick") * sum, pick = list[list.length - 1];
  for (const a of list) { x -= a.w; if (x <= 0) { pick = a; break; } }
  return { ...pick, ranged: !!W.moves[pick.id].item };
}

// a "quick" strike for punishing and pressing: the opponents' tool strikes wind up 23 to 30 frames
const QUICK = 30;
const usable = (W, F, id) => { const m = W.moves[id]; return !(m.item && !(F.items[m.item.use] > 0)); };

// Attack tokens on the target: how many may be held at once is the pressure (ai/pressure.mjs).
function takeToken(W, F, T, frames) {
  T.tokens = (T.tokens || []).filter((t) => t.until > W.tick && t.id !== F.id && alive(W.byId(t.id)));
  if (T.tokens.length >= tokensAllowed(W, T)) return false;
  T.tokens.push({ id: F.id, until: W.tick + frames });
  return true;
}

function fire(W, F, cfg, T, M, a) {
  M.cool = W.tick + Math.round((cfg.cooldown[0] + Math.floor(r01(W, F, "cool") * (cfg.cooldown[1] - cfg.cooldown[0]))) * coolScale(W, T));
  M.chain = a.chain ? (passive(W, T) || r01(W, F, "chain") < 0.6 ? a.chain : 0) : 0;
  return { press: [a.id], mx: 0, mz: 0 };
}

// Hold the ring: the flank slot's point around the target at the preferred range.
function space(W, F, cfg, T, M, d) {
  const holder = (T.tokens || []).some((t) => t.until > W.tick && t.id === F.id);
  const [r0, r1] = cfg.range, r = holder || passive(W, T) ? Math.max(1.2, Math.min(r0, 2.2) - 0.6) : (r0 + r1) / 2;
  const slot = cfg.flankSlot === 0 ? 0 : (M.side ||= r01(W, F, "side") < 0.5 ? -1 : 1) * 1.9;
  const a = T.face + slot, px = T.x + Math.cos(a) * r, pz = T.z + Math.sin(a) * r;
  const gap = Math.hypot(px - F.x, pz - F.z);
  if (gap > 0.6) return avoidDeep(W, F, toward(F, px, pz, d > r1 + 1 ? 1 : 0.6));
  return strafe(W, F, T, M, 0.35);
}

function strafe(W, F, T, M, s) {
  const a = angleTo(F, T) + (M.side || 1) * Math.PI / 2;
  return avoidDeep(W, F, { mx: Math.cos(a) * s, mz: Math.sin(a) * s });
}

// Do not walk into waist-deep water or a wall: try the step turned by 45, 90 and 135 degrees
// either way (the side of the fighter's strafe first), and take the first that is clear.
function avoidDeep(W, F, mv) {
  const s = Math.hypot(mv.mx, mv.mz); if (s < 1e-3) return mv;
  const base = Math.atan2(mv.mz, mv.mx), side = (F.mem && F.mem.side) || 1;
  const clear = (a) => { const x = F.x + Math.cos(a) * 1.0, z = F.z + Math.sin(a) * 1.0; return !W.field.solid(x, z) && W.field.depthAt(x, z) < 0.85; };
  for (const d of [0, 1, -1, 2, -2, 3, -3]) { const a = wrapAngle(base + side * d * Math.PI / 4); if (clear(a)) return d ? { mx: Math.cos(a) * s, mz: Math.sin(a) * s } : mv; }
  return mv;
}
