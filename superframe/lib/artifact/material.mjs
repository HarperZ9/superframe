// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// material.mjs: the elements as a surface. Height is the material-weighted field plus the full-resolution detail
// scaled by the local roughness; roughness is the amount-weighted mean of each element's roughness over a paper
// roughness; normals come from the height. The lit preview is neutral clay under one raking light with a
// Blinn-Phong highlight whose exponent falls as roughness rises, so a glossy law (frost, marble) reads as a sheen
// and a rough one (cloud, life) as a matte tooth. The same normals light the paint (paint.mjs): one surface, two
// readouts.
import { fieldFor, weightOf, upsample, normals, detailMap } from './common.mjs';

const PAPER_ROUGH = 0.6;

export function material(r, layers, D) {
  const [w, h] = r.sim, [W, H] = r.size, n = w * h;
  const Hs = fieldFor(r, layers, 'material'), Rs = new Float32Array(n).fill(PAPER_ROUGH), acc = new Float32Array(n);
  for (const o of layers) {
    const wt = weightOf(r, o, 'material'); if (!wt) continue;
    const A = o.layer.fields.amount, B = o.bbox, rough = o.element.roughness;
    for (let y = B.y0; y < B.y1; y++) for (let x = B.x0; x < B.x1; x++) { const k = y * w + x, a = wt * A[k]; if (!a) continue; Rs[k] = (Rs[k] * (1 + acc[k]) + rough * a) / (1 + acc[k] + a); acc[k] += a; }
  }
  const height = upsample(Hs, w, h, W, H), rough = upsample(Rs, w, h, W, H), dm = upsample(detailMap(r, layers, 'material'), w, h, W, H), amt = 0.03 + 0.12 * r.detail;
  for (let k = 0; k < W * H; k++) height[k] = Math.min(1, Math.max(0, height[k] * 0.85 + amt * D[k] * dm[k] * (0.4 + rough[k])));
  const N = normals(height, W, H, 54 * (1 + r.media.material) * (W / 3840));
  return { W, H, height, rough, N, dm, preview: () => clay(N, rough, W, H) };
}

// raking light from the upper left, 25 degrees above the surface; view straight down
export function clay(N, rough, W, H, albedo = [0.62, 0.6, 0.57]) {
  const L = norm([-0.75, -0.55, 0.42]), V = [0, 0, 1], Hh = norm([L[0] + V[0], L[1] + V[1], L[2] + V[2]]), out = new Float32Array(3 * W * H);
  for (let k = 0; k < W * H; k++) {
    const nx = N[3 * k], ny = N[3 * k + 1], nz = N[3 * k + 2], d = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
    const e = 4 + 120 * (1 - rough[k]) ** 2, s = (1 - rough[k]) * 0.6 * Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]) ** e;
    for (let c = 0; c < 3; c++) out[3 * k + c] = albedo[c] * (0.18 + 0.95 * d) + s;
  }
  return out;
}

// how much a unit normal is lit by the raking light, relative to a flat surface (1 on flat ground)
export function shade(N, k) {
  const L = [-0.75, -0.55, 0.42], l = Math.hypot(...L), flat = L[2] / l;
  return Math.max(0, (N[3 * k] * L[0] + N[3 * k + 1] * L[1] + N[3 * k + 2] * L[2]) / l) / flat;
}

const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
