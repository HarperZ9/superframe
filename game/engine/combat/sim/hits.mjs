// Hit and hurt volumes, and what a hit does. Hurt volumes are upright cylinders (radius and
// height from the fighter's record). Hit volumes are ring sectors around the attacker with a
// height band, live on the frames the move names. Each swing hits a body at most once.
//
// All contacts in a frame are found first and then applied in fighter order, so two bodies that
// swing on the same frame trade blows whoever is stepped first.
//
// What the target is doing decides, in order: frames that pass through (evade), a catch from
// the front (parry), a raised guard from the front (block: Breath pays, heavy blows break it
// unless the guard is a shield), then the hit itself (Standing, poise scaled by footing,
// knockback, hit-stop, shake) and its consequences (stagger, knockdown, yield, fall).
import { within, hitsAt, armorAt } from "./moves.mjs";
import { RULES } from "../data/common.mjs";
import { wrapAngle, angleTo, startMove, guarding } from "./fighter.mjs";
import { unaware, alert, takedownFor, SNEAK_BONUS } from "./stealth.mjs";

const DEG = 180 / Math.PI;
const gone = (T) => T.out || T.fallen || T.yielded || T.hp <= 0;

export function overlaps(A, h, T, tdef) {
  const dx = T.x - A.x, dz = T.z - A.z, d = Math.hypot(dx, dz), r = tdef.radius;
  if (d - r > h.r[1] || d + r < h.r[0]) return false;
  if (h.y[1] < 0 || h.y[0] > tdef.height) return false;
  if (d < 1e-6) return true;
  const ang = wrapAngle(Math.atan2(dz, dx) - A.face) * DEG, pad = Math.asin(Math.min(1, r / d)) * DEG;
  return ang >= h.arc[0] - pad && ang <= h.arc[1] + pad;
}

// Contacts this frame: [attacker, target, move]
export function findContacts(W) {
  const out = [];
  for (const A of W.fighters) {
    if (!A.act || A.hitstop > 0 || gone(A)) continue;
    const m = W.moves[A.act.id], live = hitsAt(m, A.act.f);
    if (!live.length) continue;
    for (const T of W.fighters) {
      if (T.team === A.team || gone(T) || A.act.hit.includes(T.id)) continue;
      if (live.some((h) => overlaps(A, h, T, W.defs[T.id]))) out.push([A, T, m]);
    }
  }
  return out;
}

const frontal = (T, from, cone) => Math.abs(wrapAngle(angleTo(T, from) - T.face)) * DEG <= cone;

export function applyHit(W, A, T, m, src = null) {
  if (gone(T)) return "none";
  const tm = T.act && W.moves[T.act.id], f = T.act ? T.act.f : -1, from = src || A;
  if (tm && within(tm.iframes, f)) {
    const seen = src ? (src.evaded ||= []) : A.act ? (A.act.evaded ||= []) : [];
    if (!seen.includes(T.id)) { seen.push(T.id); W.emit({ type: "evade", id: T.id, by: A.id, move: m.id }); }
    return "evade";
  }
  if (!src && A.act) A.act.hit.push(T.id);
  if (tm && within(tm.parry, f) && m.parryable && frontal(T, from, RULES.parryCone)) return parried(W, A, T, m, src);
  if (guarding(T) && m.blockable && frontal(T, from, RULES.blockCone)) { const b = blocked(W, A, T, m, src); if (b) return b; }
  if (m.grapple) return grappled(W, A, T, m);
  return takeHit(W, A, T, m, src, tm, f);
}

// The PEN pillar (19.2): a blow that lands while the opponent winds up, inside Lamb's read window
// (8 frames + the build's read, doubled for the first three telegraphs with Tobit's count), finds
// a weak point; Hester's carriage return makes the next blow after a catch count as read.
function weakPoint(W, A, T, tm, f) {
  const d = W.defs[A.id], b = d.bonus; if (!b || A.team !== "lamb") return 1;
  if (A.carriage) { A.carriage = false; return 1 + b.weak; }
  if (!tm || (tm.kind !== "attack" && tm.kind !== "item")) return 1;
  const counted = (d.learned || []).includes("countedge") && (W.telegraphsSeen || 0) <= 3, win = 8 + b.read * (counted ? 2 : 1);
  return f >= tm.startup - win && f < tm.startup ? (W.emit({ type: "weakpoint", id: T.id, by: A.id }), 1 + b.weak) : 1;
}

function parried(W, A, T, m, src) {
  if ((W.defs[T.id].learned || []).includes("carriage")) T.carriage = true;
  // a catch lands like a door slamming: both bodies freeze, a hard spring shake, a heavy rumble
  T.act = null; T.hitstop = 12;
  if (!src) { A.hitstop = 12; startMove(W, A, "parried"); A.poise = A.poiseMax; }
  W.emit({ type: "parry", id: T.id, by: A.id, move: m.id, projectile: !!src });
  W.emit({ type: "shake", amp: 0.6, frames: 16, dir: dirFrom(A, T), spring: { k: 260, damp: 18 } });
  W.emit({ type: "rumble", id: T.id, by: A.id, low: 1, high: 0.8, frames: 14 });
  return "parry";
}

// A raised guard: Breath pays per blow; a guard-breaking blow or an empty chest breaks it.
// Returns null when the guard breaks and the blow lands as a stagger.
function blocked(W, A, T, m, src) {
  const tool = W.defs[T.id].tool, heavy = m.guardBreak, shield = tool.cls === "shield";
  const cost = tool.blockCost[heavy ? 1 : 0];
  if ((heavy && !shield) || T.st < cost) {
    T.st = Math.max(0, T.st - cost); T.guardT = 0;
    W.emit({ type: "guardbreak", id: T.id, by: A.id, move: m.id });
    startMove(W, T, "stagger"); T.hitstop = Math.max(T.hitstop, 6); if (!src) A.hitstop = Math.max(A.hitstop, 6);
    return "guardbreak";
  }
  T.st -= cost; T.stWait = W.defs[T.id].staminaDelay;
  const chip = m.dmg * tool.chip; T.hp = Math.max(0.01, T.hp - chip);
  push(T, src || A, m.knock * 0.4, src);
  T.hitstop = Math.max(T.hitstop, 3); if (!src) A.hitstop = Math.max(A.hitstop, 3);
  W.emit({ type: "block", id: T.id, by: A.id, move: m.id, cost, chip });
  W.emit({ type: "shake", amp: m.guardBreak ? 0.3 : 0.15, frames: 6, dir: dirFrom(T, src || A), spring: { k: 200, damp: 16 } });
  W.emit({ type: "rumble", id: T.id, by: A.id, low: 0.5, high: 0.3, frames: 6 });
  return "block";
}

// A seize: GRIP against GRIP. The stronger hand takes the other's tool and staggers them; the
// weaker hand is thrown off balance.
function grappled(W, A, T, m) {
  const ga = W.defs[A.id].grip, gt = W.defs[T.id].grip + (T.act ? 0 : 1);
  A.hitstop = T.hitstop = m.hitstop;
  if (ga >= gt) {
    const took = T.tool; T.tool = null; T.disarmed = true;
    startMove(W, T, "stagger");
    W.emit({ type: "disarm", id: T.id, by: A.id, tool: took });
    return "disarm";
  }
  startMove(W, A, "stagger");
  W.emit({ type: "grapple-lost", id: A.id, by: T.id });
  return "grapple-lost";
}

function push(T, from, knock, src, toward = null) {
  let dir = src && src.vx !== undefined ? Math.atan2(src.vz, src.vx) : Math.atan2(T.z - from.z, T.x - from.x);
  if (toward != null) dir = toward;
  T.kx += Math.cos(dir) * knock; T.kz += Math.sin(dir) * knock;
}

// The direction from the target to the deepest water within 4 m (eight bearings, 1 m steps).
function towardWater(W, T) {
  let best = null, deep = -Infinity;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4;
    for (let r = 1; r <= 4; r++) { const d = W.field.depthAt(T.x + Math.cos(a) * r, T.z + Math.sin(a) * r); if (d > deep) { deep = d; best = a; } }
  }
  return best;
}

function takeHit(W, A, T, m, src, tm, f) {
  const foot = W.field.footing(T.x, T.z), scale = foot.frost ? RULES.frostPoise : foot.wet ? RULES.wetPoise : 1;
  const armor = tm && !m.pierce ? armorAt(tm, f) : 0, pd = Math.max(0, m.poise * scale - armor), sneak = unaware(T);
  const weakMul = weakPoint(W, A, T, tm, f), soften = W.defs[T.id].soften || 1;
  const dmg = m.takedown && sneak && takedownFor(W, T) === "out" ? T.hp : m.dmg * (sneak ? SNEAK_BONUS : 1) * weakMul * soften;
  T.hp = Math.max(0, T.hp - dmg); T.poise -= pd; if (pd > 0) T.poiseWait = RULES.poiseDelay;
  if (sneak) { W.emit({ type: m.takedown ? "takedown" : "sneakhit", id: T.id, by: A.id, dmg }); alert(W, T, "struck"); }
  const held = (W.defs[T.id].learned || []).includes("galleryhold") && (m.shove || m.knock < 0 || m.toward);
  if (!held) push(T, src || A, m.knock, src, m.toward === "water" ? towardWater(W, T) : null);
  T.hitstop = Math.max(T.hitstop, m.hitstop); if (!src) A.hitstop = Math.max(A.hitstop, m.hitstop);
  T.flash = m.hitstop + 3; T.lastHitBy = A.id;
  if (m.blind) T.blind = Math.max(T.blind, m.blind);
  W.emit({ type: "hit", id: T.id, by: A.id, move: m.id, dmg, poise: pd, armor: armor > 0, footing: foot.kind });
  if (m.shake > 0) W.emit({ type: "shake", amp: m.shake, frames: 6 + Math.round(m.hitstop * 1.5), dir: dirFrom(T, src || A), spring: { k: 180, damp: 14 } });
  W.emit({ type: "rumble", id: T.id, by: A.id, low: Math.min(1, 0.2 + m.shake), high: Math.min(1, 0.1 + m.dmg / 4), frames: 4 + m.hitstop * 2 });
  if (T.hp <= 0) { startMove(W, T, "fall"); W.emit({ type: "fall", id: T.id, by: A.id }); return "fall"; }
  const yields = W.defs[T.id].yields;
  if (yields != null && T.hp <= yields) { T.yielded = true; startMove(W, T, "yield"); W.emit({ type: "yield", id: T.id, by: A.id }); return "yield"; }
  if (m.snare) return breakPoise(W, T, "snared");
  if (m.shove && W.field.depthAt(T.x + T.kx * 0.25, T.z + T.kz * 0.25) >= 0.4) return breakPoise(W, T, "ducked");
  if (m.shove && m.through) return breakPoise(W, T, "knockdown");
  if (m.shove && (foot.frost || foot.kind.startsWith("wet "))) { W.emit({ type: "slip", id: T.id, footing: foot.kind }); return breakPoise(W, T, "knockdown"); }
  if ((m.knockdown && armor === 0) || T.poise <= RULES.knockdownPoise) return breakPoise(W, T, steady(W, T, m) ? "stagger" : "knockdown");
  if (T.poise <= 0) return breakPoise(W, T, "stagger");
  if (armor === 0 && pd > 0 && interruptible(W, T, m)) { T.flinchAt = W.tick; startMove(W, T, "flinch"); W.emit({ type: "flinch", id: T.id }); return "flinch"; }
  return armor > 0 ? "armored" : "hit";
}

// A wind-up, a throw, a free stance or a guard can be interrupted; a dodge, a recovery or a
// reaction cannot, and a body that flinched recently shrugs the next one off.
// A fighting build with BALLAST 5 or more plants its feet: light blows (under 1.5 poise) no
// longer interrupt it.
function interruptible(W, T, blow) {
  if (W.tick - (T.flinchAt ?? -1e9) < RULES.flinchGuard) return false;
  const lv = W.defs[T.id].levels;
  if (lv && lv.ballast >= 5 && blow.poise < 1.5) return false;
  if (!T.act) return true;
  const m = W.moves[T.act.id];
  return (m.kind === "attack" || m.kind === "item") && T.act.f < m.startup;
}

// A fighting build with BALLAST 6 or more keeps its feet: what would put it down only staggers it
// (a takedown still takes it down).
const steady = (W, T, m) => !m.takedown && ((W.defs[T.id].levels || {}).ballast ?? 0) >= 6;

// unit vector from the striker to the struck, for the shake's push (presentation only)
const dirFrom = (T, from) => { const a = Math.atan2(T.z - from.z, T.x - from.x); return [+Math.cos(a).toFixed(3), +Math.sin(a).toFixed(3)]; };

function breakPoise(W, T, how) {
  T.poise = T.poiseMax; T.buf = [];
  startMove(W, T, how);
  W.emit({ type: how, id: T.id });
  return how;
}
