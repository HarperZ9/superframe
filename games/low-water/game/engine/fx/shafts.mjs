// Light in the air (the author's section 11 reference: shafts through lattice and stained windows): along each pixel's
// view ray inside the place, the light scattered toward the eye. Two kinds of volume: a window's shaft (the pane's
// aperture carried into the room along the sun, or along the sky's slant when the sun is not on that wall, the glazing
// bars cut out of it as a lattice), and the air round a lamp in mist or falling snow (the carbide lamp over the granary
// door). Rendered as a plate-anchored layer at half the geo grid, rebuilt when the hour or the gains move; the dust in a
// room's air (weather.mjs motes) is lit only inside the shafts. Original code.
//   shaftLayer(ctx, { step }) -> { k: "layer", ... rgba } or null
//   inShaft(ctx, p) -> 0..1 the shaft density at a world point (for the motes)
import { registerEffect, lum } from "./core.mjs";
import { camBasis } from "../world/plateworld.mjs";

// each window's frame: its centre, the normal into the room (toward the plate's middle), its width and height
function windowsOf(ctx) {
  if (ctx.mem.shaftWins) return ctx.mem.shaftWins; const out = [];
  ctx.M.lights.forEach((L, i) => {
    if (L.kind !== "window") return; const n = [-L.at[0], 0, -L.at[2]], l = Math.hypot(n[0], n[2]) || 1;
    out.push({ i, c: L.at, n: [n[0] / l, 0, n[2] / l], u: [-n[2] / l, 0, n[0] / l], hw: 0.32, hh: 0.42, rgb: L.rgb });
  });
  return (ctx.mem.shaftWins = out);
}
// the shaft's direction into the room: the sun's, reversed, when it shines on that wall from outside; else the sky's slant
function shaftDir(ctx, w) {
  const s = ctx.sky.sun, d = [-s.dir[0], -s.dir[1], -s.dir[2]], into = d[0] * w.n[0] + d[2] * w.n[2];
  if (s.E > 0.02 && into > 0.2 && d[1] < 0) return { dir: d, k: Math.min(1, s.E * 4), rgb: s.rgb };
  const t = [w.n[0] * 0.8, -0.6, w.n[2] * 0.8], l = Math.hypot(...t); return { dir: t.map((v) => v / l), k: Math.min(1, lum(ctx.sky.amb) * 3) * 0.5, rgb: ctx.sky.amb.map((v) => v / (Math.max(...ctx.sky.amb) || 1)) };
}
export function inShaft(ctx, p) {
  let best = 0;
  for (const w of windowsOf(ctx)) {
    const S = shaftDir(ctx, w), q = [p[0] - w.c[0], p[1] - w.c[1], p[2] - w.c[2]], along = q[0] * S.dir[0] + q[1] * S.dir[1] + q[2] * S.dir[2]; if (along < 0 || along > 4.5) continue;
    const a = [q[0] - S.dir[0] * along, q[1] - S.dir[1] * along, q[2] - S.dir[2] * along], x = a[0] * w.u[0] + a[2] * w.u[2], y = a[1];
    if (Math.abs(x) > w.hw || Math.abs(y) > w.hh) continue;
    const bars = Math.abs(x) < 0.025 || Math.abs(Math.abs(y) - w.hh / 3) < 0.022 ? 0 : 1;   // the glazing bars' shadow: a lattice in the shaft
    best = Math.max(best, bars * S.k * (1 - along / 4.5));
  }
  return best;
}
// a lamp's air: in mist or snow, light scattered round it falling off with distance
function lampAir(ctx, p) {
  const fog = Math.min(1, (+(ctx.M.terms.snowfall || 0)) * 0.8 + (+(ctx.M.terms.mist || 0)) * 60); if (fog <= 0) return [0, 0, 0]; const out = [0, 0, 0];
  ctx.M.lights.forEach((L, i) => { if (L.kind === "window" || L.group === "window" || ctx.gains[i] < 0.05) return; const d = Math.hypot(L.at[0] - p[0], L.at[1] - p[1], L.at[2] - p[2]), r = Math.min(4, L.reach * 0.4); if (d > r) return; const e = L.e0 * ctx.gains[i] * (1 - d / r) ** 2 * fog * 0.3; for (let c = 0; c < 3; c++) out[c] += L.rgb[c] * e; });
  return out;
}
export function shaftLayer(ctx, opt = {}) { const g = shaftSteps(ctx, opt); let r; do r = g.next(); while (!r.done); return r.value; }
export function* shaftSteps(ctx, { step = 2, steps = 36, maxDepth = 9 } = {}) {
  const F = ctx.F, wins = windowsOf(ctx), lamps = (+(ctx.M.terms.snowfall || 0)) > 0 || (+(ctx.M.terms.mist || 0)) > 0; if (!F || (!wins.length && !lamps)) return null;
  const B = camBasis(ctx.pj.camera), w = Math.ceil(F.w / step), h = Math.ceil(F.h / step), rgba = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) { if (y % 6 === 0 && y) yield null; for (let x = 0; x < w; x++) {
    const i = Math.min(F.h - 1, y * step) * F.w + Math.min(F.w - 1, x * step), py = F.pos[i * 3 + 1]; if (!Number.isFinite(py)) continue;
    const surf = py > 500 ? null : [F.pos[i * 3], py, F.pos[i * 3 + 2]], len = surf ? maxDepth : maxDepth * 0.5, acc = [0, 0, 0];
    for (let s = 0; s < steps; s++) {
      const t = ((s + 0.5) / steps) * len, p = surf ? [surf[0] - B.f[0] * t, surf[1] - B.f[1] * t, surf[2] - B.f[2] * t] : null; if (!p) break;
      for (const W of wins) { const k = inShaft(ctx, p); if (k > 0) { const S = shaftDir(ctx, W); for (let c = 0; c < 3; c++) acc[c] += S.rgb[c] * k * (len / steps) * 0.55; } break; }
      if (lamps) { const a = lampAir(ctx, p); for (let c = 0; c < 3; c++) acc[c] += a[c] * (len / steps); }
    }
    const m = Math.max(...acc); if (m < 0.004) continue; const o = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(255 * Math.min(1, acc[c] / m)); rgba[o + 3] = Math.round(255 * Math.min(0.85, m * 1.6));
  } }
  return { k: "layer", id: "shafts", ch: null, glow: true, w, h, scale: w / ctx.pj.width, rgba, x: 0, y: 0, d: 0, r: 0, a: 1, rgb: [1, 1, 1] };
}
registerEffect({ id: "shafts", group: "air", story: "a window's daylight and the hour's sun; a lamp's air in snow or mist", cost: { low: 1, high: 3 },
  step(ctx, out, set) {
    // rebuilt each quarter hour of the clock, a few rows a frame in the game (3 ms; in node, or with ctx.sync, at once)
    const key = `${Math.round(ctx.M.hour * 4)}|${set.quality}`;
    if (ctx.mem.shaftKey !== key) { ctx.mem.shaftKey = key; ctx.mem.shaftJob = shaftSteps(ctx, { step: set.quality === "low" ? 4 : 2 }); }
    if (ctx.mem.shaftJob) { const t0 = performance.now(); let r; do r = ctx.mem.shaftJob.next(); while (!r.done && (ctx.sync || performance.now() - t0 < 3)); if (r.done) { ctx.mem.shafts = r.value; ctx.mem.shaftJob = null; } }
    if (ctx.mem.shafts) out.push(ctx.mem.shafts);
  } });
export const SHAFTS = true;
