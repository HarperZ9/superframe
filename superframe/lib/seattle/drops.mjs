// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// drops.mjs: rain on a car's rear side window. Drops land, bead, merge and run.
//
// Units are millimetres on the glass, seconds, and the glass patch is w x h mm with y pointing down the glass.
// - Arrivals: raindrops from a Marshall-Palmer size spectrum strike the window at the speed component normal to it.
//   A side window leans in (tumblehome), so falling rain meets it at vt sin(lean); a crosswind adds to that.
//   A struck drop leaves part of its volume (stick) as a cap; the rest splashes away (an authored share).
// - Forces on a sitting drop: gravity along the glass, rho g V sin(tilt), and air drag from the car's motion,
//   0.5 rho_air (beta U)^2 Cd A, pointing backward. beta is the air speed at drop height inside the boundary layer as
//   a share of the car's speed; it is an assumption (0.3: a rear side window sits in the disturbed flow behind
//   the B-pillar), not a measurement.
// - Hysteresis holds the drop until the net force exceeds the retention force (droplens.retention). A drop over the
//   threshold slides at a speed that grows with the excess (a viscous law; v0 is authored).
// - A sliding drop leaves small beads behind (pearling) and swallows every drop it touches: volume adds, the centre
//   moves to the volume-weighted mean. Merging can push a sitting drop over the threshold, which is what starts most
//   runs on a real window.
import { capShape, baseFromVolume, retention, rainSpeed, marshallPalmer, WATER } from './droplens.mjs';

const DEG = Math.PI / 180;
export const GLASS_DEFAULT = {
  theta: 50 * DEG, thetaR: 40 * DEG, thetaA: 58 * DEG, tilt: 70 * DEG, lean: 20 * DEG,
  beta: 0.3, cd: 1, stick: 0.6, v0: 60, vmax: 260, pearl: 0.05, rhoAir: 1.2,
};

export function createGlass(w, h, rng, opts = {}) {
  return { w, h, rng, p: { ...GLASS_DEFAULT, ...opts }, drops: [], t: 0 };
}
const radius = (G, V) => baseFromVolume(V, G.p.theta);

// add a drop of volume V (mm^3) at x, y
export function addDrop(G, x, y, V) { const d = { x, y, V, a: radius(G, V), vx: 0, vy: 0, moving: false, age: 0 }; G.drops.push(d); return d; }

// arrivals in dt: rain rate R (mm/h), car speed U (m/s), crosswind toward the glass (m/s)
export function rainOn(G, dt, { R = 4, cross = 0.5 }) {
  if (R <= 0) return 0;
  const mp = marshallPalmer(R), meanNormal = rainSpeed(1 / mp.L + 0.5) * Math.sin(G.p.lean) + cross;
  const rate = mp.density * meanNormal * (G.w * G.h * 1e-6), n = poisson(G.rng, rate * dt);
  for (let i = 0; i < n; i++) {
    const D = Math.min(4.5, mp.draw(G.rng)), V = (Math.PI / 6) * D ** 3 * G.p.stick * (0.5 + G.rng());
    addDrop(G, G.rng() * G.w, G.rng() * G.h, V);
  }
  return n;
}
function poisson(rng, m) { if (m > 30) return Math.max(0, Math.round(m + Math.sqrt(m) * gauss(rng))); let k = 0, p = Math.exp(-m), s = p, u = rng(); while (u > s) { k++; p *= m / k; s += p; } return k; }
const gauss = rng => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());

// net force (N) on a drop: gravity down the glass (+y), drag backward (-x)
export function force(G, d, U) {
  const a = d.a * 1e-3, V = d.V * 1e-9, h = a * (1 - Math.cos(G.p.theta)) / Math.sin(G.p.theta);
  const fg = WATER.rho * WATER.g * V * Math.sin(G.p.tilt), ua = G.p.beta * U, fa = 0.5 * G.p.rhoAir * ua * ua * G.p.cd * a * h;
  return [-fa, fg];
}

export function step(G, dt, env) {
  G.t += dt; rainOn(G, dt, env);
  const { U = 10 } = env, born = [];
  for (const d of G.drops) {
    d.age += dt;
    const [fx, fy] = force(G, d, U), F = Math.hypot(fx, fy), Fr = retention(d.a * 1e-3, G.p);
    if (F <= Fr) { d.moving = false; d.vx = d.vy = 0; continue; }
    const v = Math.min(G.p.vmax, G.p.v0 * (F / Fr - 1));
    d.moving = true; d.vx = (fx / F) * v; d.vy = (fy / F) * v;
    const dist = v * dt; d.x += d.vx * dt; d.y += d.vy * dt;
    if (G.rng() < G.p.pearl * dist && d.V > 1) { const q = d.V * 0.03; d.V -= q; d.a = radius(G, d.V); born.push([d.x - d.vx * dt * 0.7, d.y - d.vy * dt * 0.7, q]); }
  }
  for (const [x, y, q] of born) addDrop(G, x, y, q);
  merge(G);
  const m = 8; G.drops = G.drops.filter(d => d.x > -m && d.x < G.w + m && d.y > -m && d.y < G.h + m);
  return G;
}

// merge overlapping drops with a uniform grid; repeats until no pair overlaps
export function merge(G) {
  for (let pass = 0; pass < 4; pass++) {
    const cell = 3, grid = new Map(), key = (i, j) => i * 100003 + j;
    let merged = 0;
    for (const d of G.drops) { const k = key(Math.floor(d.x / cell), Math.floor(d.y / cell)); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(d); }
    for (const d of G.drops) {
      if (d.dead) continue;
      const ci = Math.floor(d.x / cell), cj = Math.floor(d.y / cell), reach = Math.ceil((d.a + 3) / cell);
      for (let i = ci - reach; i <= ci + reach; i++) for (let j = cj - reach; j <= cj + reach; j++) for (const e of grid.get(key(i, j)) ?? []) {
        if (e === d || e.dead || d.dead) continue;
        if (Math.hypot(e.x - d.x, e.y - d.y) < (d.a + e.a) * 0.92) { absorb(G, d.V >= e.V ? d : e, d.V >= e.V ? e : d); merged++; }
      }
    }
    G.drops = G.drops.filter(d => !d.dead);
    if (!merged) break;
  }
}
function absorb(G, big, small) {
  const V = big.V + small.V;
  big.x = (big.x * big.V + small.x * small.V) / V; big.y = (big.y * big.V + small.y * small.V) / V;
  big.vx = (big.vx * big.V + small.vx * small.V) / V; big.vy = (big.vy * big.V + small.vy * small.V) / V;
  big.V = V; big.a = radius(G, V); big.age = Math.min(big.age, small.age); small.dead = true;
}

// a dusting of fine spray beads already on the glass, so the first frame is not dry
export function seed(G, n, Vmax = 3) { for (let i = 0; i < n; i++) addDrop(G, G.rng() * G.w, G.rng() * G.h, Vmax * G.rng() ** 3 + 0.01); merge(G); }

export const totalVolume = G => G.drops.reduce((s, d) => s + d.V, 0);
export { capShape };
