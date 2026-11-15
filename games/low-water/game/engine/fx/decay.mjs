// Decay as staged effects (queue 4), not texture swaps: as a street's light index falls (light/decay.mjs: what it can
// still burn and mend), its plaster peels in patches, soot creeps up from the windows, weeds root at the wall's foot,
// the windows that went dark are boarded, and the lamps that went out are broken. Each stage comes in at its own point
// on the index, so a street declines in steps the player can read. Original code.
import { registerEffect, hash } from "./core.mjs";
import { lightIndex } from "../light/decay.mjs";
import { lightPlace } from "../light/places.mjs";
import { wallSpots } from "./ground.mjs";

const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const streetIndex = (ctx, at) => { const e = lightPlace(ctx.pj), s = e.streetOf(at) || e.street; return ctx.M.read ? lightIndex(ctx.M.read, s) : 1; };

registerEffect({ id: "peel", group: "decay", story: "the street's light index under 0.6", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    if (ctx.M.indoor) return;
    for (const [k, w] of wallSpots(ctx).entries()) {
      const d = ss(0.6, 0.2, streetIndex(ctx, w.at)), n = Math.round(d * (set.quality === "low" ? 2 : 5));
      for (let j = 0; j < n; j++) {
        if (hash(k, j, 21) > d) continue; const x = w.x + (hash(k, j, 22) - 0.5) * 0.9 * ctx.ppm, y = w.y + (hash(k, j, 23) - 0.3) * 0.8 * ctx.ppm, lift = hash(k, j, 24) > 0.5;
        out.push({ k: "peel", x, y, d: ctx.depth(w.at) - 0.05, r: (0.08 + 0.14 * hash(k, j, 25)) * ctx.ppm, a: 0.6, rgb: lift ? [0.62, 0.58, 0.5] : [0.2, 0.17, 0.15], ang: hash(k, j, 26) * 3, len: 0.08 * ctx.ppm });
      }
    }
  } });
registerEffect({ id: "sootcreep", group: "decay", story: "the street's light index under 0.5, the era's coal (eras 3 and 4 most)", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    if (ctx.M.indoor) return; const era = ctx.M.era === 3 || ctx.M.era === 4 ? 1 : 0.6;
    for (const [k, w] of wallSpots(ctx).entries()) {
      const d = ss(0.5, 0.15, streetIndex(ctx, w.at)) * era; if (hash(k, 31) > d) continue; const n = set.quality === "low" ? 2 : 4;
      for (let j = 0; j < n; j++) out.push({ k: "sootstreak", x: w.x + (j - n / 2) * 0.12 * ctx.ppm, y: w.y - 0.6 * ctx.ppm, d: ctx.depth(w.at) - 0.05, r: 0.05 * ctx.ppm, a: 0.5 * d, rgb: [0.08, 0.07, 0.07], ang: 1.571, len: (0.5 + 0.6 * hash(k, j, 32)) * ctx.ppm });
    }
  } });
registerEffect({ id: "weeds", group: "decay", story: "the street's light index under 0.45 (nobody sweeps)", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    if (ctx.M.indoor || ctx.cold > 0.8 && +(ctx.M.terms.snow || 0) > 0.5) return;   // under snow, no green shows
    for (const [k, w] of wallSpots(ctx).entries()) {
      const d = ss(0.45, 0.15, streetIndex(ctx, w.at)); if (hash(k, 41) > d) continue; const base = [w.at[0] + w.n[0] * 0.1, 0.02, w.at[2] + w.n[1] * 0.1], [bx, by] = ctx.toPlate(base);
      for (let j = 0; j < (set.quality === "low" ? 3 : 7); j++) out.push({ k: "weed", x: bx + (hash(k, j, 42) - 0.5) * 0.5 * ctx.ppm, y: by, d: ctx.depth(base), r: 0.015 * ctx.ppm + 0.4, a: 0.8, rgb: [0.22, 0.26, 0.12], ang: -1.571 + (hash(k, j, 43) - 0.5) * 0.9, len: (0.08 + 0.15 * hash(k, j, 44)) * ctx.ppm });
    }
  } });
// a window the street can no longer light is boarded, past a lower index; a street lamp that went out is broken
registerEffect({ id: "boards", group: "decay", story: "windows dark and the index under 0.3", cost: { low: 0.02, high: 0.05 },
  step(ctx, out, set) {
    ctx.M.lights.forEach((L, li) => {
      if (L.group !== "window" || L.decay.on || streetIndex(ctx, L.at) > 0.3 || hash(li, 51) > 0.6) return; const [px, py] = ctx.toPlate(L.at), d = ctx.depth(L.at) - 0.4;
      for (const a of [0.5, -0.5]) out.push({ k: "board", x: px - 0.25 * ctx.ppm, y: py + a * 0.15 * ctx.ppm, d, r: 0.04 * ctx.ppm, a: 0.95, rgb: [0.2, 0.15, 0.11], ang: a * 0.6, len: 0.5 * ctx.ppm });
    });
  } });
registerEffect({ id: "brokenlamps", group: "decay", story: "street lamps gone out", cost: { low: 0.02, high: 0.05 },
  step(ctx, out, set) {
    ctx.M.lights.forEach((L, li) => {
      if (L.role !== "lamp" || L.decay.on) return; const [px, py] = ctx.toPlate(L.at), d = ctx.depth(L.at) - 0.1;
      for (let j = 0; j < 4; j++) out.push({ k: "shard", x: px + (hash(li, j, 61) - 0.5) * 0.15 * ctx.ppm, y: py + hash(li, j, 62) * 0.1 * ctx.ppm, d, r: 0.6, a: 0.7, rgb: [0.55, 0.6, 0.65], ang: hash(li, j, 63) * 3, len: 1.5 });
    });
  } });
export const DECAY = true;
