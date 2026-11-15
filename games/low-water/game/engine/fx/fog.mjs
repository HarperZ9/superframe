// Fog by height, lit from within (the author's section 15, for era 5 and the storm nights): density falls off with
// height over the lowest ground, light is scattered toward the eye by every lamp in it (so an uplight dissolves a tower's
// crown into gold, a lit floor half drowns in cloud, steam rising through a lamp glows), and the scene behind is lost to
// it with distance. The same model makes the smoke weather the community model can set (fields burning, a riot, a
// clearance fire): a much shorter extinction and a warm albedo, so everything past about 50 m is gone in orange.
// Rendered as a layer (colour and how much of the scene it hides) at a quarter of the geo grid, rebuilt when the weather
// or the hour moves. Original code.
//   fogParams(M)                      -> { density, height, albedo, warm } from the terms (fog, mist) and the smoke stock
//   fogLayer(ctx, { step, steps })    -> { k: "layer", fog: true, ... } (RGBA: in-scattered colour, alpha = 1 - transmittance)
import { registerEffect } from "./core.mjs";
import { camBasis } from "../world/plateworld.mjs";
import { coneK } from "../light/train.mjs";

export function fogParams(M) {
  const T = M.terms || {}, read = M.read, smoke = Math.max(+(T.smoke || 0), read ? +(read("smoke", "") || 0) : 0), fog = +(T.fog || 0) + (+(T.mist || 0)) * 40;
  if (smoke > 0.05) return { density: 0.02 + 0.07 * smoke, height: 14, albedo: [1.0, 0.55, 0.25], warm: smoke, smoke };   // extinction ~ 1 / (density) -> 50 m at 0.6
  return { density: 0.004 + 0.05 * Math.min(1, fog), height: 2.5 + 4 * Math.min(1, fog), albedo: [0.8, 0.82, 0.88], warm: 0, smoke: 0 };
}
// light in the air at a point: lamps (their cones honoured) with a forward-leaning phase, the sky's ambient
function scatterAt(ctx, p, view, P) {
  // smoke from fires: the haze carries the fires' own glow, lower down stronger (the burning is on the ground)
  const M = ctx.M, G = ctx.gains, S = ctx.sky, glow = P.smoke ? P.smoke * 0.35 * Math.exp(-Math.max(0, p[1]) / 8) : 0, out = S.amb.map((v, c) => v * 0.35 + [1, 0.42, 0.14][c] * glow);
  for (let i = 0; i < M.lights.length; i++) {
    const L = M.lights[i]; if (G[i] < 0.02) continue; const dx = L.at[0] - p[0], dy = L.at[1] - p[1], dz = L.at[2] - p[2], d = Math.hypot(dx, dy, dz), r = L.reach * 1.4; if (d >= r) continue;
    const f = 1 - d / r, cos = -(dx * view[0] + dy * view[1] + dz * view[2]) / (d || 1), phase = 0.6 + 0.8 * Math.max(0, cos) ** 2;   // brighter looking toward the lamp
    const e = L.e0 * G[i] * f * f * phase * (L.cone ? coneK(L, p) : 1); for (let c = 0; c < 3; c++) out[c] += L.rgb[c] * e;
  }
  return out;
}
export function fogLayer(ctx, opt = {}) { const g = fogSteps(ctx, opt); let r; do r = g.next(); while (!r.done); return r.value; }
// the same, a few rows at a time, so a game frame spends at most a few milliseconds on it
export function* fogSteps(ctx, { step = 4, steps = 28, maxDepth = 120 } = {}) {
  const F = ctx.F; if (!F) return null; const P = fogParams(ctx.M); if (P.density < 0.005 && !P.smoke) return null;
  const B = camBasis(ctx.pj.camera), f = B.f, w = Math.ceil(F.w / step), h = Math.ceil(F.h / step), rgba = new Uint8ClampedArray(w * h * 4);
  let gy = Infinity; for (let i = 0; i < F.n; i += 9) { const y = F.pos[i * 3 + 1]; if (Number.isFinite(y) && y < 500) gy = Math.min(gy, y); }
  for (let y = 0; y < h; y++) { if (y % 4 === 0 && y) yield null; for (let x = 0; x < w; x++) {
    const i = Math.min(F.h - 1, y * step) * F.w + Math.min(F.w - 1, x * step), py = F.pos[i * 3 + 1]; if (!Number.isFinite(py)) continue;
    const sky = py > 500, end = sky ? null : [F.pos[i * 3], py, F.pos[i * 3 + 2]], len = sky ? maxDepth * 0.5 : Math.min(maxDepth, 60 + 20 * (P.smoke ? 1 : 0));
    let T = 1; const L = [0, 0, 0], dt = len / steps;
    for (let s = steps - 1; s >= 0 && end; s--) {   // from the surface toward the eye, front to back
      const t = (s + 0.5) * dt, p = [end[0] - f[0] * t, end[1] - f[1] * t, end[2] - f[2] * t], dens = P.density * Math.exp(-Math.max(0, p[1] - gy) / P.height); if (dens < 1e-5) continue;
      const a = 1 - Math.exp(-dens * dt), sc = scatterAt(ctx, p, f, P);
      for (let c = 0; c < 3; c++) L[c] += T * a * sc[c] * P.albedo[c] * 1.6; T *= 1 - a; if (T < 0.02) break;
    }
    const o = (y * w + x) * 4, m = Math.max(1e-4, 1 - T);
    for (let c = 0; c < 3; c++) rgba[o + c] = Math.round(255 * Math.pow(Math.min(1, L[c] / m), 1 / 2.2)); rgba[o + 3] = Math.round(255 * Math.min(1, 1 - T));
  } }
  return { k: "layer", id: "fog", ch: null, w, h, scale: w / ctx.pj.width, rgba, x: 0, y: 0, d: 0, r: 0, a: 1, rgb: [1, 1, 1], smooth: true };
}
registerEffect({ id: "fog", group: "air", story: "terms.fog and mist; the smoke stock (fields burning, a riot, a clearance fire)", cost: { low: 4, high: 12 },
  step(ctx, out, set) {
    const P = fogParams(ctx.M), key = `${Math.round(ctx.M.hour * 4)}|${P.density.toFixed(3)}|${set.quality}`;
    // rebuilt in steps when the weather or the quarter hour moves (in node, or with ctx.sync, at once); the old layer shows meanwhile
    if (ctx.mem.fogKey !== key) { ctx.mem.fogKey = key; ctx.mem.fogJob = fogSteps(ctx, { step: set.quality === "low" ? 6 : 3 }); }
    if (ctx.mem.fogJob) { const t0 = performance.now(); let r; do r = ctx.mem.fogJob.next(); while (!r.done && (ctx.sync || performance.now() - t0 < 3)); if (r.done) { ctx.mem.fog = r.value; ctx.mem.fogJob = null; } }
    if (ctx.mem.fog) out.push(ctx.mem.fog);
  } });
export const FOG = true;
