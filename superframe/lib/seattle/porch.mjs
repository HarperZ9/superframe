// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// porch.mjs: a person on the back porch on a winter night, seen from the kitchen doorway behind them. The moon comes
// and goes behind broken cloud; snow falls through the alley lamp's cone beyond the fence; the open kitchen door
// throws warm light past the person and lays their shadow and the rail's across the snow; a raccoon crosses the yard
// in the moonlight and leaves tracks that the falling snow slowly fills.
// Light: three sources, each with its own spectrum and geometry. The moon (about 4100 K, about 0.2 lx in clear sky,
// attenuated by the cloud drifting over it, casting shadows); the alley lamp (high-pressure sodium or a filament,
// inverse square with a cutoff); the kitchen door (a 2800 K bulb, a small Lambertian area source). Moonlit snow is
// dim enough that the night eye drains its colour toward blue-grey (outdoor.nightEye).
import { frame, set, disc } from './raster.mjs';
import { camera, proj, ground, lampE, nightEye, moonRGB, corona, cloudCover, haze, incandescentRGB } from './outdoor.mjs';
import { gusts } from './wind.mjs';
import { createPrecip, stepPrecip, drawPrecip } from './precip.mjs';
import { person, raccoon } from './sprites.mjs';
import { douglasFir, bigleafMaple } from './pnwtrees.mjs';
import { rig, pose, stepTree, drawTree } from './treedraw.mjs';
import { lightRGB, litRGB, planckSPD, moonSPD } from './spd.mjs';
import { STREET, MATERIALS, ADAPT } from './lights.mjs';
import { spectrumOf } from '../medium/spectral.mjs';
import { lampPalette } from './palette.mjs';
import { rngFrom } from '../seed.mjs';

const mul = (a, k) => a.map(v => v * k), add3 = (a, b) => a.map((v, i) => v + b[i]);
const refl = (hex, spd, adapt = ADAPT) => litRGB(spectrumOf(hex), spd, { adapt });
const MOON = { az: 0.3, el: 0.33 }, MOON_E = 0.2;   // radians; lux on a surface facing the moon in clear sky
const RAIL_Z = 6.6;

export function porchScene({ W, H, variant = 'sodium', loop = true, T = 12, seed }) {
  const spd = STREET[variant]();
  return { W, H, create: () => create({ W, H, spd, loop, T, seed }), step, render, exposure: S => S.exposure, palette: () => lampPalette(paletteSpec(spd, variant)) };
}

function create({ W, H, spd, loop, T, seed }) {
  const rng = rngFrom(seed), C = camera(W, H, { f: W * 0.72, height: 2.55, pitch: 0.02 });
  const S = { W, H, T, loop, t: 0, rng, C, spd, exposure: 5,
    lamp: { x: -7, y: 7, z: 58, I: 6000 }, lampRGB: lightRGB(spd, { adapt: ADAPT }),
    win: { x: 0.3, y: 1.9, z: 0, rgb: incandescentRGB(2800, 1) }, moon: moonRGB(1), person: { x: -0.9, z: 6.4 },
    wind: gusts(rngFrom(seed + 'w'), { U: 1.4, intensity: 0.6, loopT: loop ? T : 0 }),
    snow: createPrecip(rngFrom(seed + 's'), { kind: 'snow', n: 3000, box: { x: [-24, 20], y: [0, 12], z: [3, 64] } }),
    firs: [-21, -15, -10.5, 9, 14].map((x, i) => ({ T: rig(douglasFir(rngFrom(seed + 'f' + i), { H: 24 + 7 * (i % 2) }), rng), x, z: 66 + 4 * (i % 3) })),
    maple: { T: rig(bigleafMaple(rngFrom(seed + 'm'), { H: 12 }), rng), x: 6.5, z: 17 },
    tracks: [] };
  S.maple.T.limbs.forEach(l => (l.leaves = []));   // winter: the maple is bare
  for (let k = 0; k < 60; k++) step(S, 1 / 12);
  S.t = 0; S.tracks = [];
  return S;
}

const snowRate = S => 0.55 + 0.4 * Math.sin(2 * Math.PI * S.t / S.T + 0.5);
const moonT = S => cloudCover(MOON.az, MOON.el, S.t, { loopT: S.loop ? S.T : 0, cover: 0.5 });
// the raccoon's walk across the yard; it stops to sniff a little past halfway
function coonAt(S) {
  const u = ((S.t / S.T) % 1 + 1) % 1, walk = u < 0.55 ? u / 0.55 : u < 0.7 ? 1 : 1 + (u - 0.7) / 0.3 * 0.6;
  const a = [-9, 0, 15], b = [5, 0, 12.5], k = Math.min(1.6, walk) / 1.6;
  return { p: [a[0] + (b[0] - a[0]) * k, 0, a[2] + (b[2] - a[2]) * k], walking: !(u >= 0.55 && u < 0.7) };
}

function step(S, dt) {
  S.t += dt;
  stepPrecip(S.snow, dt, (t, x) => S.wind.at(t, x), S.t);
  for (const f of [...S.firs, S.maple]) stepTree(f.T, dt, (t, x) => S.wind.at(t, x) * 2.5, S.t, f.x);
  const c = coonAt(S), last = S.tracks.at(-1);
  if (c.walking && (!last || Math.hypot(c.p[0] - last.x, c.p[2] - last.z) > 0.18)) S.tracks.push({ x: c.p[0], z: c.p[2], t: S.t, side: S.tracks.length % 2 });
  return S;
}

// is the ground point p in shadow from a light at q? Blockers: the deck, the rail and its posts, the person on it,
// the fence at the back of the yard
function blocked(p, q, S) {
  const P = S.person;
  for (let k = 1; k < 40; k++) {
    const u = k / 40, x = p[0] + (q[0] - p[0]) * u, y = p[1] + (q[1] - p[1]) * u, z = p[2] + (q[2] - p[2]) * u;
    if (z < RAIL_Z && z > -0.2 && y < 0.95 && y > 0.8) return true;
    const post = Math.abs((((x % 1.8) + 1.8) % 1.8) - 0.9) < 0.05;
    if (Math.abs(z - RAIL_Z) < 0.06 && ((y > 1.86 && y < 1.98) || (post && y < 1.95 && y > 0.95))) return true;
    if (Math.hypot(x - P.x, z - P.z) < 0.22 && y > 0.95 && y < 2.62) return true;
    if (Math.abs(z - 22) < 0.1 && y < 1.8) return true;
  }
  return false;
}
const moonDir = [Math.sin(MOON.az) * Math.cos(MOON.el), Math.sin(MOON.el), Math.cos(MOON.az) * Math.cos(MOON.el)];

function snowGround(S, F) {
  const { C } = S, white = refl(MATERIALS.snow, S.spd), whiteM = refl(MATERIALS.snow, moonSPD(), 0.5), tm = moonT(S);
  for (let Y = 0; Y < S.H; Y++) for (let X = 0; X < S.W; X++) {
    const g = ground(C, X + 0.5, Y + 0.5); if (!g || g[2] > 70 || g[2] < RAIL_Z) continue;
    const p = [g[0], 0.01, g[2]], far = [p[0] + moonDir[0] * 80, moonDir[1] * 80, p[2] + moonDir[2] * 80];
    // drifts: the snow surface undulates, so the low moon shades its lee sides
    const tilt = 0.25 * Math.sin(g[0] * 0.9 + Math.sin(g[2] * 0.7)) * Math.cos(g[2] * 1.3), cosM = Math.max(0, Math.sin(MOON.el) + tilt * Math.cos(MOON.el));
    const Em = blocked(p, far, S) ? 0.04 * MOON_E : MOON_E * tm * cosM + 0.04 * MOON_E;
    const El = blocked(p, [S.lamp.x, S.lamp.y, S.lamp.z], S) ? 0 : lampE(S.lamp, p), Ew = blocked(p, [S.win.x, S.win.y, S.win.z], S) ? 0 : windowE(S, p);
    const c = add3(add3(mul(whiteM, Em / Math.PI), mul(white, El / Math.PI)), mul(S.win.rgb, Ew * 0.9 / Math.PI));
    F.d.set(mul(c, trackDent(S, g)), 3 * (Y * S.W + X));
  }
}
// the open kitchen door behind the camera as a small area source facing out: E = Lw A cos_s cos_r / d^2, with a lit
// kitchen seen through the door at about 60 cd/m2 over 1.9 m2 (authored, of the right order)
function windowE(S, p, n = [0, 1, 0]) {
  const w = S.win, dx = w.x - p[0], dy = w.y - p[1], dz = w.z - p[2], d2 = dx * dx + dy * dy + dz * dz, d = Math.sqrt(d2);
  return Math.max(0, -dz / d) * Math.max(0, (dx * n[0] + dy * n[1] + dz * n[2]) / d) * 60 * 1.9 / d2;
}
// a track is a small dent whose floor sits in its own shadow; falling snow fills it over a few minutes (fades)
function trackDent(S, g) {
  for (const t of S.tracks) { const age = S.t - t.t; if (age < 0) continue; const dx = g[0] - t.x - (t.side ? 0.06 : -0.06), dz = g[2] - t.z; if (dx * dx + dz * dz < 0.008) return 1 - 0.45 * Math.exp(-age / 40); }
  return 1;
}

function render(S) {
  const F = frame(S.W, S.H), { C } = S, tm = moonT(S);
  skyAndMoon(F, S, tm);
  for (const f of S.firs) treeAt(F, S, f, tm);
  snowGround(S, F);
  fence(F, S);
  alleyLamp(F, S);
  treeAt(F, S, S.maple, tm);
  const c = coonAt(S), q = proj(C, ...c.p);
  if (q) raccoon(F, q[0], q[1], C.f / q[2], S.t, { key: mul(S.moon, MOON_E * tm * 0.25), fill: add3(mul(S.lampRGB, lampE(S.lamp, c.p) * 0.1), mul(S.win.rgb, windowE(S, c.p) * 0.3)) }, 1, { walking: c.walking });
  const illum = p => add3(mul(S.lampRGB, lampE(S.lamp, p, [0, 0, -1]) * 0.5 + lampE(S.lamp, p) * 0.5), add3(mul(S.moon, MOON_E * tm), mul(S.win.rgb, windowE(S, p, [0, 0, -1]))));
  haze(F, C, S.lamp, S.lampRGB, { sigma: 1.6e-3 * snowRate(S), far: 80 });
  drawPrecip(F, S.snow, C, illum, { t: S.t, rate: snowRate(S), albedo: 0.85, weight: 12 });
  porchAndPerson(F, S, tm);
  return nightEye(F, { scale: 1, hi: 2 });
}

function skyAndMoon(F, S, tm) {
  const { C } = S, M = proj(C, moonDir[0] * 1e4, C.height + moonDir[1] * 1e4, moonDir[2] * 1e4), glow = mul(S.lampRGB, 0.004);
  for (let Y = 0; Y < S.H; Y++) for (let X = 0; X < S.W; X++) {
    const az = (X - S.W / 2) / C.f, el = (S.H / 2 - Y) / C.f + C.pitch, cl = cloudCover(az, el, S.t, { loopT: S.loop ? S.T : 0, cover: 0.5 });
    // cloud lit by the moon from above and by the town's sodium from below; clear gaps show the dark sky
    let c = add3(mul(S.moon, 0.0025 + 0.012 * (1 - cl) * tm), mul(glow, (1 - cl) * 1.5 * Math.exp(-el * 3)));
    if (M) { const th = Math.hypot(X - M[0], Y - M[1]) / C.f; if (th < 0.2) { const k = corona(th); c = add3(c, S.moon.map((v, i) => v * k[i] * 0.24 * (1 - tm) * tm)); } }
    F.d.set(c, 3 * (Y * S.W + X));
  }
  if (M) disc(F, M[0], M[1], Math.max(1.3, 0.0045 * C.f), mul(S.moon, 30 * (0.15 + 0.85 * tm)));
}

function treeAt(F, S, f, tm) {
  pose(f.T, 0, 0);
  const P = (x, y) => { const p = proj(S.C, f.x + x, y, f.z); return p ? [p[0], p[1]] : [-9, -9]; };
  const light = (x, y, up) => add3(mul(S.moon, MOON_E * tm * (0.2 + 0.6 * up) / Math.PI), mul(S.lampRGB, lampE(S.lamp, [f.x + x, y, f.z], [0, up, -(1 - up)]) / Math.PI));
  const snowy = refl(MATERIALS.snow, S.spd);
  drawTree(F, f.T, P, light, { bark: refl(MATERIALS.bark, S.spd), moss: snowy, needle: refl(MATERIALS.fir, S.spd), spray: snowy, leaf: snowy, under: snowy }, { t: S.t, k: S.C.f / f.z });
}

// cedar plank fence at the back of the yard; the lamp and the moon are both beyond it, so its yard side is backlit and
// only sky light reaches it; snow lies along the top rail
function fence(F, S) {
  const { C } = S, wood = refl(MATERIALS.fence, S.spd), c = mul(wood, 0.008), top = mul(refl(MATERIALS.snow, S.spd), 0.02);
  for (let x = -24; x < 20; x += 0.06) {
    const b = proj(C, x, 0, 22), t = proj(C, x, 1.8, 22); if (!b || !t) continue;
    for (let Y = Math.floor(t[1]); Y < b[1]; Y++) set(F, b[0], Y, Math.round(x / 0.06) % 3 ? c : mul(c, 0.7));
    set(F, t[0], t[1] - 1, top);
  }
}

function alleyLamp(F, S) {
  const { C, lamp } = S, b = proj(C, lamp.x - 1.4, 0, lamp.z), t = proj(C, lamp.x - 1.4, lamp.y + 0.4, lamp.z), h = proj(C, lamp.x, lamp.y, lamp.z);
  for (let Y = Math.floor(t[1]); Y < b[1]; Y++) set(F, b[0], Y, [0.006, 0.005, 0.004]);
  for (let i = 0; i <= 8; i++) set(F, t[0] + (h[0] - t[0]) * i / 8, t[1] + (h[1] - t[1]) * i / 8, [0.006, 0.005, 0.004]);
  set(F, h[0], h[1], mul(S.lampRGB, 300)); set(F, h[0] + 1, h[1], mul(S.lampRGB, 200)); set(F, h[0] - 1, h[1] - 1, [0.01, 0.01, 0.01]);
}

// the deck boards run away from the camera to the rail; the person leans on the rail with their back to us
function porchAndPerson(F, S, tm) {
  const { C } = S, wood = refl(MATERIALS.wood, S.spd), snow = refl(MATERIALS.snow, S.spd), P = S.person;
  for (let Y = 0; Y < S.H; Y++) for (let X = 0; X < S.W; X++) {
    const d = [(X + 0.5 - C.W / 2) / C.f, (C.H / 2 - Y - 0.5) / C.f + C.pitch, 1], t = (0.95 - C.height) / d[1];
    if (d[1] >= 0 || t * d[2] > RAIL_Z) continue;
    const p = [d[0] * t, 0.95, d[2] * t], E = windowE(S, p) + 0.02, seam = Math.abs((((p[0] + 10) % 0.14) + 0.14) % 0.14 - 0.07) < 0.008 ? 0.6 : 1;
    F.d.set(mul(wood, E / Math.PI * 0.6 * seam), 3 * (Y * S.W + X));
  }
  const r0 = proj(C, -12, 1.95, RAIL_Z), r1 = proj(C, 12, 1.95, RAIL_Z), railC = mul(wood, windowE(S, [0, 1.95, RAIL_Z], [0, 0, -1]) / Math.PI * 0.8);
  for (let i = 0; i <= 400; i++) { const x = r0[0] + (r1[0] - r0[0]) * i / 400, y = r0[1] + (r1[1] - r0[1]) * i / 400; set(F, x, y, railC); set(F, x, y + 1, railC); set(F, x, y - 1, mul(snow, 0.012 + 0.02 * tm)); }
  for (let x = -11.7; x < 12; x += 1.8) { const a = proj(C, x, 0.95, RAIL_Z), b = proj(C, x, 1.95, RAIL_Z); for (let Y = Math.floor(b[1]); Y < a[1]; Y++) set(F, a[0], Y, mul(railC, 0.8)); }
  const feet = proj(C, P.x, 0.95, P.z), k = C.f / feet[2], back = windowE(S, [P.x, 1.6, P.z], [0, 0, -1]) / Math.PI;
  const box = person(F, feet[0], feet[1], k, S.t, { key: mul(S.win.rgb, back * 0.5), fill: mul(S.moon, MOON_E * tm * 0.08), coat: f => mul(refl(MATERIALS.coat, S.spd), back * (0.12 + f * 0.4)), hat: mul(refl('#6e2f2a', S.spd), back * 0.5) });
  breath(F, S, box, k);
}

// breath: exhaled air at 35 C meets air below freezing and condenses into a cloud that rises, spreads and evaporates
// in about two seconds; one breath every ~4 s, lit by the door behind and the moon ahead
function breath(F, S, box, k) {
  const ph = (S.t % 4.2) / 4.2; if (ph > 0.5) return;
  const age = ph * 4.2, x0 = (box[0] + box[2]) / 2 - 0.12 * k, y0 = box[1] + 0.12 * k, n = 14;
  for (let i = 0; i < n; i++) {
    const a = i / n * 6.28, r = (0.05 + 0.18 * age) * k * (0.5 + 0.5 * ((i * 7) % 5) / 5), x = x0 - age * 0.25 * k + Math.cos(a) * r, y = y0 - age * 0.12 * k + Math.sin(a) * r * 0.6;
    set(F, x, y, add3(mul(S.win.rgb, 0.02 * (1 - age / 2.1)), mul(S.moon, 0.004)), 0.35);
  }
}

function paletteSpec(spd, variant) {
  return { label: `porch, ${variant}`, max: 56,
    lights: [{ spd, adapt: ADAPT, gains: [0.01, 0.03, 0.08, 0.2, 0.5, 1.5, 5] }, { spd: moonSPD(), adapt: 0.5, gains: [0.005, 0.01, 0.02, 0.04] }, { spd: planckSPD(2800), adapt: ADAPT, gains: [0.01, 0.04, 0.12, 0.4, 1.2] }],
    materials: [MATERIALS.snow, MATERIALS.wood, MATERIALS.siding, MATERIALS.fir, MATERIALS.coat, MATERIALS.fur, MATERIALS.fence],
    colors: [{ rgb: [0.62, 0.78, 1], gains: [0.002, 0.005, 0.01, 0.02, 0.035, 0.06] }], emitters: [{ spd, adapt: ADAPT, gains: [10, 100] }], exposure: 5 };
}
