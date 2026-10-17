// A scripted player for Lamb, for captures and soak tests: it reads tells like a careful player
// (catch a parryable swing, roll away from a hook or a rope, sidestep a thrown thing), punishes
// recovery, ripostes a caught opponent, charges a heavy when there is room, and backs off with
// the guard up when out of breath. Deterministic: decisions use the world's seeded hash.
// It is a test driver, not the enemy AI and not a difficulty target.
// It plays like the build it is given (Lamb's levels): a fighting build (GRIP or BALLAST 5 or
// more) catches more, presses with shorter pauses, charges a heavy into a crowd, and shoves a
// body standing by water or on frost; anyone else plays carefully.
import { rand01 } from "../../core/rng.mjs";
import { dist, angleTo } from "../sim/fighter.mjs";

const live = (F) => !F.out && !F.fallen && !F.yielded && F.hp > 0;
const r01 = (W, k) => rand01(W.seed ^ 0x5151, `${k}:${W.tick}`);

// Openings: with unaware opponents it creeps (half stick, lantern shut) to a point behind the
// nearest and takes it down; with a sluice it waits by the lever until an opponent stands in the
// zone, then works it.
export function createPilot({ catchShare = null, style = null } = {}) {
  const S = { hold: 0, cool: 0, last: "" };
  return (W) => {
    const L = W.lamb();
    if (!L || L.fallen) return {};
    if (S.style == null) {
      const lv = W.defs[L.id].levels || {}, fighter = (lv.grip ?? 3) >= 5 || (lv.ballast ?? 3) >= 5;
      S.style = style || (fighter ? "fighter" : "careful"); S.catch = catchShare ?? (fighter ? 0.8 : 0.6);
    }
    style = S.style; catchShare = S.catch;
    const open = opening(W, L);
    if (open) return open;
    const foes = W.fighters.filter((F) => F.team !== "lamb" && live(F)).sort((a, b) => dist(L, a) - dist(L, b));
    if (!foes.length) return {};
    // a fighter finishes the most hurt opponent in reach first, to thin the numbers
    const near = foes.filter((F) => dist(L, F) < 3);
    const T = style === "fighter" && near.length > 1 ? near.sort((a, b) => a.hp - b.hp)[0] : foes[0], out = { mx: 0, mz: 0, press: [], hold: {} };
    // anyone rolls out of a get-up as soon as it allows, away from the nearest
    if (L.act && L.act.id === "getup" && L.act.f >= 30 && L.st >= 2) { const a = angleTo(foes[0], L); return { mx: Math.cos(a), mz: Math.sin(a), press: ["roll"] }; }
    if (L.lock == null || !live(W.byId(L.lock))) out.press.push("lock");
    if (S.hold > 0) { S.hold--; out.hold.heavy = true; return out; }
    const busy = L.act && !["dodge"].includes(W.moves[L.act.id].kind);
    const cut = busy ? null : interrupt(W, L, foes);
    if (cut) { const a = angleTo(L, cut); out.mx = Math.cos(a); out.mz = Math.sin(a); out.press.push("light"); return out; }
    const threat = busy ? null : incoming(W, L, foes);
    if (threat) return defend(W, L, threat, out, catchShare, S);
    if (W.riposteTarget(L)) { out.press.push("light"); return out; }
    if (L.act && W.moves[L.act.id].next.light && L.act.f > W.moves[L.act.id].startup && r01(W, "chain") < 0.08) { out.press.push("light"); return out; }
    return offend(W, L, T, out, S, style);
  };
}

function opening(W, L) {
  const sleepers = W.fighters.filter((F) => F.team !== "lamb" && F.aware === false && live(F)).sort((a, b) => dist(L, a) - dist(L, b));
  if (sleepers.length) {
    if (W.takedownTarget(L)) return { press: ["light"] };
    const T = sleepers[0], bx = T.x - Math.cos(T.face) * 1.0, bz = T.z - Math.sin(T.face) * 1.0, d = Math.hypot(bx - L.x, bz - L.z);
    if (d < 0.3) { const a = angleTo(L, T); return { mx: Math.cos(a) * 0.15, mz: Math.sin(a) * 0.15 }; }
    return { mx: ((bx - L.x) / d) * 0.45, mz: ((bz - L.z) / d) * 0.45 };
  }
  const lever = (W.props || []).find((p) => p.kind === "sluice" && !p.open && p.x != null);
  if (!lever) return null;
  const d = Math.hypot(lever.x - L.x, lever.z - L.z), inZone = W.fighters.some((F) => F.team !== "lamb" && live(F) && F.x >= lever.zone[0] && F.x <= lever.zone[2] && F.z >= lever.zone[1] && F.z <= lever.zone[3]);
  if (d > 1.0) return { mx: (lever.x - L.x) / d, mz: (lever.z - L.z) / d };
  return inZone ? { press: ["interact"] } : { hold: { block: true } };
}

// A foe winding up, unarmoured, in reach, with more frames of wind-up left than Lamb's light
// strike needs: strike into it and the hit interrupts it.
function interrupt(W, L, foes) {
  const lm = W.moves[`lamb:${L.tool ? "" : "hands:"}light_1`]; if (!lm || L.st < 1) return null;
  const reach = lm.hits[0].r[1] + 0.3;
  for (const F of foes) {
    if (!F.act || dist(L, F) > reach + W.defs[F.id].radius) continue;
    const m = W.moves[F.act.id], left = m.startup - F.act.f;
    if (m.kind === "attack" && !m.armor && left > lm.startup + 2) return F;
  }
  return null;
}

// The nearest swing or throw about to land on Lamb: [foe or projectile, frames left, catchable].
function incoming(W, L, foes) {
  for (const P of W.projectiles) {
    if (P.team === "lamb") continue;
    const d = Math.hypot(P.x - L.x, P.z - L.z), closing = (L.x - P.x) * P.vx + (L.z - P.z) * P.vz > 0;
    if (closing && d < 3.2) return { what: "throw", angle: Math.atan2(P.vz, P.vx), left: 2, parry: P.move.parryable };
  }
  for (const F of foes) {
    if (!F.act) continue;
    const m = W.moves[F.act.id], left = m.startup - F.act.f;
    if (!m.hits.length || left < 0 || left > 14) continue;
    const reach = Math.max(...m.hits.map((h) => h.r[1]));
    if (dist(L, F) <= reach + 0.8) return { what: "swing", F, left, parry: m.parryable, angle: angleTo(F, L) };
  }
  return null;
}

// Answer a threat with frames read from the move data: press catch so the blow lands inside the
// catch window, roll so it lands inside the roll's window, else raise the guard.
function defend(W, L, th, out, catchShare, S) {
  const side = th.angle + (r01(W, "side") < 0.5 ? 1 : -1) * Math.PI / 2;
  if (th.what === "throw") { out.mx = Math.cos(side); out.mz = Math.sin(side); if (L.st >= 1 && !L.act) out.press.push("step"); return out; }
  const cm = W.moves[`lamb:${L.tool ? "" : "hands:"}catch`], rm = W.moves[W.defs.lamb.moveset.roll[W.defs.lamb.load]] || W.moves.roll;
  const catchAt = cm ? cm.parry[0] + 2 : 3, rollAt = rm.iframes[0] + 3;
  if (th.parry && L.st >= 1 && th.left === catchAt && r01(W, `c${th.F.id}`) < catchShare) { out.press.push("catch"); return out; }
  if (th.left === rollAt && L.st >= 2) { out.mx = Math.cos(side); out.mz = Math.sin(side); out.press.push("roll"); return out; }
  if (th.left < rollAt) out.hold.block = true;
  return out;
}

function offend(W, L, T, out, S, style) {
  const d = dist(L, T), a = angleTo(L, T), tAct = T.act && W.moves[T.act.id];
  const open = tAct && (tAct.kind === "stagger" || tAct.kind === "down" || T.act.f > tAct.startup + tAct.active);
  if (L.st < 2) { out.mx = -Math.cos(a) * 0.8; out.mz = -Math.sin(a) * 0.8; out.hold.block = d < 3; return out; }
  if (d > 1.7) { out.mx = Math.cos(a); out.mz = Math.sin(a); return out; }
  if (W.tick < S.cool && !open) { const s = a + Math.PI / 2; out.mx = Math.cos(s) * 0.5; out.mz = Math.sin(s) * 0.5; return out; }
  const pick = r01(W, "atk"), fighter = style === "fighter";
  S.cool = W.tick + (fighter ? 18 : 40) + Math.floor(r01(W, "cool") * (fighter ? 18 : 30));
  if (fighter) {
    const crowd = W.fighters.filter((F) => F.team !== "lamb" && live(F) && dist(L, F) < 2.6).length, set = W.defs.lamb.moveset;
    if (set.art2 && L.composure >= W.moves[set.art2].composure && (crowd >= 2 || d < 2)) { out.press.push("art2"); return out; }
    if (set.art && L.composure >= W.moves[set.art].composure && d < 2.2 && W.moves[set.art].kind !== "parry") { out.press.push("art"); return out; }
    if (crowd >= 2 && L.st >= 3) { S.hold = 30; out.press.push("heavy"); out.hold.heavy = true; return out; }
    const foot = W.field.footing(T.x, T.z), behind = W.field.depthAt(T.x + Math.cos(a) * 1.2, T.z + Math.sin(a) * 1.2);
    if ((foot.frost || foot.kind.startsWith("wet ") || behind >= 0.4) && L.st >= 1 && d < 1.4) { out.press.push("shove"); return out; }
  }
  if (open && tAct.kind !== "stagger" && pick < 0.35 && L.st >= 3) { S.hold = 36; out.press.push("heavy"); out.hold.heavy = true; return out; }
  if (pick < 0.12 && style !== "careful") { out.press.push("shove"); return out; }
  out.press.push("light");
  return out;
}
