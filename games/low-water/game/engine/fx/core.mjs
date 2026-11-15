// The effects layer (design/state/light.md, "Effects interface"): every effect is a function of the scene's state and
// the time that returns primitives on the plate (snowflakes, breath, embers, motes, steam...). Each style draws the same
// primitives its own way: the painted style as dabs and strokes (paint.mjs), the glyph style as marks in its grid
// (glyph.mjs). Effects are deterministic in (state, t) wherever they can be (a still capture freezes them), are tied to
// story or state (the light model's terms, the era, the street, the figures), have a quality setting, and honour the
// accessibility settings for flicker and motion. Original code.
//   const S = fxSettings(query)        { quality: off|low|high, flicker: full|reduced|off, motion: full|reduced, only }
//   registerEffect(def)                 def: { id, group, story, cost: {low, high}, step(ctx, out) }
//   runEffects(ctx, settings)           -> { prims, ms: { id: ms } }    ctx: see fxContext
//   fxContext({ M, F, pj, t, figures, wind, view }) -> the shared context every effect reads
//   A primitive: { k (kind), x, y (plate px), d (depth from the camera, m), r (px), a (0..1), rgb (linear 0..1), ang, len, glow }
import { camBasis } from "../world/plateworld.mjs";
import { basis } from "../light/geo.mjs";

export const EFFECTS = [];
export function registerEffect(def) { if (!EFFECTS.find((e) => e.id === def.id)) EFFECTS.push(def); return def; }
const pick = (q, k, vals, d) => { const v = q && q.get && q.get(k); return vals.includes(v) ? v : d; };
export function fxSettings(q = null, saved = {}) {
  return {
    quality: pick(q, "fx", ["off", "low", "high"], saved.quality || "high"),
    flicker: pick(q, "fxflicker", ["full", "reduced", "off"], saved.flicker || "full"),
    motion: pick(q, "fxmotion", ["full", "reduced"], saved.motion || "full"),
    only: q && q.get && q.get("fxonly") ? q.get("fxonly").split(",") : null,
  };
}
// world to plate pixels (orthographic: affine), and the depth along the camera's view, from the light model's geometry
export function fxContext({ M, F, pj, t = 0, figures = [], wind = 0.4, view = null, prev = null, day = null, sync = false }) {
  const B = basis(pj), C = camBasis(pj.camera), s = B.s;
  const toPlate = (p) => [(B.o[0] + B.x[0] * p[0] + B.y[0] * p[1] + B.z[0] * p[2]) / s, (B.o[1] + B.x[1] * p[0] + B.y[1] * p[1] + B.z[1] * p[2]) / s];
  const depth = (p) => (p[0] - C.pos[0]) * C.f[0] + (p[1] - C.pos[1]) * C.f[1] + (p[2] - C.pos[2]) * C.f[2];
  const ppm = (pj.pxPerMetre || 40), cold = Math.min(1, (+(M.terms && M.terms.frost) || 0) + (M.era === 2 && !M.indoor ? 0.4 : 0));
  return { M, F, pj, t, day, sync, figures, wind, view, toPlate, depth, ppm, cold, gains: M.gains(t), sky: M.sky, prev, mem: (prev && prev.mem) || {} };
}
// is a world point hidden behind the plate's own surface at its pixel? (the effect sits behind a wall)
export function hidden(ctx, x, y, d) {
  const F = ctx.F; if (!F) return false; const s = F.w / ctx.pj.width, X = Math.floor(x * s), Y = Math.floor(y * s); if (X < 0 || Y < 0 || X >= F.w || Y >= F.h) return true;
  const i = Y * F.w + X, py = F.pos[i * 3 + 1]; if (!Number.isFinite(py) || py > 500) return false;
  return ctx.depth([F.pos[i * 3], py, F.pos[i * 3 + 2]]) < d - 0.25;
}
export function runEffects(ctx, settings) {
  const prims = [], ms = {}; if (settings.quality === "off") return { prims, ms };
  for (const e of EFFECTS) {
    if (settings.only && !settings.only.includes(e.id) && !settings.only.includes(e.group)) continue;
    const t0 = performance.now(), n0 = prims.length; e.step(ctx, prims, settings);
    ms[e.id] = +(performance.now() - t0).toFixed(3); ms[`${e.id}#`] = prims.length - n0;
  }
  return { prims, ms };
}
// deterministic noise for effects
export const hash = (a, b = 0, c = 0) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
export const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// the light in the air at a world point (a flake, a breath): every lamp and fire at full incidence (a mote turns to
// every light), the moving lights inside their cones, the sun and moon, and only a little of the sky's ambient, so a
// flake between the lamps is nearly black and one inside a pool is bright: the famine winter's snow
import { coneK } from "../light/train.mjs";
export function airLight(ctx, p) {
  const M = ctx.M, G = ctx.gains, S = ctx.sky, out = S.amb.map((v) => v * 0.12);
  const add = (L, g) => { const dx = L.at[0] - p[0], dy = L.at[1] - p[1], dz = L.at[2] - p[2], d = Math.hypot(dx, dy, dz); if (d >= L.reach) return; const f = 1 - d / L.reach, e = L.e0 * f * f * g * (L.cone ? coneK(L, p) : 1); for (let c = 0; c < 3; c++) out[c] += L.rgb[c] * e; };
  for (let i = 0; i < M.lights.length; i++) if (G[i] > 0.01) add(M.lights[i], G[i]);
  for (const L of ctx.dyn || (ctx.dyn = M.dynamic(ctx.t))) add(L, 1);
  if (S.sun.E > 0) for (let c = 0; c < 3; c++) out[c] += S.sun.rgb[c] * S.sun.E * 0.6;
  if (S.moon.E > 0) for (let c = 0; c < 3; c++) out[c] += S.moon.rgb[c] * S.moon.E * 0.6;
  return out;
}
// the light falling at a world point, from the light field at the nearest plate sample (or the sky)
export function lightAt(ctx, x, y) {
  const F = ctx.F; if (!F) return ctx.sky.amb; const s = F.w / ctx.pj.width, X = Math.min(F.w - 1, Math.max(0, Math.floor(x * s))), Y = Math.min(F.h - 1, Math.max(0, Math.floor(y * s))), i = Y * F.w + X;
  return Number.isFinite(F.N[i * 3]) ? [F.E[i * 3], F.E[i * 3 + 1], F.E[i * 3 + 2]] : ctx.sky.amb;
}
