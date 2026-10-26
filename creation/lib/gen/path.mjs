// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// path: layered forward movement, and forward motion as the clock (BLEED sections 5 and 9: "the path is one way
// through the bazaar"). A head travels a smooth curve at a speed set by its own law; behind it the ticks keep a trail
// that fades with arc distance (a wake), and every cell near the curve gets a velocity along the tangent, so any layer
// that takes this one as context can be carried forward by it. Depth layers: `planes` parallel copies of the trail
// offset across the path, each moving at its own parallax speed 1 / (1 + depth), so near planes overtake far ones.
//   amount  trail strength: exp(-(s_head - s) / wake) inside a tube of radius r around the curve, 0 ahead of the head
//   vel     the curve's unit tangent times push, weighted by the same tube falloff (what the path lends to the medium)
//   state.travel  fraction of the path travelled: the clock other layers can read (timing curve 'walk')
// Curve: a closed sum of two Lissajous terms (or an open sweep), sampled once as a polyline with cumulative arc length.
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp } from '../core/layer.mjs';

export const path = defineGen({
  id: 'path',
  kind: 'conformational',
  law: { shape: 'wake', params: { decay: 'exp in arc length' } },
  weights: { speed: 'arc fraction per second', wake: 'trail length, arc fraction', push: 'velocity lent to others, cells/step', radius: 'tube radius, cells', planes: 'parallax depth planes' },
  mechanism: 'head s(t) advances by speed * dt / (1 + depth); tick = exp(-(s_head - s_proj) / wake) * exp(-(d / r)^2); vel = tangent * push * falloff',
  credits: ['Eames, Powers of Ten (one idea explained by moving through it)', 'Muybridge (motion read as a sequence)'],
  create({ w = 160, h = 100, kind = 'sweep', speed = 0.12, wake = 0.35, push = 0.6, radius = 7, planes = 1, loop = false, seed = 1 } = {}) {
    const pts = curve(kind, w, h, seed), L = makeLayer('path', { w, h, law: { shape: 'wake', params: {} }, weights: { speed, wake, push, radius, planes }, fields: { vel: F32(2 * w * h) }, state: { pts, head: 0, travel: 0, loop, done: false } });
    return L;
  },
  step(L, dt) {
    const S = L.state, { speed, wake, push, radius, planes } = L.weights, { w, h } = L, A = L.fields.amount, V = L.fields.vel;
    S.head = S.loop ? (S.head + speed * dt) % 1 : Math.min(1, S.head + speed * dt); S.travel = S.head;
    A.fill(0); V.fill(0);
    const pts = S.pts, total = pts.at(-1).s;
    for (let p = 0; p < planes; p++) {
      const depth = p, off = (p - (planes - 1) / 2) * radius * 1.6, headS = (S.head / (1 + 0.6 * depth)) * total;
      for (let q = 0; q < pts.length - 1; q++) {
        const P = pts[q]; if (P.s > headS) break;
        const age = (headS - P.s) / (wake * total); if (age > 4) continue;
        const tx = pts[q + 1].x - P.x, ty = pts[q + 1].y - P.y, tl = Math.hypot(tx, ty) || 1, nx = -ty / tl, ny = tx / tl, cx = P.x + nx * off, cy = P.y + ny * off;
        const R = radius * (1 - 0.15 * depth), x0 = Math.max(0, Math.floor(cx - 2 * R)), x1 = Math.min(w - 1, Math.ceil(cx + 2 * R)), y0 = Math.max(0, Math.floor(cy - 2 * R)), y1 = Math.min(h - 1, Math.ceil(cy + 2 * R));
        const strength = Math.exp(-age) / (1 + depth);
        for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) {
          const d2 = ((i + 0.5 - cx) ** 2 + (j + 0.5 - cy) ** 2) / (R * R), f = strength * Math.exp(-d2); if (f < 1e-3) continue;
          const k = j * w + i; if (f > A[k]) A[k] = f;
          V[2 * k] += (tx / tl) * push * f * 0.25; V[2 * k + 1] += (ty / tl) * push * f * 0.25;
        }
      }
    }
    for (let k = 0; k < A.length; k++) A[k] = clamp(A[k], 0, 1);
  },
});

// the curve as points with cumulative arc length
function curve(kind, w, h, seed) {
  const N = 600, pts = [];
  for (let i = 0; i <= N; i++) {
    const u = i / N; let x, y;
    if (kind === 'loop') { x = w * (0.5 + 0.36 * Math.sin(2 * Math.PI * u + seed) * Math.cos(Math.PI * u * 0.5)); y = h * (0.5 + 0.32 * Math.sin(4 * Math.PI * u + 0.7 * seed)); }
    else if (kind === 'spiral') { const r = 0.45 * (1 - u * 0.85), a = 5 * Math.PI * u; x = w * (0.5 + r * Math.cos(a) * 0.9); y = h * (0.5 + r * Math.sin(a)); }
    else { x = w * (0.04 + 0.92 * u); y = h * (0.5 + 0.22 * Math.sin(2 * Math.PI * (u * 1.3 + 0.1 * seed)) + 0.08 * Math.sin(2 * Math.PI * u * 3.7)); }
    pts.push({ x, y, s: 0 });
  }
  for (let i = 1; i < pts.length; i++) pts[i].s = pts[i - 1].s + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return pts;
}
