// Impulse responses we make ourselves: early reflections from a box room's first-order images, then a
// late tail of decorrelated noise whose decay differs per band (stone keeps the highs, wool and bodies
// eat them), and for outdoor places a few slap echoes off the façades instead of a room. One IR per place
// type, plus a long designed space.
import { SR, rng, biquad } from "./dsp.mjs";

export const ROOMS = {
  kitchen: { size: [4.2, 3.6, 2.6], t60: [0.55, 0.42, 0.3, 0.18], density: 1, pre: 0.004, er: 0.5 },     // wool, wood, bodies
  office: { size: [7, 5, 3.4], t60: [0.9, 0.8, 0.65, 0.45], density: 1, pre: 0.008, er: 0.6 },          // plaster and files
  granary: { size: [18, 10, 9], t60: [2.2, 1.9, 1.4, 0.8], density: 1, pre: 0.02, er: 0.5 },          // planks and grain
  square: { slaps: [[0.062, 0.32], [0.141, 0.22], [0.233, 0.15], [0.37, 0.09]], t60: [1.3, 1.1, 0.8, 0.45], density: 0.35, pre: 0.012, er: 0 },
  tower: { slaps: [[0.19, 0.2], [0.42, 0.14], [0.8, 0.08]], t60: [1.8, 1.4, 0.9, 0.5], density: 0.25, pre: 0.03, er: 0 },
  road: { slaps: [[0.31, 0.1]], t60: [0.6, 0.45, 0.3, 0.2], density: 0.2, pre: 0.01, er: 0 },          // open plain, frost
  yard: { size: [24, 16, 10], t60: [1.6, 1.4, 1.0, 0.6], density: 0.8, pre: 0.015, er: 0.45 },         // a brick yard
  space: { size: [40, 30, 20], t60: [6.5, 5.5, 4.2, 2.6], density: 1, pre: 0.035, er: 0.25 },          // the score's own room
};
const BANDS = [[0, 250], [250, 1200], [1200, 4500], [4500, 20000]];

function earlyTaps(o, r) {
  if (o.slaps) return o.slaps.map(([t, g]) => ({ t: t + o.pre, g, pan: r.bi() * 0.8 }));
  const [x, y, z] = o.size, c = 343, taps = [];
  for (const d of [x, y, z, x * 1.3, y * 1.4, Math.hypot(x, y), Math.hypot(y, z), Math.hypot(x, z)]) {
    taps.push({ t: o.pre + d / c * (0.9 + r() * 0.2), g: o.er * 2 / (1 + d), pan: r.bi() * 0.9 });
  }
  return taps;
}

export function makeIR(name, seed = 7) {
  const o = ROOMS[name], r = rng(seed + name.length * 101);
  const len = Math.round((Math.max(...o.t60) * 1.1 + o.pre + 0.05) * SR);
  const L = new Float32Array(len), R = new Float32Array(len);
  for (const tp of earlyTaps(o, r)) {
    const i = Math.round(tp.t * SR); if (i >= len) continue;
    L[i] += tp.g * (1 - tp.pan) * 0.7; R[i] += tp.g * (1 + tp.pan) * 0.7;
  }
  const start = Math.round((o.pre + 0.01) * SR);
  for (const [ch, out] of [[0, L], [1, R]]) {
    for (let b = 0; b < BANDS.length; b++) {
      const rr = rng(seed * 13 + ch * 7 + b), [lo, hi] = BANDS[b];
      const hp = lo ? biquad("hp", lo, 0.7) : (x) => x, lp = hi < 20000 ? biquad("lp", hi, 0.7) : (x) => x;
      const k = Math.exp(-6.9078 / (o.t60[b] * SR));
      let g = 0.25;
      for (let i = start; i < len; i++) {
        const ramp = Math.min(1, (i - start) / (0.02 * SR));
        const sparse = o.density < 1 && rr() > o.density ? 0 : rr.bi() / Math.sqrt(o.density);
        out[i] += lp(hp(sparse)) * g * ramp; g *= k;
      }
    }
  }
  return normalise([L, R]);
}
// unit energy, so a wet send's level means the same in every room
function normalise(pair) {
  let e = 0; for (const c of pair) for (let i = 0; i < c.length; i++) e += c[i] * c[i];
  const g = 1 / Math.sqrt(e / 2 || 1);
  for (const c of pair) for (let i = 0; i < c.length; i++) c[i] *= g;
  return pair;
}
