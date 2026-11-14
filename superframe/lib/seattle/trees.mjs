// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// trees.mjs: rain with the wind in the trees. Late October, the blue hour after sunset, rain coming and going in
// gusts. Across a wet street stand a Douglas fir, a western redcedar and a bigleaf maple in its autumn yellow; a
// street lamp on a wooden pole has just come on; a crow sits hunched on the wire and others pass over on their way to
// the evening roost (Seattle's crows fly out to communal winter roosts at dusk).
// Everything moves for a physical reason: the gust field (wind.mjs) drives every limb's oscillator (treedraw.mjs),
// rain slants with the wind (precip.mjs), maple leaves flip and tear off in the strongest gusts and fall tumbling,
// puddles ring where drops land, and the wet road mirrors it all with Fresnel weight (street.mjs).
import { frame, set } from './raster.mjs';
import { camera, proj, lampE, nightEye, twilightRGB, haze, ground } from './outdoor.mjs';
import { gusts } from './wind.mjs';
import { douglasFir, westernRedcedar, bigleafMaple } from './pnwtrees.mjs';
import { rig, pose, stepTree, drawTree } from './treedraw.mjs';
import { createPrecip, stepPrecip, drawPrecip } from './precip.mjs';
import { wetRoad, wire, wireY } from './street.mjs';
import { crow } from './sprites.mjs';
import { lightRGB, litRGB, hps, planckSPD } from './spd.mjs';
import { STREET, MATERIALS, ADAPT } from './lights.mjs';
import { spectrumOf } from '../medium/spectral.mjs';
import { lampPalette } from './palette.mjs';
import { rngFrom } from '../seed.mjs';

const refl = (hex, spd) => litRGB(spectrumOf(hex), spd, { adapt: ADAPT });
// each drawn streak stands for ~2000 drops (Marshall-Palmer count of millimetre drops in the box over its particles);
// RAIN_GAIN is an authored legibility factor on top: at the computed brightness the streaks fall inside one palette
// step and vanish, so they are drawn 5 times brighter than the single-scattering estimate
const RAIN_GAIN = 5;
const mul = (a, k) => a.map(v => v * k);
const add3 = (a, b) => a.map((v, i) => v + b[i]);

export function treesScene({ W, H, variant = 'sodium', loop = true, T = 12, seed }) {
  const spd = STREET[variant](), sky = [0.02, 0.1, 0.22, 0.4].map(e => twilightRGB(e, 5));
  const self = { W, H, create: () => create({ W, H, spd, sky, loop, T, seed }), step, render, exposure: S => S.exposure,
    palette: () => lampPalette(paletteSpec(spd, sky, variant)) };
  return self;
}

function create({ W, H, spd, sky, loop, T, seed }) {
  const rng = rngFrom(seed), C = camera(W, H, { f: W * 0.5, height: 1.5, pitch: 0.075 });
  const trees = [
    { T: rig(douglasFir(rngFrom(seed + 'f'), { H: 31 }), rng), x: -12, z: 35 },
    { T: rig(westernRedcedar(rngFrom(seed + 'c'), { H: 21 }), rng), x: -2.5, z: 31 },
    { T: rig(bigleafMaple(rngFrom(seed + 'm'), { H: 15 }), rng), x: 8.5, z: 29.5 },
  ];
  const lamp = { x: 3.6, y: 8.4, z: 26.5, I: 6000 }, lampRGB = lightRGB(spd, { adapt: ADAPT });
  const S = { W, H, T, loop, t: 0, rng, C, trees, lamp, lampRGB, spd, sky, exposure: 0.09,
    wind: gusts(rngFrom(seed + 'w'), { U: 7, intensity: 0.55, loopT: loop ? T : 0 }),
    rain: createPrecip(rngFrom(seed + 'r'), { kind: 'rain', n: 2600, box: { x: [-16, 18], y: [0, 16], z: [1.2, 34] }, R: 5 }),
    leaves: [], ripples: [], puddles: [{ x: 1.5, z: 9, rx: 2, rz: 1.2 }, { x: -5, z: 14, rx: 3, rz: 1.4 }, { x: 5.5, z: 6.5, rx: 1.2, rz: 0.8 }] };
  for (let k = 0; k < 120; k++) step(S, 1 / 12);
  S.t = 0;
  return S;
}

const rainRate = S => { const w = 2 * Math.PI / S.T; return 0.55 + 0.35 * Math.sin(w * S.t + 1) + 0.1 * Math.sin(3 * w * S.t); };

function step(S, dt) {
  S.t += dt;
  const windAt = (t, x) => S.wind.at(t, x);
  for (const tr of S.trees) stepTree(tr.T, dt, windAt, S.t, tr.x);
  stepPrecip(S.rain, dt, windAt, S.t);
  // drops landing in puddles leave rings; the count follows the rain rate (expected arrivals per puddle per frame)
  for (const p of S.puddles) if (S.rng() < rainRate(S) * 0.9) S.ripples.push({ x: p.x + (S.rng() - 0.5) * 2 * p.rx, z: p.z + (S.rng() - 0.5) * 2 * p.rz, t0: S.t });
  S.ripples = S.ripples.filter(r => S.t - r.t0 < 1.3);
  leavesStep(S, dt);
  return S;
}

// maple leaves: a gust above about 1.5 times the mean tears some off; they fall at ~1.2 m/s, tumbling side to side
function leavesStep(S, dt) {
  const maple = S.trees[2], u = S.wind.at(S.t, maple.x);
  if (u > S.wind.U * 1.45 && S.rng() < 0.6) {
    const ls = maple.T.limbs.filter(l => l.leaves.length), l = ls[Math.floor(S.rng() * ls.length)];
    if (l?.tx != null) S.leaves.push({ x: maple.x + l.tx, y: l.ty, z: maple.z - 0.5, ph: S.rng() * 6.3, on: true });
  }
  for (const f of S.leaves) { if (f.y <= 0.02) continue; f.y = Math.max(0.01, f.y - 1.2 * dt); f.x += (S.wind.at(S.t, f.x) * 0.8 + 0.6 * Math.sin(S.t * 5 + f.ph)) * dt; }
  S.leaves = S.leaves.filter(f => f.x < 20).slice(-60);
}

// the sky: twilight colour at this elevation, normalised to luminance 1, times a luminance that falls from the
// horizon to the zenith (about 1 cd/m2 near the horizon at the blue hour under thin overcast; an order-of-magnitude
// figure), half mixed with the grey of the rain cloud
function skyAt(S, Y) {
  const el = Math.max(0, (S.H / 2 - Y) / S.C.f + S.C.pitch), k = Math.min(2.999, el / 0.14), i = Math.floor(k), f = k - i;
  const c = S.sky[i].map((v, j) => v + (S.sky[i + 1][j] - v) * f), Y0 = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], L = 1.1 - 0.9 * Math.min(1, el / 0.6);
  return c.map(v => (0.55 * v / Y0 + 0.45) * L);
}

function render(S) {
  const F = frame(S.W, S.H), { C } = S, gust = Math.max(0, S.wind.at(S.t, 7) / S.wind.U - 1);
  for (let Y = 0; Y < S.H; Y++) { const c = skyAt(S, Y), cl = 0.85 + 0.15 * Math.sin(Y * 0.3 + S.t * 0.4); for (let X = 0; X < S.W; X++) F.d.set(mul(c, cl * (0.9 + 0.1 * Math.sin(X * 0.05 + S.t * 0.25))), 3 * (Y * S.W + X)); }
  house(F, S);
  lawn(F, S);
  const skyE = mul(skyAt(S, 0), 3);   // twilight irradiance from the sky dome, about pi times its radiance
  for (const tr of S.trees) {
    pose(tr.T, 0, 0);
    const P = (x, y) => { const p = proj(C, tr.x + x, y, tr.z); return p ? [p[0], p[1]] : [-9, -9]; };
    const light = (x, y, up) => add3(mul(skyE, 0.25 + 0.75 * up), mul(S.lampRGB, lampE(S.lamp, [tr.x + x, y, tr.z], [0, up, -(1 - up)]) / Math.PI));
    drawTree(F, tr.T, P, light, COLS(S.spd), { t: S.t, gust: Math.min(1, gust), k: C.f / tr.z });
  }
  poleAndWire(F, S);
  for (const f of S.leaves) { const p = proj(C, f.x, f.y, f.z); if (p) set(F, p[0], p[1], mul(refl(MATERIALS.maple, S.spd), 0.02 + lampE(S.lamp, [f.x, f.y, f.z]) / Math.PI)); }
  const src = { w: F.w, h: F.h, d: F.d.slice() }, diffuse = (g, E) => add3(mul(refl(MATERIALS.asphalt, S.spd), E / Math.PI), mul(skyE, 0.02));
  haze(src, C, S.lamp, S.lampRGB, { sigma: 7e-4 * (0.4 + rainRate(S)), far: 40 });
  wetRoad(F, C, src, { zRef: 31, puddles: S.puddles, ripples: S.ripples, diffuse, lamp: S.lamp, t: S.t, roadZ: [1, 26] });
  haze(F, C, S.lamp, S.lampRGB, { sigma: 7e-4 * (0.4 + rainRate(S)), far: 40 });
  const illum = p => add3(mul(S.lampRGB, lampE(S.lamp, p, [0, 0, -1]) * 0.5 + lampE(S.lamp, p) * 0.5), mul(skyE, 0.5));
  drawPrecip(F, S.rain, C, illum, { t: S.t, rate: rainRate(S), windAt: (t, x) => S.wind.at(t, x), albedo: 0.6, exposureTime: 1 / 30, weight: 2000 * RAIN_GAIN });
  crows(F, S);
  return nightEye(F, { scale: 1, hi: 3 });
}

// the far verge and lawn beyond the street, wet grass lit by the lamp and the sky
function lawn(F, S) {
  const { C } = S, grass = refl('#3d4a2a', S.spd), sky = skyAt(S, 0);
  for (let Y = 0; Y < S.H; Y++) for (let X = 0; X < S.W; X++) {
    const g = ground(C, X + 0.5, Y + 0.5); if (!g || g[2] < 26) continue;
    const E = lampE(S.lamp, g), c = grass.map((v, i) => v * (E / Math.PI) + 0.06 * sky[i] * v * 3);
    F.d.set(g[2] < 27.5 ? c.map(v => v * 1.6 + 0.004) : c, 3 * (Y * S.W + X));
  }
}

function house(F, S) {
  const { C } = S, k = C.f / 46, base = proj(C, 14, 0, 46), top = proj(C, 14, 7, 46);
  if (!base || !top) return;
  const x0 = base[0] - 5 * k, x1 = base[0] + 9 * k, wall = [0.012, 0.012, 0.014];
  for (let Y = Math.floor(top[1]); Y < base[1]; Y++) for (let X = Math.floor(x0); X < x1; X++) set(F, X, Y, wall);
  const win = lightRGB(planckSPD(2800), { adapt: ADAPT }).map(v => v * 1.2);
  for (const [wx, wy] of [[1, 2.5], [4, 2.5], [1, 5.2]]) for (let Y = 0; Y < 1.1 * k; Y++) for (let X = 0; X < 1.2 * k; X++) set(F, x0 + wx * k + X, base[1] - wy * k + Y, win);
}

function poleAndWire(F, S) {
  const { C, lamp } = S, b = proj(C, lamp.x + 0.6, 0, lamp.z + 0.3), t = proj(C, lamp.x + 0.6, 10.5, lamp.z + 0.3);
  const wood = mul(refl(MATERIALS.wood, S.spd), 0.05);
  for (let Y = Math.floor(t[1]); Y < b[1]; Y++) { set(F, b[0], Y, wood); set(F, b[0] + 1, Y, wood); }
  const head = proj(C, lamp.x, lamp.y, lamp.z), arm = proj(C, lamp.x + 0.6, lamp.y + 0.3, lamp.z + 0.3);
  for (let i = 0; i <= 10; i++) set(F, arm[0] + (head[0] - arm[0]) * i / 10, arm[1] + (head[1] - arm[1]) * i / 10, [0.01, 0.01, 0.01]);
  for (let dx = -2; dx <= 2; dx++) set(F, head[0] + dx, head[1] - 1, [0.006, 0.006, 0.006]);
  for (let dx = -1; dx <= 1; dx++) set(F, head[0] + dx, head[1], mul(S.lampRGB, 400));
  const P = (x, y, z) => proj(C, x, y, z), ink = [0.004, 0.004, 0.005];
  wire(F, P, -20, 9.7, lamp.x + 0.6, 9.9, lamp.z + 0.3, 0.6, ink); wire(F, P, lamp.x + 0.6, 9.9, 24, 9.6, lamp.z + 0.3, 0.5, ink);
  S.wireAt = x => wireY(-20, 9.7, lamp.x + 0.6, 9.9, 0.6, x);
}

function crows(F, S) {
  const { C } = S, L = { key: mul(S.sky[3], 0.6), fill: [0.002, 0.002, 0.003] }, x = -4.2, y = S.wireAt(x) + 0.02, p = proj(C, x, y, S.lamp.z + 0.3);
  if (p) crow(F, p[0], p[1], C.f / (S.lamp.z + 0.3), S.t, L, 'perch');
  // the evening commute: a loose line of crows crossing high up, 40 to 70 m away, at ~12 m/s into the wind
  for (let i = 0; i < 6; i++) {
    const z = 30 + ((9 * i) % 20), sp = S.loop ? 150 / S.T : 11 + (i % 3), xw = -30 + ((S.t * sp + i * 17) % 75), yw = 16 + 3 * Math.sin(i * 2.1) + 0.6 * Math.sin(S.t * 0.8 + i);
    const q = proj(C, xw, yw, z); if (q) crow(F, q[0], q[1], C.f / z, S.t, L, 'fly', i * 1.3);
  }
}

const COLS = spd => ({ bark: refl(MATERIALS.bark, spd).map(v => v * 0.6), moss: refl(MATERIALS.moss, spd), needle: refl(MATERIALS.fir, spd),
  spray: refl(MATERIALS.cedar, spd), leaf: refl(MATERIALS.maple, spd), under: refl(MATERIALS.mapleUnder, spd) });

function paletteSpec(spd, sky, variant) {
  const mats = [MATERIALS.fir, MATERIALS.cedar, MATERIALS.maple, MATERIALS.mapleUnder, MATERIALS.bark, MATERIALS.moss, MATERIALS.asphalt, MATERIALS.wood];
  return { label: `trees, ${variant}`, max: 56, lights: [{ spd, adapt: ADAPT, gains: [0.3, 1, 3, 8, 20, 60, 150] }],
    materials: mats, colors: sky.map(rgb => ({ rgb: rgb.map(v => v / (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2])), gains: [0.15, 0.3, 0.5, 0.8, 1.1] })).concat([{ rgb: lightRGB(planckSPD(2800), { adapt: ADAPT }), gains: [0.4, 1.2] }]),
    emitters: [{ spd, adapt: ADAPT, gains: [5, 50, 400] }], exposure: 0.09 };
}
export { hps };
