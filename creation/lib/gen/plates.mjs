// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plates.mjs: four registry entries that had no generator, written from their rules (registry ranks in REGISTRY.md).
//   ascii      any scalar field read as glyph density: each cell of `cell` px picks a glyph from a ramp ordered by its
//              measured ink coverage (the 5x7 face in core/layer.mjs), so tone is carried by which letter sits there
//   orb        the aperture and luminous orb: a disc of light with a wide faint halo (1 / (1 + (r / r0)^2) falloff),
//              a thin-film rim whose hue follows the film thickness (two-beam interference, cos^2 of the phase per
//              channel) and one spectral flare streak; it breathes on its own timing
//   ramp       field, ramp and phase (feed sets 28 and 29): geometry holds still, colour comes from a ramp looked up
//              on a scalar field, and motion is a shift of the lookup phase
//   spray      droplets from a nozzle with log-normal sizes (mu, sigma) build up coverage; where wet coverage passes a
//              threshold a drip runs down under gravity, thinning as it goes
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, smooth, rngFrom, hexLin, textMask } from '../core/layer.mjs';

const RAMP = ' .:-=+*#%@';
const glyphCov = (() => { const m = {}; for (const ch of 'ACEFHILMNOTUVXZ.') { const g = textMask(ch, 12, 14, { x0: 0, y0: 0, x1: 1, y1: 1, soft: 0 }); m[ch] = { mask: g, cov: g.reduce((a, b) => a + b, 0) / g.length }; } return Object.entries(m).sort((a, b) => a[1].cov - b[1].cov); })();

export const ascii = defineGen({
  id: 'ascii', kind: 'conformational',
  law: { shape: 'absorb', params: { strength: 2 } },
  weights: { cell: 'glyph cell, px', gamma: 'tone curve' },
  inputs: { source: 'the field to read (else a moving radial field)' },
  mechanism: 'per cell: tone t = mean of the field; glyph = the one whose measured coverage is nearest t^gamma; ink = its mask',
  credits: ['typewriter and ASCII art; the glyph renderer cells (GLY01 to GLY14, coverage-measured ramp)'],
  create({ w = 160, h = 100, cell = 6, gamma = 1 } = {}) { return makeLayer('ascii', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { cell, gamma }, ink: [0.1, 0.1, 0.12], state: {} }); },
  step(L, dt, ctx) {
    const { w, h } = L, c = L.weights.cell, A = L.fields.amount, src = ctx.source?.fields.amount; A.fill(0);
    for (let gy = 0; gy + c <= h; gy += c) for (let gx = 0; gx + c <= w; gx += c) {
      let t = 0; for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) { const k = (gy + y) * w + gx + x; t += src ? src[k] : 0.5 + 0.5 * Math.sin(Math.hypot(gx - w / 2, gy - h / 2) / 8 - L.t * 2); } t = Math.pow(clamp(t / (c * c), 0, 1), L.weights.gamma) * glyphCov.at(-1)[1].cov;
      let best = glyphCov[0]; for (const g of glyphCov) if (Math.abs(g[1].cov - t) < Math.abs(best[1].cov - t)) best = g;
      if (best[1].cov < 0.02) continue; const m = best[1].mask;
      for (let y = 0; y < c; y++) for (let x = 0; x < c; x++) A[(gy + y) * w + gx + x] = m[Math.min(13, Math.floor(y / c * 14)) * 12 + Math.min(11, Math.floor(x / c * 12))];
    }
  },
});
export { RAMP };

export const orb = defineGen({
  id: 'orb', kind: 'conformational',
  law: { shape: 'emit', params: { exposure: 1 } },
  weights: { r0: 'core radius, cells', film: 'rim film thickness, nm', flare: 'flare length, share of width', breath: 'breaths per second' },
  inputs: { timing: 'optional: the breath' },
  mechanism: 'I(r) = 1 / (1 + (r / r0)^2); rim colour c_k = cos^2(2 pi n d / lambda_k); one streak along the flare axis',
  credits: ['the aperture and luminous-orb motif (design canon)', 'Newton, Opticks (thin plates); Airy (two-beam interference)'],
  create({ w = 160, h = 100, r0 = 6, film = 520, flare = 0.42, breath = 0.2 } = {}) { return makeLayer('orb', { w, h, law: { shape: 'emit', params: { exposure: 0.9 } }, weights: { r0, film, flare, breath }, fields: { rgb: F32(3 * w * h) } }); },
  step(L, dt, ctx) {
    const { w, h } = L, W = L.weights, A = L.fields.amount, C = L.fields.rgb, p = ctx.timing?.state ? ctx.timing.state.progress : 0.5 + 0.5 * Math.sin(2 * Math.PI * W.breath * L.t), r0 = W.r0 * (0.85 + 0.3 * p), cx = w / 2, cy = h / 2, lam = [610, 550, 465];
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i, r = Math.hypot(i + 0.5 - cx, j + 0.5 - cy), core = 1 / (1 + (r / r0) ** 2), rim = Math.exp(-(((r - 2.2 * r0) / (0.35 * r0)) ** 2)), d = W.film * (1 + 0.2 * Math.sin(Math.atan2(j - cy, i - cx) * 3 + L.t)), streak = Math.exp(-(((j + 0.5 - cy) / 0.6) ** 2)) * Math.max(0, 1 - Math.abs(i + 0.5 - cx) / (W.flare * w));
      A[k] = clamp(core + rim * 0.6 + streak * 0.5, 0, 1);
      for (let c = 0; c < 3; c++) C[3 * k + c] = 0.9 * core * [1, 0.85, 0.62][c] + rim * 0.55 * Math.cos(2 * Math.PI * 1.33 * d / lam[c]) ** 2 + streak * 0.35 * [0.8, 0.7, 1][c];
    }
  },
});

export const ramp = defineGen({
  id: 'ramp', kind: 'conformational',
  law: { shape: 'cover', params: {} },
  weights: { stops: 'ramp colours', phase: 'phase speed, cycles per second', field: 'radial | waves' },
  inputs: { source: 'optional: the scalar field (else built in)' },
  mechanism: 'colour = ramp(frac(f(x) + phase t)); geometry fixed, motion only in the lookup',
  credits: ['feed sets 28 and 29, field, ramp, phase (PLAYBOOK addition 2026-10-24)'],
  create({ w = 160, h = 100, stops = ['#1d2a3a', '#a93b29', '#eb8f4a', '#ded8cb', '#416f66'], phase = 0.08, field = 'waves' } = {}) {
    const F = F32(w * h); for (let k = 0; k < F.length; k++) { const x = (k % w) / w, y = (k / w | 0) / h; F[k] = field === 'radial' ? Math.hypot(x - 0.5, y - 0.5) * 2 : 0.5 + 0.25 * Math.sin(x * 9 + Math.sin(y * 7) * 1.5) + 0.25 * Math.sin(y * 5 - x * 2); }
    const L = makeLayer('ramp', { w, h, law: { shape: 'cover', params: {} }, weights: { stops, phase, field }, fields: { rgb: F32(3 * w * h) }, state: { F, S: stops.map(hexLin) } }); L.fields.amount.fill(1); return L;
  },
  step(L, dt, ctx) { const S = L.state.S, F = ctx.source?.fields.amount ?? L.state.F, C = L.fields.rgb, n = S.length; for (let k = 0; k < L.n; k++) { const u = (((F[k] + L.weights.phase * (L.t + dt)) % 1) + 1) % 1 * n, i = Math.floor(u) % n, f = smooth(0, 1, u - Math.floor(u)), a = S[i], b = S[(i + 1) % n]; for (let c = 0; c < 3; c++) C[3 * k + c] = a[c] + (b[c] - a[c]) * f; } },
});

export const spray = defineGen({
  id: 'spray',
  law: { shape: 'absorb', params: { strength: 2.4 } },
  weights: { rate: 'droplets per second', mu: 'log-normal mean of ln radius', sigma: 'log-normal sd', drip: 'wet coverage that starts a drip', speed: 'nozzle travel' },
  mechanism: 'droplet radius r = exp(mu + sigma N(0, 1)) around a moving nozzle; coverage adds; above `drip` a drip runs down, losing paint as it goes',
  credits: ['sprayed letters (GLY17: log-normal droplets, overspray, drips), rewritten as a step-driven deposit'],
  create({ w = 160, h = 100, rate = 900, mu = -0.2, sigma = 0.6, drip = 1.6, speed = 0.12, seed = 'spray', ink = '#a93b29' } = {}) { return makeLayer('spray', { w, h, law: { shape: 'absorb', params: { strength: 2.4 } }, weights: { rate, mu, sigma, drip, speed }, ink: hexLin(ink), state: { r: rngFrom(seed), wet: F32(w * h), drips: [] } }); },
  step(L, dt) {
    const S = L.state, W = L.weights, { w, h } = L, A = L.fields.amount, r = S.r, gauss = () => Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
    const nx = w * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(L.t * W.speed * 6.283))), ny = h * (0.35 + 0.1 * Math.sin(L.t * 1.3));
    for (let q = 0; q < W.rate * dt; q++) { const rad = Math.exp(W.mu + W.sigma * gauss()), x = nx + gauss() * 6, y = ny + gauss() * 4; for (let j = Math.floor(y - rad); j <= y + rad; j++) for (let i = Math.floor(x - rad); i <= x + rad; i++) { if (i < 0 || j < 0 || i >= w || j >= h) continue; const a = smooth(rad + 0.5, rad - 0.5, Math.hypot(i + 0.5 - x, j + 0.5 - y)) * 0.25, k = j * w + i; S.wet[k] += a; A[k] = Math.min(1, A[k] + a); if (S.wet[k] > W.drip && S.drips.length < 60) { S.drips.push({ x: i, y: j, load: 0.6 }); S.wet[k] = 0; } } }
    for (const d of S.drips) { if (d.load <= 0.02) continue; d.y += 18 * dt; d.load *= 0.985; const j = Math.floor(d.y); if (j >= h) { d.load = 0; continue; } for (let i = d.x - 1; i <= d.x + 1; i++) if (i >= 0 && i < w) A[j * w + i] = Math.min(1, A[j * w + i] + d.load * (i === d.x ? 1 : 0.4)); }
    for (let k = 0; k < L.n; k++) S.wet[k] *= Math.exp(-dt / 2.5);
  },
});
