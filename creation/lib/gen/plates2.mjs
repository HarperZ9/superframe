// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// plates2.mjs: three more registry entries without a generator, from their rules.
//   cloud    the cloud lobe tree (SKY05 to SKY09, PB-4.4): a flat-based mass of soft lobes with sub-lobes, built in
//            stages (one body, then lobes, then erosion, as in the staged-build upload), lit by a 2D Beer march toward
//            the sun: light(x) = exp(-sigma * integral of density from x toward the sun), plus an ambient term
//   swarm    position-based chains seeking a target (FLD09, T18; Reynolds 1987, Muller and others 2007): each chain
//            keeps its link lengths by constraint projection, its head steers toward the nearest unclaimed target
//            cell, and nearby particles separate
//   roads    a road network grown as a front (GLY18, S37): arterials branch from seeds with a turn noise and a branch
//            probability, stop on meeting another road, and light their length as they go
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, smooth, rngFrom, hexLin, textMask } from '../core/layer.mjs';

export const cloud = defineGen({
  id: 'cloud', kind: 'transformational',
  law: { shape: 'cover', params: { rule: 'lobe tree density, 2D Beer march to the sun' } },
  weights: { lobes: 'first-level lobes', sub: 'sub-lobes per lobe', erosion: 'surface erosion', sigma: 'extinction per cell', sun: 'sun direction, degrees', build: 'stages per second' },
  inputs: { timing: 'optional: drives the build' },
  mechanism: 'density = max over lobes of smooth falloff, cut flat at the base, eroded by noise; light = exp(-sigma sum density along the ray to the sun); colour = mix(shadow, lit, light) + ambient',
  credits: ['ENGINE-TECHNIQUES SKY05 to SKY09 (raw-native volume.cpp lobe tree, ideas only)', 'the staged cumulus build upload (u1021 Jdcs8, as stages)', 'Beer 1852'],
  create({ w = 160, h = 100, lobes = 6, sub = 3, erosion = 0.25, sigma = 0.09, sun = 35, build = 0.25, seed = 'cloud' } = {}) {
    const r = rngFrom(seed), cx = w / 2, base = h * 0.7, L0 = { x: cx, y: base - h * 0.16, r: h * 0.2, stage: 0 }, list = [L0];
    for (let i = 0; i < lobes; i++) { const a = Math.PI * (0.1 + 0.8 * r()), p = list[Math.floor(r() * list.length)], R = p.r * (0.45 + 0.35 * r()); list.push({ x: p.x - Math.cos(a) * p.r * 0.9, y: Math.min(base - R * 0.5, p.y - Math.sin(a) * p.r * 0.7), r: R, stage: 1 }); }
    for (const p of list.slice(1)) for (let s = 0; s < sub; s++) { const a = Math.PI * (0.05 + 0.9 * r()); list.push({ x: p.x - Math.cos(a) * p.r * 0.85, y: Math.min(base - 2, p.y - Math.sin(a) * p.r * 0.85), r: p.r * (0.3 + 0.25 * r()), stage: 2 }); }
    const noise = F32(w * h); for (let k = 0; k < noise.length; k++) noise[k] = r();
    return makeLayer('cloud', { w, h, law: { shape: 'cover', params: {} }, weights: { lobes, sub, erosion, sigma, sun, build }, fields: { rgb: F32(3 * w * h), density: F32(w * h) }, state: { list, base, noise, p: 0 } });
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, { w, h } = L, D = L.fields.density, A = L.fields.amount, C = L.fields.rgb; S.p = ctx.timing?.state ? ctx.timing.state.progress * 3 : Math.min(3.2, S.p + dt * W.build);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; let d = 0;
      for (const l of S.list) { const g = smooth(0, 1, S.p - l.stage); if (g <= 0) continue; const q = Math.hypot(i + 0.5 - l.x, j + 0.5 - l.y) / (l.r * g); d = Math.max(d, smooth(1, 0.55, q)); }
      if (j > S.base) d *= smooth(S.base + 2, S.base, j);
      d *= 1 - W.erosion * smooth(2, 3, S.p) * (S.noise[k] * 0.7 + 0.3 * S.noise[(k * 7) % L.n]) * smooth(0.9, 0.2, d);
      D[k] = d;
    }
    const a = W.sun * Math.PI / 180, sx = Math.cos(a), sy = -Math.sin(a), shadow = hexLin('#5a6478'), lit = hexLin('#fbf6ea'), amb = hexLin('#9fb3c8');
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const k = j * w + i; if (D[k] < 0.01) { A[k] = 0; continue; }
      let tau = 0; for (let s = 1; s < 60; s++) { const x = i + sx * s, y = j + sy * s; if (x < 0 || y < 0 || x >= w || y >= h) break; tau += D[(y | 0) * w + (x | 0)]; }
      const T = Math.exp(-W.sigma * tau), up = clamp((S.base - j) / h, 0, 1);
      A[k] = clamp(D[k] * 1.6, 0, 1); for (let c = 0; c < 3; c++) C[3 * k + c] = shadow[c] + (lit[c] - shadow[c]) * T + 0.12 * up * amb[c];
    }
  },
});

export const swarm = defineGen({
  id: 'swarm',
  law: { shape: 'absorb', params: { strength: 2.2 } },
  weights: { chains: 'count', links: 'particles per chain', seek: 'steer strength', sep: 'separation radius, cells', iters: 'constraint iterations' },
  inputs: { source: 'optional: the target shape (else a word)' },
  mechanism: 'Verlet step; head += seek * (target - head); link lengths restored by projection (iters); particles closer than sep pushed apart',
  credits: ['Reynolds 1987 (boids)', 'Muller, Heidelberger, Hennix and Ratcliff 2007 (position-based dynamics)', 'the swarm letters (lettering swarm.mjs, T18), rewritten'],
  create({ w = 160, h = 100, chains = 40, links = 8, seek = 0.08, sep = 1.6, iters = 4, seed = 'swarm', word = 'flow' } = {}) {
    const r = rngFrom(seed), P = []; for (let c = 0; c < chains; c++) { const x0 = r() * w, y0 = r() * h; for (let i = 0; i < links; i++) P.push({ x: x0 + i * 0.8, y: y0, px: x0 + i * 0.8, py: y0, c, i }); }
    const T = textMask(word, w, h, { y0: 0.25, y1: 0.75 }), targets = []; for (let k = 0; k < T.length; k += 3) if (T[k] > 0.5) targets.push([k % w + 0.5, (k / w | 0) + 0.5]);
    return makeLayer('swarm', { w, h, law: { shape: 'absorb', params: { strength: 2.2 } }, weights: { chains, links, seek, sep, iters }, ink: [0.12, 0.12, 0.16], state: { P, targets, r } });
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, { w, h } = L, P = S.P, T = S.targets;
    for (const p of P) { const vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96; p.px = p.x; p.py = p.y; p.x += vx; p.y += vy; }
    for (let c = 0; c < W.chains; c++) { const hd = P[c * W.links], t = T[(c * 97) % Math.max(1, T.length)]; if (t) { hd.x += W.seek * (t[0] - hd.x) * 30 * dt; hd.y += W.seek * (t[1] - hd.y) * 30 * dt; } }
    for (let it = 0; it < W.iters; it++) {
      for (let c = 0; c < W.chains; c++) for (let i = 1; i < W.links; i++) { const a = P[c * W.links + i - 1], b = P[c * W.links + i], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1e-6, e = (d - 1) / d * 0.5; a.x += dx * e; a.y += dy * e; b.x -= dx * e; b.y -= dy * e; }
      for (let q = 0; q < P.length; q += 2) for (let o = q + 1; o < Math.min(P.length, q + 30); o++) { const a = P[q], b = P[o], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy); if (d > 0 && d < W.sep && a.c !== b.c) { const e = (W.sep - d) / d * 0.25; a.x -= dx * e; a.y -= dy * e; b.x += dx * e; b.y += dy * e; } }
    }
    const A = L.fields.amount; for (let k = 0; k < A.length; k++) A[k] *= 0.85;
    for (const p of P) { p.x = clamp(p.x, 0, w - 1); p.y = clamp(p.y, 0, h - 1); A[(p.y | 0) * w + (p.x | 0)] = 1; }
  },
});

export const roads = defineGen({
  id: 'roads',
  law: { shape: 'emit', params: { exposure: 1 } },
  weights: { seeds: 'start points', branch: 'branch probability per step', turn: 'turn noise, radians', speed: 'cells per second', lamp: 'sodium share 0..1 (589 nm against LED)' },
  mechanism: 'each road tip advances with heading noise; it branches at right angles with probability branch; it stops on reaching a lit cell; lit cells glow sodium or LED by district',
  credits: ['the night-lights network (T16, GLY18; ISS night images as public-domain reference)', 'growth-front road models (inferred)'],
  create({ w = 160, h = 100, seeds = 3, branch = 0.035, turn = 0.12, speed = 26, lamp = 0.6, seed = 'roads' } = {}) {
    const r = rngFrom(seed), tips = []; for (let s = 0; s < seeds; s++) { const x = w * (0.2 + 0.6 * r()), y = h * (0.2 + 0.6 * r()); for (let k = 0; k < 4; k++) tips.push({ x, y, a: k * Math.PI / 2 + r() * 0.3, alive: true }); }
    return makeLayer('roads', { w, h, law: { shape: 'emit', params: { exposure: 1 } }, weights: { seeds, branch, turn, speed, lamp }, fields: { rgb: F32(3 * w * h) }, state: { tips, r, acc: 0 } });
  },
  step(L, dt) {
    const S = L.state, W = L.weights, { w, h } = L, A = L.fields.amount, C = L.fields.rgb, sod = [1, 0.55, 0.12], led = [0.75, 0.82, 1]; S.acc += dt * W.speed;
    while (S.acc >= 1) { S.acc -= 1; const born = [];
      for (const t of S.tips) { if (!t.alive) continue; t.a += (S.r() - 0.5) * W.turn; const nx = t.x + Math.cos(t.a), ny = t.y + Math.sin(t.a); if (nx < 0 || ny < 0 || nx >= w || ny >= h) { t.alive = false; continue; } const k = (ny | 0) * w + (nx | 0), here = (t.y | 0) * w + (t.x | 0); if (A[k] > 0.5 && k !== here) { t.alive = false; continue; } t.x = nx; t.y = ny; A[k] = 1; const c = (nx / w) < W.lamp ? sod : led; C[3 * k] = c[0] * 0.8; C[3 * k + 1] = c[1] * 0.8; C[3 * k + 2] = c[2] * 0.8; if (S.r() < W.branch) born.push({ x: t.x, y: t.y, a: t.a + (S.r() < 0.5 ? 1 : -1) * Math.PI / 2, alive: true }); }
      S.tips.push(...born.slice(0, 40));
    }
  },
});
