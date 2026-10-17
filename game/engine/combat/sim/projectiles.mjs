// Thrown things: a bottle, a stone. Ballistic with gravity, pushed by the wind (lighter things
// more), hitting the first enemy body they pass through. A throw aims at the locked or soft
// target's distance, so the arc is right and the wind is what makes it miss.
import { DT } from "./moves.mjs";
import { applyHit } from "./hits.mjs";
import { dist } from "./fighter.mjs";

const G = 9.8, HAND = 1.4, CHEST = 1.0;

export function spawnProjectile(W, F, m) {
  const p = m.item.proj, target = F.lock != null ? W.byId(F.lock) : W.softTarget(F, F.face);
  const dx = Math.cos(F.face), dz = Math.sin(F.face);
  let vy = p.up ?? 3.0;
  if (target) { const t = Math.max(0.25, dist(F, target) / p.speed); vy = (CHEST - HAND) / t + (G * t) / 2; }
  const P = {
    n: W.nextProj++, owner: F.id, team: F.team, use: m.item.use, x: F.x + dx * 0.5, z: F.z + dz * 0.5, y: HAND,
    vx: dx * p.speed, vz: dz * p.speed, vy, mass: p.mass, r: p.r,
    light: p.light || null,
    move: { id: `thrown:${m.item.use}`, dmg: p.dmg, poise: p.poise, knock: p.knock ?? 1.4, hitstop: p.hitstop ?? 4, shake: p.shake ?? 0.1,
      parryable: p.parryable !== false, blockable: p.blockable !== false, knockdown: !!p.knockdown, blind: p.blind || 0, snare: !!p.snare,
      guardBreak: false, shove: false, grapple: false, toward: null },
  };
  W.projectiles.push(P);
  W.emit({ type: "throw", id: F.id, use: m.item.use, n: P.n });
  return P;
}

export function stepProjectiles(W) {
  const [ax, az] = [0, 0];
  for (const P of W.projectiles) {
    const [wx, wz] = W.field.wind(P.mass);
    P.vx += (ax + wx) * DT; P.vz += (az + wz) * DT; P.vy -= G * DT;
    P.x += P.vx * DT; P.z += P.vz * DT; P.y += P.vy * DT;
    if (hitBody(W, P)) { P.done = true; settleLight(W, P); continue; }
    if (W.field.solid(P.x, P.z) && P.y < 2.5) { P.done = true; W.emit({ type: "land", n: P.n, use: P.use, x: P.x, z: P.z, wall: true }); continue; }
    if (P.y <= 0) { P.done = true; W.emit({ type: "land", n: P.n, use: P.use, x: P.x, z: P.z, wet: W.field.depthAt(P.x, P.z) > 0 }); settleLight(W, P); }
  }
  W.projectiles = W.projectiles.filter((P) => !P.done);
}

// A thrown lantern keeps burning where it lands, unless it lands in water or rain douses it
// (SYSTEMS-FULL 18.8).
function settleLight(W, P) {
  if (!P.light) return;
  const wet = W.field.depthAt(P.x, P.z) > 0.05, rain = W.field.terms.rain > 0.5;
  if (wet) { W.emit({ type: "doused", n: P.n, why: "water" }); return; }
  const frames = rain ? 90 : P.light.frames;
  W.groundLights.push({ x: P.x, z: P.z, r: P.light.r, k: P.light.k, until: W.tick + frames });
  W.emit({ type: "lit", n: P.n, x: P.x, z: P.z, frames, rain });
}

function hitBody(W, P) {
  const owner = W.byId(P.owner) || { id: P.owner, team: P.team, x: P.x, z: P.z, act: null };
  for (const T of W.fighters) {
    if (T.team === P.team || T.out || T.fallen || T.yielded || T.hp <= 0) continue;
    const def = W.defs[T.id];
    if (P.y < 0 || P.y > def.height) continue;
    if (Math.hypot(T.x - P.x, T.z - P.z) > def.radius + P.r) continue;
    const res = applyHit(W, owner, T, P.move, P);
    if (res === "evade") continue;
    return true;
  }
  return false;
}
