// Fire and lamp (effects queue 2): flame tongues and embers at every fire the light model burns, sparks off the brazier
// and the open stove, tallow's thin smoke, and the export train's steam and soot. Every flame reads its light's gain, so
// the flame and the light it throws move together (the light model's flicker), and a fire the street can no longer feed
// is small in both. Original code.
import { registerEffect, hash, hidden } from "./core.mjs";
// a primitive behind the plate's own surface (a flame inside the firebox, a spark behind the chimney) is not drawn
const push = (ctx, out, p) => { if (!hidden(ctx, p.x, p.y, p.d + 0.1)) out.push(p); };
import { isFire } from "../light/sources.mjs";

// a flame's size (m) by kind, and whether it throws sparks
const SIZE = { stove: [0.06, true], brazier: [0.45, true], embers: [0, false], candle: [0.045, false], tallow: [0.06, false], rush: [0.05, false], paraffin: [0.05, false] };
const fires = (ctx) => ctx.M.lights.map((L, i) => ({ L, i })).filter(({ L }) => (isFire(L.kind) || L.kind === "paraffin") && L.group !== "window" && L.decay.on);
// with flicker reduced the flame keeps its size but not its jumps
const gainOf = (ctx, i, set) => { const g = ctx.gains[i], base = ctx.M.lights[i].decay.gain; return set.flicker === "full" ? g : set.flicker === "reduced" ? base + (g - base) * 0.3 : base; };

registerEffect({ id: "flame", group: "fire", story: "each fire's and lamp's gain (flicker, decay)", cost: { low: 0.05, high: 0.15 },
  step(ctx, out, set) {
    for (const { L, i } of fires(ctx)) {
      const [sz] = SIZE[L.kind] || [0.05], g = gainOf(ctx, i, set), n = sz > 0.1 ? (set.quality === "low" ? 3 : 6) : 1;
      for (let j = 0; j < n; j++) {
        const h = sz * g ** 0.7 * (0.6 + 0.6 * hash(i, j)), sway = set.motion === "reduced" ? 0 : 0.25 * sz * Math.sin(ctx.t * (6 + j) + j * 2);
        const base = [L.at[0] + (hash(i, j, 2) - 0.5) * sz * 0.8, L.at[1] - sz * 0.3, L.at[2] + (hash(i, j, 3) - 0.5) * sz * 0.5], tip = [base[0] + sway, base[1] + h, base[2]];
        const [bx, by] = ctx.toPlate(base), [tx, ty] = ctx.toPlate(tip);
        push(ctx, out, { k: "flame", x: bx, y: by, d: ctx.depth(base) - 0.1, r: Math.max(1, sz * 0.35 * ctx.ppm), a: 0.9, rgb: L.rgb.map((v, c) => Math.min(1, v * 0.7 + [0.3, 0.22, 0.1][c])), ang: Math.atan2(ty - by, tx - bx), len: Math.hypot(tx - bx, ty - by), glow: true });
      }
    }
  } });
registerEffect({ id: "embers", group: "fire", story: "a fire kept in: the coals breathe slowly", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    for (const { L, i } of fires(ctx)) {
      if (!(L.kind === "embers" || L.kind === "stove" || L.kind === "brazier")) continue; const n = set.quality === "low" ? 4 : 10, g = gainOf(ctx, i, set);
      for (let j = 0; j < n; j++) {
        const p = [L.at[0] + (hash(i, j, 4) - 0.5) * 0.35, L.at[1] - 0.12, L.at[2] + (hash(i, j, 5) - 0.5) * 0.25], [px, py] = ctx.toPlate(p), br = 0.5 + 0.5 * Math.sin(ctx.t * (0.6 + hash(i, j, 6)) + j) * (set.flicker === "off" ? 0 : 1);
        push(ctx, out, { k: "ember", x: px, y: py, d: ctx.depth(p) - 0.1, r: 0.025 * ctx.ppm + 0.6, a: (0.5 + 0.5 * br) * Math.min(1, g), rgb: [1, 0.3 + 0.2 * br, 0.05], glow: true, ang: 0, len: 0 });
      }
    }
  } });
// sparks: each slot of 1.3 s a spark may leave the fire, more as it burns higher; they arc up and die out
registerEffect({ id: "sparks", group: "fire", story: "the brazier and the open stove, by their gain", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    if (set.motion === "reduced") return;
    for (const { L, i } of fires(ctx)) {
      const sp = SIZE[L.kind]; if (!sp || !sp[1]) continue; const n = set.quality === "low" ? 4 : 10, g = ctx.gains[i];
      for (let j = 0; j < n; j++) {
        const life = 1.3, ph = hash(i, j, 7) * life, slot = Math.floor((ctx.t + ph) / life), u = ((ctx.t + ph) % life) / life; if (hash(i, j, slot) > 0.35 * g) continue;
        const vx = (hash(i, j, slot + 1) - 0.5) * 0.8, vz = (hash(i, j, slot + 2) - 0.5) * 0.6, up = 1.4 + hash(i, j, slot + 3);
        const p = [L.at[0] + vx * u + ctx.wind * 0.6 * u, L.at[1] + up * u - 0.8 * u * u, L.at[2] + vz * u], [px, py] = ctx.toPlate(p);
        push(ctx, out, { k: "spark", x: px, y: py, d: ctx.depth(p) - 0.1, r: 0.6, a: (1 - u) * 0.95, rgb: [1, 0.75, 0.3], glow: true, ang: -1.2, len: 2.5 });
      }
    }
  } });
// tallow smokes: a thin dark thread off a tallow dip or a rushlight, bent by the room's draught
registerEffect({ id: "tallowsmoke", group: "fire", story: "the poor table's light", cost: { low: 0.05, high: 0.1 },
  step(ctx, out, set) {
    for (const { L, i } of fires(ctx)) {
      if (!(L.kind === "tallow" || L.kind === "rush")) continue; const n = set.quality === "low" ? 5 : 12;
      for (let j = 0; j < n; j++) {
        const h = j / n, wob = set.motion === "reduced" ? 0 : 0.04 * Math.sin(ctx.t * 1.7 + h * 9) * (1 + h * 3), p = [L.at[0] + wob + h * 0.15, L.at[1] + 0.06 + h * 0.7, L.at[2] + wob * 0.5], [px, py] = ctx.toPlate(p);
        push(ctx, out, { k: "smoke", x: px, y: py, d: ctx.depth(p) - 0.1, r: (0.01 + 0.04 * h) * ctx.ppm + 0.5, a: 0.3 * (1 - h), rgb: [0.2, 0.18, 0.17], ang: 1.571, len: 0.06 * ctx.ppm });
      }
    }
  } });
// the export train: steam from the chimney rising and drifting with the wind (white, lit by its own lamp), soot under it
registerEffect({ id: "steam", group: "fire", story: "the export train (places.mjs train)", cost: { low: 0.1, high: 0.3 },
  step(ctx, out, set) {
    const dyn = ctx.M.dynamic(ctx.t); if (!dyn.length) return; const L = dyn[0], dir = (L.cone && L.cone.dir) || [0, 0, -1], n = set.quality === "low" ? 14 : 40;
    const stack = [L.at[0] - dir[0] * 2.5, L.at[1] + 1.4, L.at[2] - dir[2] * 2.5], moving = L.moving ? 1 : 0.35;
    for (let j = 0; j < n; j++) {
      const age = ((ctx.t * moving * 0.4 + j / n) % 1), soot = j % 4 === 0, slow = set.motion === "reduced" ? 0.3 : 1;
      const p = [stack[0] - dir[0] * age * 6 * moving + ctx.wind * age * 3 * slow, stack[1] + age * 3.5 * slow, stack[2] - dir[2] * age * 6 * moving], [px, py] = ctx.toPlate(p);
      out.push({ k: soot ? "soot" : "steam", x: px, y: py, d: ctx.depth(p) - 0.5, r: (0.35 + age * 1.6) * ctx.ppm * 0.6, a: (soot ? 0.4 : 0.6) * (1 - age * 0.8), rgb: soot ? [0.08, 0.07, 0.07] : [0.85, 0.86, 0.9], ang: 0, len: 0 });
    }
  } });
export const FIRE = true;
