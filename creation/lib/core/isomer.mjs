// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// isomer.mjs: same properties, different structure (BLEED section 19; CORE.md). Operators that keep every weight and
// every tick value and change only the arrangement:
//   cisTrans(layers, i, j)   swap two layers' order (ink over paper against paper over ink)
//   enantiomer(layer)        mirror the tick field left to right (b and d; a melody and its inversion)
//   position(layer, dx, dy)  move the ticks (roll) without changing their values
//   functional(...)          the same parts recombined into another function (a palette as discs, pie, checker)
// isomerTest() keeps the weights fixed, applies one operator, and measures the change in the combined result (CIE76).
// It first checks for a symmetry that changes nothing (the meso case: a mirror of a symmetric field), which is
// reported as a symmetry, not counted as a difference. The control is a structure-blind reader (layers sorted into a
// canonical order and tick fields replaced by their sorted values before combining), which must fail to see it.
import { combine } from './combine.mjs';
import { deltaE } from './spectral.mjs';

const clone = L => ({ ...L, fields: Object.fromEntries(Object.entries(L.fields).map(([k, v]) => [k, Float32Array.from(v)])) });
export const cisTrans = (layers, i, j) => { const o = layers.slice(); [o[i], o[j]] = [o[j], o[i]]; return o; };
export function enantiomer(L) { const M = clone(L), { w, h } = L; for (const [key, f] of Object.entries(L.fields)) { const C = f.length / (w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < C; c++) M.fields[key][(y * w + x) * C + c] = f[(y * w + (w - 1 - x)) * C + c] * (key === 'vel' && c === 0 ? -1 : 1); } return M; }
export function position(L, dx, dy = 0) { const M = clone(L), { w, h } = L; for (const [key, f] of Object.entries(L.fields)) { const C = f.length / (w * h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < C; c++) M.fields[key][(y * w + x) * C + c] = f[(((y - dy) % h + h) % h * w + ((x - dx) % w + w) % w) * C + c]; } return M; }

const meanDE = (a, b) => { let d = 0, n = a.length / 3; for (let k = 0; k < n; k += 3) d += deltaE([a[3 * k], a[3 * k + 1], a[3 * k + 2]], [b[3 * k], b[3 * k + 1], b[3 * k + 2]]); return d / Math.ceil(n / 3); };
const sameFields = (A, B) => { for (const k of Object.keys(A.fields)) { const a = A.fields[k], b = B.fields[k]; for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - b[i]) > 1e-6) return false; } return true; };

// the structure-blind control: canonical layer order, tick values sorted (keeps every value, loses every place)
export function blindCombine(layers, weights) {
  const idx = layers.map((L, i) => i).sort((a, b) => (layers[a].gen + layers[a].name).localeCompare(layers[b].gen + layers[b].name));
  const flat = idx.map(i => { const L = clone(layers[i]); for (const f of Object.values(L.fields)) f.sort(); return L; });
  return combine(flat, weights ? idx.map(i => weights[i]) : null);
}

export function isomerTest(layers, operator, { weights = null, threshold = 1 } = {}) {
  const changed = operator(layers);
  const symmetric = changed.length === layers.length && changed.every((L, i) => L === layers[i] || (L.gen === layers[i].gen && sameFields(L, layers[i])));
  const a = combine(layers, weights).rgb, b = combine(changed, weights).rgb, split = meanDE(a, b);
  const ca = blindCombine(layers, weights).rgb, cb = blindCombine(changed, weights).rgb, control = meanDE(ca, cb);
  return { symmetry: symmetric, split: +split.toFixed(3), control: +control.toFixed(3), pass: symmetric ? split < 1e-3 : split > threshold && control < 0.05 };
}
