// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plates3.mjs: four more registry entries from their rules.
//   crt      signal to glass (PRN12 to PRN16): a source field scanned in rows, each row a gaussian beam profile
//            (scanline), split through an aperture grille into red, green and blue stripes, with phosphor persistence
//            (each phosphor decays as exp(-dt / tau)) and a glass halo (a wide faint blur of the light)
//   develop  develop by dwelling (T08; Hurter and Driffield 1890): exposure accumulates where attention rests (a
//            context layer, the path), and density follows a characteristic curve D = Dmax / (1 + exp(-g (log E - log E0)))
//   raking   the raking lamp (T07; RTI, Malzbender and others 2001): a relief height field lit by a low lamp that
//            circles; brightness = Lambert on the relief normal, so marks invisible in flat light show
//   moire    moire witness (T10; Amidror 2000): two line screens at nearly equal angles; one screen's phase carries a
//            hidden image, which appears only in their beat
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, textMask, blur, smooth } from '../core/layer.mjs';

export const crt = defineGen({
  id: 'crt', kind: 'conformational',
  law: { shape: 'emit', params: { exposure: 1 } },
  weights: { rows: 'scan rows', beam: 'beam width, share of a row', tau: 'phosphor persistence, s', halo: 'glass halo weight' },
  inputs: { source: 'the picture signal (its amount)' },
  mechanism: 'beam(y) = exp(-((y - row) / (beam row height))^2); stripe mask r, g, b by x mod 3; phosphor P <- max(beam * signal * mask, P exp(-dt / tau)); out = P + halo * blur(P)',
  credits: ['raw-native physical CRT (PRN12 to PRN16), ideas only', 'the visualizer phosphor afterglow (S10)'],
  create({ w = 160, h = 100, rows = 50, beam = 0.35, tau = 0.08, halo = 0.25 } = {}) { return makeLayer('crt', { w, h, law: { shape: 'emit', params: { exposure: 1 } }, weights: { rows, beam, tau, halo }, fields: { rgb: F32(3 * w * h) }, state: { P: F32(3 * w * h) } }); },
  step(L, dt, ctx) {
    const { w, h } = L, W = L.weights, P = L.state.P, src = ctx.source?.fields.amount, keep = Math.exp(-dt / W.tau), rh = h / W.rows;
    for (let j = 0; j < h; j++) { const row = (Math.floor(j / rh) + 0.5) * rh, b = Math.exp(-(((j + 0.5 - row) / (W.beam * rh)) ** 2)); for (let i = 0; i < w; i++) { const k = j * w + i, s = src ? src[k] : 0.5 + 0.5 * Math.sin(i * 0.1 + L.t * 3) * Math.cos(j * 0.07); for (let c = 0; c < 3; c++) { const m = i % 3 === c ? 1 : 0.12; P[3 * k + c] = Math.max(b * s * m, P[3 * k + c] * keep); } } }
    const C = L.fields.rgb, ch = F32(w * h); for (let c = 0; c < 3; c++) { for (let k = 0; k < L.n; k++) ch[k] = P[3 * k + c]; const g = blur(ch, w, h, 4); for (let k = 0; k < L.n; k++) C[3 * k + c] = P[3 * k + c] + W.halo * g[k]; }
    for (let k = 0; k < L.n; k++) L.fields.amount[k] = (C[3 * k] + C[3 * k + 1] + C[3 * k + 2]) / 3;
  },
});

export const develop = defineGen({
  id: 'develop',
  law: { shape: 'absorb', params: { strength: 2.2 } },
  weights: { gamma: 'curve slope', E0: 'exposure at half density', rate: 'exposure per second at full attention', Dmax: 'maximum density' },
  inputs: { source: 'where attention rests (exposure accrues), e.g. a path', drive: 'optional: the latent image (what develops)' },
  mechanism: 'E += rate * attention * dt; D = Dmax latent / (1 + exp(-gamma (ln E - ln E0))); nothing un-develops',
  credits: ['Hurter and Driffield 1890 (the characteristic curve)', 'the developer tray (T08)'],
  create({ w = 160, h = 100, gamma = 3, E0 = 0.6, rate = 1.5, Dmax = 1 } = {}) { return makeLayer('develop', { w, h, law: { shape: 'absorb', params: { strength: 2.2 } }, weights: { gamma, E0, rate, Dmax }, ink: [0.18, 0.15, 0.12], state: { E: F32(w * h), latent: textMask('develop', w, h, { y0: 0.3, y1: 0.7, soft: 1 }) } }); },
  step(L, dt, ctx) { const S = L.state, W = L.weights, att = ctx.source?.fields.amount, lat = ctx.drive?.fields.amount ?? S.latent, A = L.fields.amount; for (let k = 0; k < L.n; k++) { S.E[k] += W.rate * (att ? att[k] : 0.2) * dt; const D = W.Dmax / (1 + Math.exp(-W.gamma * (Math.log(S.E[k] + 1e-6) - Math.log(W.E0)))); A[k] = Math.max(A[k], D * (0.15 + 0.85 * lat[k])); } },
});

export const raking = defineGen({
  id: 'raking', kind: 'conformational',
  law: { shape: 'cover', params: {} },
  weights: { elev: 'lamp elevation, degrees', speed: 'lamp turns per second', depth: 'relief depth' },
  inputs: { source: 'optional: the relief (else a pressed word under paper fibre)' },
  mechanism: 'n = normalize(-dh/dx, -dh/dy, 1/depth); L = (cos e cos a, cos e sin a, sin e); brightness = max(0, n . L)',
  credits: ['raking-light examination; Malzbender, Gelb and Wolters 2001 (polynomial texture maps)', 'the raking lamp (T07)'],
  create({ w = 160, h = 100, elev = 12, speed = 0.15, depth = 2.5 } = {}) { const Hh = blur(textMask('press', w, h, { y0: 0.3, y1: 0.7, soft: 0 }).map(v => -v * 0.6), w, h, 1); const L = makeLayer('raking', { w, h, law: { shape: 'cover', params: {} }, weights: { elev, speed, depth }, fields: { rgb: F32(3 * w * h), height: Hh } }); L.fields.amount.fill(1); return L; },
  step(L, dt, ctx) { const { w, h } = L, W = L.weights, H = ctx.source?.fields.amount ?? L.fields.height, C = L.fields.rgb, a = 2 * Math.PI * W.speed * (L.t + dt), e = W.elev * Math.PI / 180, lx = Math.cos(e) * Math.cos(a), ly = Math.cos(e) * Math.sin(a), lz = Math.sin(e); for (let j = 1; j < h - 1; j++) for (let i = 1; i < w - 1; i++) { const k = j * w + i, gx = (H[k + 1] - H[k - 1]) / 2, gy = (H[k + w] - H[k - w]) / 2, nz = 1 / W.depth, nl = Math.hypot(gx, gy, nz), b = Math.max(0, (-gx * lx - gy * ly + nz * lz) / nl) / Math.sin(e) * 0.75; for (let c = 0; c < 3; c++) C[3 * k + c] = clamp(b * [0.95, 0.92, 0.85][c], 0, 1); } },
});

export const moire = defineGen({
  id: 'moire', kind: 'conformational',
  law: { shape: 'absorb', params: { strength: 2 } },
  weights: { pitch: 'line pitch, cells', angle: 'screen 2 angle offset, degrees', carry: 'phase shift the hidden image puts on screen 1 (share of a period)' },
  inputs: { timing: 'optional: turns screen 2' },
  mechanism: 'screen1 = lines(x / p + carry * hidden(x)); screen2 = lines(R(theta) x / p); ink = screen1 * screen2: the hidden image shows only in the beat',
  credits: ['Amidror 2000, The Theory of the Moire Phenomenon', 'banknote anti-copy moire', 'moire witness (T10)'],
  create({ w = 160, h = 100, pitch = 3, angle = 2, carry = 0.5 } = {}) { return makeLayer('moire', { w, h, law: { shape: 'absorb', params: { strength: 2 } }, weights: { pitch, angle, carry }, ink: [0.1, 0.1, 0.12], state: { hidden: blur(textMask('seen', w, h, { y0: 0.25, y1: 0.75, soft: 0 }), w, h, 1) } }); },
  step(L, dt, ctx) { const { w, h } = L, W = L.weights, A = L.fields.amount, th = (W.angle + (ctx.timing?.state ? 4 * ctx.timing.state.progress : 0)) * Math.PI / 180, line = u => smooth(0.3, 0.2, Math.abs((((u % 1) + 1) % 1) - 0.5)); for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const k = j * w + i, s1 = line(i / W.pitch + W.carry * L.state.hidden[k]), s2 = line((i * Math.cos(th) + j * Math.sin(th)) / W.pitch); A[k] = clamp(s1 + s2 - s1 * s2, 0, 1); } },
});
