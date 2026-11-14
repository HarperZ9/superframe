// Scripted players for the inner arena's checks (combat/tools/forcecheck.mjs, tests/inner.test.mjs). Test
// drivers, not difficulty targets and not the enemy AI.
//   forceBot()            fights: combat's pilot (tools/pilot.mjs), routed round the stacks
//   resolveBot(W, verb)   plays one non-force verb to its end:
//     refuse   walks to the flaw's door and out through it
//     endure   the pilot with every strike taken out (it still rolls, sidesteps, blocks and catches); where the
//              flaw's endure is to stand at an anchor, it walks there and stands under guard
//     yield    holds guard and interact for the lay, then the flaw's act: waits it out playing safe, outlasts the
//              drags, or walks in under its blows to the brow and holds interact there
//     lose     lays the guard down and walks in under it
//     name     faces it: presses name and stands still
import { createPilot } from "./pilot.mjs";
import { steer } from "../arena/innerpath.mjs";
import { dist } from "../sim/fighter.mjs";

const STRIKES = new Set(["light", "heavy", "art", "art2", "grapple", "shove", "riposte", "use"]);
const foes = (W) => W.fighters.filter((F) => F.team !== "lamb" && !F.out && !F.fallen);
const nearest = (W) => { const L = W.lamb(); return foes(W).sort((a, b) => dist(L, a) - dist(L, b))[0] || null; };

// walk toward a point: straight where the line is clear, else round the stacks
function walk(W, x, z, s = 1) {
  const L = W.lamb(), r = steer(W, L, x, z); if (r) return { mx: r.mx * s, mz: r.mz * s };
  const d = Math.hypot(x - L.x, z - L.z) || 1; return { mx: ((x - L.x) / d) * s, mz: ((z - L.z) / d) * s };
}
// the pilot, with its walks routed round the stacks when its target is behind one
function routedPilot(opts) {
  const p = createPilot(opts);
  return (W) => {
    const out = p(W) || {}, T = nearest(W), L = W.lamb();
    if (T && L && (out.mx || out.mz) && !(out.press || []).some((a) => a !== "lock")) {
      const s = steer(W, L, T.x, T.z), toward = ((out.mx || 0) * (T.x - L.x) + (out.mz || 0) * (T.z - L.z)) > 0;
      if (s && toward) { const m = Math.hypot(out.mx || 0, out.mz || 0); return { ...out, mx: s.mx * m, mz: s.mz * m }; }
    }
    return out;
  };
}

// the pilot, out of the floor marks; force is a fall in every fight (combat/data/fights.mjs)
// a skilled player breaks the leader: within reach of the boss, he works on it rather than its hands
const leader = (W, L, foes) => { const B = foes.find((F) => F.id === "boss"); return B && dist(L, B) < 3.5 ? B : null; };
export function forceBot() {
  const p = routedPilot({ prefer: leader });
  return (W) => {
    const away = hazardOut(W); if (away) return away;
    return p(W);
  };
}

// the pilot with its strikes taken out: it reads tells and gets out of the way
function safeBot() {
  const p = routedPilot();
  return (W) => { const o = p(W) || {}; return { ...o, press: (o.press || []).filter((a) => !STRIKES.has(a)), hold: { ...(o.hold || {}), heavy: false } }; };
}

// the layers open only once the fight is joined (innerworld.mjs I.open): fight until then, then play the verb. A
// loss does not wait.
export function resolveBot(W, verb) {
  const bot0 = resolveBot0(W, verb), fight = forceBot();
  return verb === "lose" ? bot0 : (W2) => (W2.inner.open === false ? fight(W2) : bot0(W2));
}

function resolveBot0(W, verb) {
  const safe = safeBot();
  const stand = ((W.inner.flawRec || {}).verbs?.endure || {}).stand;
  if (verb === "endure" && stand) { // walk to the anchor and stand there under guard, striking nothing (Everybody Says)
    const [ax, az] = W.field.arena.anchors[stand.anchor][0];
    return (W2) => { const L = W2.lamb(); return dist(L, { x: ax, z: az }) > stand.r - 0.5 ? { ...walk(W2, ax, az), hold: {} } : { mx: 0, mz: 0, hold: { block: true } }; };
  }
  if (verb === "endure") return safe;
  if (verb === "refuse") {
    // the door is read each frame: it opens only once the fight is joined
    return (W2) => {
      const [x0, z0, x1, z1] = W2.field.arena.exits[0] || (W2.inner.door || [])[0] || [0, 0, 0, 0], tx = (x0 + x1) / 2, tz = (z0 + z1) / 2 + 1.5;
      const o = safe(W2), L = W2.lamb(); return { ...walk(W2, tx, tz), press: (o.press || []).filter((a) => a === "roll" && dist(L, { x: tx, z: tz }) > 3) };
    };
  }
  if (verb === "yield") {
    const Y = (W.inner.flawRec || {}).verbs?.yield || {}, F = Y.follow;
    return (W2) => {
      const I = W2.inner, L = W2.lamb(), B = W2.byId("boss");
      if (!I.laid) return { mx: 0, mz: 0, hold: { block: true, interact: true } };
      if (F && F.kind === "stand") { // walk to the place and hold interact there
        const [ax, az] = W2.field.arena.anchors[F.at][0];
        return dist(L, { x: ax, z: az }) > F.reach - 0.5 ? { ...walk(W2, ax, az), hold: {} } : { mx: 0, mz: 0, hold: { interact: true } };
      }
      if (F && F.kind === "rub" && B) {
        const fx = B.x + Math.cos(B.face) * 1.1, fz = B.z + Math.sin(B.face) * 1.1, near = dist(L, B) <= F.reach - 0.3;
        return near ? { mx: 0, mz: 0, press: L.lock == null ? ["lock"] : [], hold: { interact: true } } : { ...walk(W2, fx, fz), hold: {} };
      }
      return safe(W2);
    };
  }
  if (verb === "lose") {
    const lay = !!((W.inner.flawRec || {}).verbs?.lose || {}).lay; // Friday's arm: lay the guard down first; elsewhere going down needs no lay
    return (W2) => { const I = W2.inner, B = W2.byId("boss"); if (lay && !I.laid) return { mx: 0, mz: 0, hold: { block: true, interact: true } }; return B && dist(W2.lamb(), B) > 0.9 ? walk(W2, B.x, B.z, 0.5) : { mx: 0, mz: 0, hold: { block: false } }; };
  }
  if (verb === "name") {
    // a careful player: it faces it only when nothing near is winding up, and gives it up for a roll when
    // something is (a real fight goes on round the naming since 2026-10-23)
    let opened = false;
    const busy = (W2) => { const L = W2.lamb(); return foes(W2).some((F) => { if (!F.act) return false; const m = W2.moves[F.act.id], reach = Math.max(0, ...(m.hits || []).map((h) => h.r[1])) + 0.6; return m.kind === "attack" && dist(L, F) < reach && F.act.f >= m.startup - 40 && F.act.f < m.startup + m.active; }); };
    return (W2) => {
      const I = W2.inner;
      if (!I.naming) opened = false;
      if (busy(W2) && (!I.naming || I.naming.t < (I.nameHold || 90) - 4)) { opened = false; return safe(W2); }
      if (!opened) { opened = true; return { press: ["name"] }; }
      return { mx: 0, mz: 0 };
    };
  }
  throw new Error(`innerbots: no bot for ${verb}`);
}

// the unskilled player (tools/innerduel.mjs): walks at the nearest opponent and swings whenever it is in reach; it
// never blocks, catches or rolls, and so it reads no tell. A measure of how deadly a moveset is, not a difficulty
// target.
export function mashBot() {
  return (W) => {
    const L = W.lamb(), T = nearest(W); if (!L || !T) return {};
    const d = dist(L, T);
    if (d > 1.7) return walk(W, T.x, T.z);
    return { mx: 0, mz: 0, press: L.act ? [] : ["light"], hold: {} };
  };
}

// a careful player reads the floor too (combat/arena/innerhaz.mjs): standing in a mark that is about to strike, he
// steps out of it, and rolls out at the last moment; marks with time left are walked out of
export function hazardOut(W) {
  const I = W.inner, L = W.lamb(); if (!I || !I.hazards || !L || L.fallen) return null;
  for (const H of I.hazards) {
    const left = H.hitAt - W.tick; if (left < 0 || left > 40) continue;
    let dx = 0, dz = 0, inside = false;
    if (H.kind === "spot") { const d = Math.hypot(L.x - H.x, L.z - H.z); inside = d <= H.r + 0.6; dx = (L.x - H.x) / (d || 1); dz = (L.z - H.z) / (d || 1); }
    if (H.kind === "lane") { const o = H.axis === "x" ? L.z - H.z : L.x - H.x; inside = Math.abs(o) <= H.w / 2 + 0.5; const sgn = o >= 0 ? 1 : -1; if (H.axis === "x") dz = sgn; else dx = sgn; }
    if (H.kind === "ring") { const d = Math.hypot(L.x - H.x, L.z - H.z); inside = d >= H.r - 0.5 && d <= H.r + 1.9; const k = d < H.r + 0.7 ? -1 : 1; dx = ((L.x - H.x) / (d || 1)) * k; dz = ((L.z - H.z) / (d || 1)) * k; }
    if (!inside) continue;
    if (left <= 10 && !L.act) return { mx: dx, mz: dz, press: ["roll"], hold: {} };
    return { mx: dx, mz: dz, hold: { run: true } };
  }
  return null;
}
