// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// material: the material plate. One form held constant (a lit cylinder), and each material is a mark law with
// weights, after the material-differentiation drawing template the author saved (yo4no2kasa, 2026-10-25; reference
// only: its image is not on disk here, and the laws are rebuilt from the description, never traced). From first
// principles:
//   form       a cylinder seen from the side: Lambert shade across its width (light from the upper left), an
//              elliptical top, so tone T(x, y) is the same for every material
//   marks      ink where the material's pattern field, thresholded by tone, says so. Pattern fields:
//                hatch   phase lines at angle theta, pitch p; `wrap` bends them round the cylinder (cross-contour)
//                stipple seeded dots whose probability follows tone
//                arcs    overlapping half-circle rows (scales)
//                cells   a Voronoi-like crack network (stone, soil)
//                grain   rings around a moving centre (wood, plank)
//                dash    short strokes along theta with length L (grass, hair, cloth weave as two crossing sets)
//                waves   sine-bent lines (water)
//   solid      tone above `solid` prints flat black; `gap` leaves a specular band unmarked; `edge` breaks the
//              silhouette with noise (fur, grass, leaves)
// Each material is a weight vector over those laws. A front (lib/core/ticks.mjs scheduleFront) can carry a cylinder
// from one material to another tick by tick: every cell renders with weights lerped by its own front weight.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, smooth, rngFrom } from '../core/layer.mjs';
import { scheduleFront, weightAt } from '../core/ticks.mjs';

// weights: [hatch, stipple, arcs, cells, grain, dash, waves], theta (deg), pitch, wrap, solid, gap, edge, len, cross
export const MATERIALS = {
  grass: { mix: [0, 0, 0, 0, 0, 1, 0], theta: 80, pitch: 3, wrap: 0, solid: 0.95, gap: 0, edge: 0.9, len: 5, cross: 0 },
  wood: { mix: [0.3, 0, 0, 0, 1, 0, 0], theta: 90, pitch: 3.5, wrap: 0, solid: 0.9, gap: 0.1, edge: 0.1, len: 0, cross: 0 },
  stone: { mix: [0.5, 0.3, 0, 1, 0, 0, 0], theta: 30, pitch: 3, wrap: 0, solid: 0.85, gap: 0, edge: 0.3, len: 0, cross: 0 },
  leaves: { mix: [0, 0, 0.6, 0, 0, 0.4, 0], theta: 60, pitch: 4, wrap: 0, solid: 0.8, gap: 0, edge: 1, len: 3, cross: 0 },
  iron: { mix: [1, 0, 0, 0, 0, 0, 0], theta: 90, pitch: 2.4, wrap: 0, solid: 0.7, gap: 0.45, edge: 0, len: 0, cross: 0 },
  water: { mix: [0.2, 0, 0, 0, 0, 0, 1], theta: 0, pitch: 3.5, wrap: 0.6, solid: 0.95, gap: 0.35, edge: 0, len: 0, cross: 0 },
  snow: { mix: [0, 0.6, 0, 0, 0, 0, 0], theta: 0, pitch: 5, wrap: 0, solid: 1.1, gap: 0.2, edge: 0.4, len: 0, cross: 0 },
  soil: { mix: [0, 1, 0, 0.4, 0, 0, 0], theta: 0, pitch: 3, wrap: 0, solid: 0.88, gap: 0, edge: 0.5, len: 0, cross: 0 },
  plank: { mix: [0.2, 0, 0, 0, 0.6, 0, 0], theta: 90, pitch: 4.5, wrap: 0, solid: 0.9, gap: 0.05, edge: 0, len: 0, cross: 1 },
  skin: { mix: [0.5, 0.3, 0, 0, 0, 0, 0], theta: 0, pitch: 3.2, wrap: 1, solid: 1.1, gap: 0.25, edge: 0, len: 0, cross: 0 },
  hair: { mix: [0.3, 0, 0, 0, 0, 1, 0], theta: 92, pitch: 2.2, wrap: 0, solid: 0.75, gap: 0.3, edge: 0.7, len: 9, cross: 0 },
  scales: { mix: [0, 0, 1, 0, 0, 0, 0], theta: 0, pitch: 4.5, wrap: 0.3, solid: 0.9, gap: 0.1, edge: 0.2, len: 0, cross: 0 },
  blood: { mix: [0.1, 0, 0, 0, 0, 0, 0.3], theta: 0, pitch: 4, wrap: 0.3, solid: 0.45, gap: 0.3, edge: 0.15, len: 0, cross: 0 },
  ice: { mix: [0.6, 0, 0, 0.5, 0, 0, 0], theta: 70, pitch: 6, wrap: 0, solid: 1.1, gap: 0.5, edge: 0.05, len: 0, cross: 0 },
  cloth: { mix: [0.6, 0, 0, 0, 0, 0.6, 0], theta: 45, pitch: 3, wrap: 0.8, solid: 0.92, gap: 0.05, edge: 0.15, len: 3, cross: 1 },
};
const KEYS = ['theta', 'pitch', 'wrap', 'solid', 'gap', 'edge', 'len', 'cross'];
export const lerpMat = (a, b, t) => ({ mix: a.mix.map((v, i) => v + (b.mix[i] - v) * t), ...Object.fromEntries(KEYS.map(k => [k, a[k] + (b[k] - a[k]) * t])) });

function hash(i, j, s) { let q = Math.imul(i * 73856093 ^ j * 19349663 ^ s * 83492791, 0x9e3779b1); q ^= q >>> 15; q = Math.imul(q, 0x85ebca6b); return ((q ^ (q >>> 13)) >>> 0) / 4294967296; }

// one cell of the plate, under material M (weights may differ per cell during a transfer)
export function markAt(i, j, w, h, M, seed = 1) {
  const cx = w / 2, R = Math.min(w, h) * 0.26, top = h * 0.22, bot = h * 0.86, ry = R * 0.32, x = (i + 0.5 - cx) / R, rough = M.edge * (hash(i, j >> 1, seed) - 0.5) * 0.25;
  const inBody = Math.abs(x) < 1 + rough && j + 0.5 > top && j + 0.5 < bot + ry * Math.sqrt(Math.max(0, 1 - x * x)), inTop = ((x) ** 2 + ((j + 0.5 - top) / ry) ** 2) < 1 + rough;
  if (!inBody && !inTop) return 0;
  const nx = clamp(x, -1, 1), nz = Math.sqrt(Math.max(0, 1 - nx * nx)), lit = inTop ? 0.85 : clamp(-0.55 * nx + 0.75 * nz + 0.1, 0, 1), T = 1 - lit;   // tone: 0 lit, 1 dark
  if (T > M.solid) return 1;
  const spec = inTop ? 0 : Math.exp(-(((nx + 0.45) / 0.12) ** 2)); if (spec > 1 - M.gap) return 0;
  const u = inTop ? (i + 0.5 - cx) : Math.asin(nx) * R, v = j + 0.5 + (inTop ? 0 : M.wrap * ry * nz), th = M.theta * Math.PI / 180, p = M.pitch;
  const along = u * Math.cos(th) + v * Math.sin(th), across = -u * Math.sin(th) + v * Math.cos(th), width = 0.12 + 0.5 * T;
  const line = ph => smooth(width + 0.18, width - 0.05, Math.abs(((ph % 1) + 1) % 1 - 0.5) * 2);
  const f = [
    line(across / p) * (M.cross ? Math.max(1, line(along / p)) : 1),
    hash(i, j, seed + 7) < T * 0.7 ? 1 : 0,
    (() => { const row = Math.floor(v / p), ox = (row % 2) * p / 2, cxs = (Math.floor((u + ox) / p) + 0.5) * p - ox, d = Math.hypot(u - cxs, (v - row * p) - p); return smooth(0.3, 0, Math.abs(d - p * 0.9) / p) * (T + 0.3); })(),
    (() => { const ci = Math.floor(u / (2 * p)), cj = Math.floor(v / (2 * p)); let d1 = 1e9, d2 = 1e9; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const px = (ci + a + hash(ci + a, cj + b, seed)) * 2 * p, py = (cj + b + hash(cj + b, ci + a, seed + 3)) * 2 * p, d = Math.hypot(u - px, v - py); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; } return smooth(0.9, 0.2, d2 - d1) * (0.4 + T); })(),
    line(Math.hypot(u * 0.35, v - h * 0.3) / p + 0.3 * Math.sin(v * 0.2)),
    (() => { const k = Math.floor(along / Math.max(1, M.len)), jit = hash(k, Math.floor(across / p), seed); return line(across / p + jit * 0.5) * ((((along / Math.max(1, M.len)) % 1) + 1) % 1 < 0.7 ? 1 : 0); })(),
    line((across + 1.2 * Math.sin(along * 0.35)) / p),
  ];
  let s = 0, t = 0; for (let q = 0; q < 7; q++) { s += M.mix[q] * f[q]; t += M.mix[q]; }
  return clamp(t ? s / t * Math.min(1.4, 0.5 + T) : 0, 0, 1);
}

export const material = defineGen({
  id: 'material',
  law: { shape: 'absorb', params: { strength: 2.4, rule: 'mark law per material on a constant form' } },
  weights: { from: 'material name', to: 'material name (a transfer)', mix: '7 pattern weights', theta: 'stroke direction', pitch: 'density', wrap: 'cross-contour wrap', solid: 'solid-black tone threshold', gap: 'specular gap', edge: 'edge breakup', len: 'stroke length', cross: 'crossing set' },
  inputs: { timing: 'optional: drives the transfer front' },
  mechanism: 'ink(x) = sum_q mix_q pattern_q(x; theta, pitch, wrap) / sum mix, thresholded by tone; solid above solid; none in the specular gap; silhouette broken by edge noise; a front lerps the weights per cell',
  credits: ['the material-differentiation drawing template (yo4no2kasa save, 2026-10-25), as reference only', 'Goltzius and the Burin cut (tone by line)', 'Voronoi 1908 (the crack cells)'],
  create({ w = 160, h = 100, from = 'stone', to = null, seed = 1, speed = 0.12 } = {}) {
    const L = makeLayer('material', { w, h, law: { shape: 'absorb', params: { strength: 2.4 } }, weights: { ...MATERIALS[from], from, to, speed }, ink: [0.08, 0.07, 0.09], state: { seed, tau: to ? scheduleFront(w, h, { seedEdge: 'left', seed }).tau : null, p: 0, x: F32(w * h) } });
    paint(L); return L;
  },
  step(L, dt, ctx) { const S = L.state; S.p = ctx.timing?.state ? ctx.timing.state.progress : Math.min(1, S.p + dt * L.weights.speed); paint(L); },
});

function paint(L) {
  const { w, h } = L, S = L.state, W = L.weights, A = L.fields.amount, a = MATERIALS[W.from], b = W.to ? MATERIALS[W.to] : null;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i, t = b ? weightAt(S.tau, k, S.p) : 0; S.x[k] = t; A[k] = markAt(i, j, w, h, b ? lerpMat(a, b, t) : a, S.seed); }
}
