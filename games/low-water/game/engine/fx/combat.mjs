// Combat (effects queue 8): what a blow leaves in the air and on the ground, kept restrained: an impact smear along the
// blow, dust kicked from the feet when someone is struck or falls, a burst of breath on effort in the cold, a few drops
// of blood that stay on the snow (no sprays), and the wind-up's telegraph ring in both styles (the painted lead's decals
// draw the painted ring in the game; this is the shared description). Driven by events the fight hands over:
// ctx.events = [{ type: "hit" | "fall" | "exert" | "windup", at, dir: [x, z], t0, power (0..1), unstoppable, dur }].
// Original code.
import { registerEffect, hash, lightAt } from "./core.mjs";

const age = (ctx, e) => ctx.t - e.t0;
registerEffect({ id: "smear", group: "combat", story: "a blow landing (hit events)", cost: { low: 0.02, high: 0.05 },
  step(ctx, out, set) {
    for (const e of ctx.events || []) {
      if (e.type !== "hit") continue; const u = age(ctx, e) / 0.28; if (u < 0 || u > 1) continue;
      const p = [e.at[0], e.at[1] + 1.3, e.at[2]], [px, py] = ctx.toPlate(p), q = ctx.toPlate([p[0] + e.dir[0] * 0.6, p[1], p[2] + e.dir[1] * 0.6]);
      for (let j = 0; j < 3; j++) out.push({ k: "smear", x: px + (j - 1) * 2, y: py + (j - 1) * 3, d: ctx.depth(p) - 0.6, r: (0.03 + 0.03 * e.power) * ctx.ppm, a: 0.55 * (1 - u) * (0.6 + 0.4 * e.power), rgb: [1, 0.95, 0.85], glow: true, ang: Math.atan2(q[1] - py, q[0] - px), len: Math.hypot(q[0] - px, q[1] - py) * (0.6 + 0.6 * u) });
    }
  } });
registerEffect({ id: "dust", group: "combat", story: "a hit or a fall: snow and dust kicked from the feet", cost: { low: 0.02, high: 0.05 },
  step(ctx, out, set) {
    for (const [k, e] of (ctx.events || []).entries()) {
      if (e.type !== "hit" && e.type !== "fall") continue; const u = age(ctx, e) / 0.9; if (u < 0 || u > 1) continue; const n = Math.round((e.type === "fall" ? 14 : 7) * (set.quality === "low" ? 0.5 : 1));
      for (let j = 0; j < n; j++) {
        const a = hash(k, j, 1) * 6.283, rr = (0.15 + 0.6 * u) * (0.5 + hash(k, j, 2)), p = [e.at[0] + Math.cos(a) * rr, 0.05 + 0.35 * u * hash(k, j, 3), e.at[2] + Math.sin(a) * rr], [px, py] = ctx.toPlate(p);
        const E = lightAt(ctx, px, py), m = Math.min(1, 0.3 + 2 * Math.max(...E));
        out.push({ k: "puff", x: px, y: py, d: ctx.depth(p), r: (0.06 + 0.15 * u) * ctx.ppm, a: 0.35 * (1 - u), rgb: [0.85 * m, 0.86 * m, 0.9 * m], ang: 0, len: 0 });
      }
    }
  } });
registerEffect({ id: "effortbreath", group: "combat", story: "effort in the cold (exert and hit events)", cost: { low: 0.01, high: 0.02 },
  step(ctx, out, set) {
    if (ctx.cold < 0.3) return;
    for (const e of ctx.events || []) {
      if (e.type !== "exert" && e.type !== "hit") continue; const u = age(ctx, e) / 0.7; if (u < 0 || u > 1) continue;
      const p = [e.at[0] + e.dir[0] * (0.25 + 0.4 * u), 1.55 + 0.15 * u, e.at[2] + e.dir[1] * (0.25 + 0.4 * u)], [px, py] = ctx.toPlate(p);
      out.push({ k: "puff", x: px, y: py, d: ctx.depth(p) - 0.3, r: (0.1 + 0.3 * u) * ctx.ppm, a: 0.45 * ctx.cold * (1 - u), rgb: [0.9, 0.92, 0.96], ang: 0, len: 0 });
    }
  } });
// blood, restrained: a hit that draws blood (power over 0.7) leaves two or three small drops that stay; no spray
registerEffect({ id: "blood", group: "combat", story: "heavy hits, kept to a few drops (harm shown through consequence)", cost: { low: 0.01, high: 0.02 },
  step(ctx, out, set) {
    const mem = ctx.mem; mem.drops ||= []; mem.bled ||= new Set();
    for (const [k, e] of (ctx.events || []).entries()) {
      const key = `${e.t0}|${e.at.join(",")}`; if (e.type !== "hit" || e.power < 0.7 || mem.bled.has(key) || ctx.t < e.t0) continue; mem.bled.add(key);
      for (let j = 0; j < 2 + Math.floor(hash(k, 9) * 2); j++) mem.drops.push({ at: [e.at[0] + e.dir[0] * (0.3 + 0.3 * hash(k, j, 4)), 0.02, e.at[2] + e.dir[1] * (0.3 + 0.3 * hash(k, j, 5))], r: 0.02 + 0.025 * hash(k, j, 6) });
    }
    mem.drops = mem.drops.slice(-40);
    for (const d of mem.drops) { const [px, py] = ctx.toPlate(d.at); out.push({ k: "drop", x: px, y: py, d: ctx.depth(d.at), r: d.r * ctx.ppm + 0.5, a: 0.85, rgb: [0.24, 0.03, 0.03], ang: 0, len: 0 }); }
  } });
// the wind-up's ring on the ground: tightening as the blow comes, doubled when it cannot be caught
registerEffect({ id: "telegraph", group: "combat", story: "an opponent winding up (windup events)", cost: { low: 0.02, high: 0.05 },
  step(ctx, out, set) {
    for (const e of ctx.events || []) {
      if (e.type !== "windup") continue; const u = age(ctx, e) / (e.dur || 0.6); if (u < 0 || u > 1) continue;
      for (const s of e.unstoppable ? [1, 0.82] : [1]) for (let j = 0; j < 24; j++) {
        const a = (j / 24) * 6.283, r = (1.1 - 0.6 * u) * s, p = [e.at[0] + Math.cos(a) * r, 0.03, e.at[2] + Math.sin(a) * r], [px, py] = ctx.toPlate(p);
        out.push({ k: "ring", x: px, y: py, d: ctx.depth(p), r: 0.03 * ctx.ppm + 0.6, a: 0.4 + 0.6 * u, rgb: [1, 0.35, 0.18], glow: true, ang: a + 1.571, len: 0.25 * r * ctx.ppm });
      }
    }
  } });
export const COMBAT = true;
