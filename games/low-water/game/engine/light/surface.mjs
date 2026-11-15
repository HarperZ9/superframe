// The surface terms of the light record: wetness, frost and fog depth per plate sample. Each style draws
// them its own way (paint: gloss and a cold film; glyph: mirrored type and rime marks); the light model
// says only where and how much. Frost melts round fires and stays off what a roof covers; thaw makes the
// ground wet round a fire; fog grows with distance from the camera (the wide lens's depth). Original code.
//   surfaceTerms(F, M)  fills F.rec.wet, F.rec.frost, F.rec.fog (0..255)
//   FOOT_WET            wetness by footing kind
import { camBasis } from "../world/plateworld.mjs";
import { isFire } from "./sources.mjs";

export const FOOT_WET = { water: 1, mud: 0.8, sand: 0.45, weed: 0.4, shingle: 0.3, stone: 0, wood: 0, cobble: 0, snow: 0 };
const RAIN_WET = { stone: 0.65, wood: 0.4, cobble: 0.7 };
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const hh = (i, j) => { let x = Math.imul(i | 0, 0x27d4eb2d) ^ Math.imul(j | 0, 0x165667b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); x ^= x >>> 13; return (x >>> 0) / 4294967296; };
function vnoise(x, y) { const i = Math.floor(x), j = Math.floor(y), u = (x - i) ** 2 * (3 - 2 * (x - i)), v = (y - j) ** 2 * (3 - 2 * (y - j)); return (hh(i, j) * (1 - u) + hh(i + 1, j) * u) * (1 - v) + (hh(i, j + 1) * (1 - u) + hh(i + 1, j + 1) * u) * v; }

// heat at a point from the fires in the model: 1 beside a fire, 0 past its warm radius
function heatAt(fires, x, y, z) {
  let h = 0; for (const L of fires) { const d = Math.hypot(L.at[0] - x, (L.at[1] - y) * 0.6, L.at[2] - z), r = L.warm; if (d < r) h = Math.max(h, (1 - d / r) ** 1.5 * L.decay.gain); }
  return h;
}
export function surfaceTerms(F, M) { const P = surfacePrep(F, M); surfaceRows(F, M, P, 0, F.h); }
// what every band shares: the weather, the fires, the fog's start depth
export function surfacePrep(F, M) {
  // a lit window burns tallow inside; it warms no ground, so windows are not fires here
  const T = M.terms || {}, fires = M.lights.filter((L) => isFire(L.kind) && L.group !== "window" && L.decay.on).map((L) => ({ ...L, warm: Math.min(5, 0.9 + 0.35 * L.reach) }));
  const B = camBasis(F.pj.camera), haze = (M.opt && M.opt.haze) || 1, fog = +T.fog || 0;
  let dmin = Infinity; for (let i = 0; i < F.n; i++) if (Number.isFinite(F.N[i * 3])) { const d = depth(F.pos, i, B); if (d < dmin) dmin = d; }
  return { rain: +T.rain || 0, frost: +T.frost || 0, foot: F.pj.footing || {}, fires, B, dmin, k: 0.0015 * haze + 0.03 * fog + (+T.mist || 0) };
}
export function surfaceRows(F, M, P, y0, y1) {
  const { rain, frost, foot, fires, B, dmin, k } = P;
  for (let i = y0 * F.w; i < Math.min(F.n, y1 * F.w); i++) {
    if (!Number.isFinite(F.N[i * 3])) continue;
    const x = F.pos[i * 3], y = F.pos[i * 3 + 1], z = F.pos[i * 3 + 2], ny = F.N[i * 3 + 1], kind = foot[idAt(F, i)] || "stone", heat = fires.length ? heatAt(fires, x, y, z) : 0;
    const flat = ny > 0.8, puddle = clamp((vnoise(x * 0.9 + 17, z * 0.9 - 4) - 0.35) / 0.3);
    let wet = flat ? FOOT_WET[kind] ?? 0 : 0; if (rain > 0) wet = Math.max(wet, (flat ? RAIN_WET[kind] ?? 0.5 : 0.2) * rain);
    if (frost > 0 && flat) wet = Math.max(wet, heat * 0.8 * frost);   // the thaw ring round a fire
    if (flat && kind !== "water") wet *= 0.35 + 0.65 * puddle;
    let fr = 0;
    if (frost > 0) {
      const covered = F.shadows && F.blocked(i, x + 0.3, y + 20, z + 0.3, 10);   // under a roof or an eave: no hoar
      fr = frost * (flat ? 1 : 0.35) * (covered ? 0.15 : 1) * (1 - heat) * (0.75 + 0.25 * vnoise(x * 3.1, z * 3.1));
    }
    F.rec.wet[i] = Math.round(255 * clamp(wet)); F.rec.frost[i] = Math.round(255 * clamp(fr));
    F.rec.fog[i] = Math.round(255 * clamp(1 - Math.exp(-k * Math.max(0, depth(F.pos, i, B) - dmin))));
  }
}
// a sample's material id; some plates keep ids at the plate's own size, twice the geo grid
export function idAt(F, i) {
  if (F.ids.length === F.n) return F.ids[i];
  const s = F.pj.geoScale || 1, x = i % F.w, y = (i / F.w) | 0; return F.ids[Math.min(F.pj.height - 1, Math.floor(y / s)) * F.pj.width + Math.min(F.pj.width - 1, Math.floor(x / s))];
}
const depth = (pos, i, B) => (pos[i * 3] - B.pos[0]) * B.f[0] + (pos[i * 3 + 1] - B.pos[1]) * B.f[1] + (pos[i * 3 + 2] - B.pos[2]) * B.f[2];
