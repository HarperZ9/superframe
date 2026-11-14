// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// sprites.mjs: the living things, drawn from proportions in metres, not from pixel maps, and shaded by the light that
// actually reaches them (each takes a key light and a fill as linear RGB irradiance-like colours).
//   person(F, x, y, k, t, light)   a child-sized-to-adult figure seen from behind at a porch rail, breathing
//   raccoon(F, x, y, k, t, light, dir)  Procyon lotor walking: body ~0.6 m, ringed tail ~0.3 m, a diagonal gait
//   crow(F, x, y, k, t, light, mode)    Corvus brachyrhynchos: perched hunched in rain, or flapping at ~4 Hz
// x, y: screen position of the feet (or body centre for a flying crow); k: pixels per metre at that depth.
// Gait and flap numbers are approximate: raccoons walk in a diagonal sequence near 1 to 2 strides per second; crows
// flap a little above 3 Hz in level flight (from memory, moderate confidence).
import { set, disc, poly } from './raster.mjs';

const shade = (L, f, k = 1) => L.key.map((v, c) => (v * f + L.fill[c]) * k);

export function person(F, x, y, k, t, L, { breath = 0 } = {}) {
  const h = 1.72 * k, sh = 0.46 * k, br = 1 + 0.012 * Math.sin(2 * Math.PI * t / 4.2);   // breathing at ~14 per minute
  const coat = L.coat, dark = shade(L, 0.15, 0.6), rim = shade(L, 1.0, 1.3);
  // legs and boots
  poly(F, [[x - 0.17 * k, y], [x - 0.04 * k, y], [x - 0.05 * k, y - 0.82 * k], [x - 0.19 * k, y - 0.82 * k]], dark);
  poly(F, [[x + 0.05 * k, y], [x + 0.18 * k, y], [x + 0.19 * k, y - 0.82 * k], [x + 0.05 * k, y - 0.82 * k]], dark);
  // coat: wider at the shoulders, hem below the hips
  const top = y - 1.44 * k * br, hem = y - 0.68 * k;
  poly(F, [[x - 0.24 * k, hem], [x + 0.24 * k, hem], [x + sh / 2, top + 0.06 * k], [x + 0.16 * k, top], [x - 0.16 * k, top], [x - sh / 2, top + 0.06 * k]], coat(0.45));
  // the light from the kitchen window behind and to the right catches the right edge of the coat and the hood
  for (let yy = Math.floor(top); yy < hem; yy++) { set(F, x + sh / 2 - 1 - (yy < top + 0.1 * k ? 1 : 0), yy, rim, 0.7); }
  // arms on the rail
  poly(F, [[x - sh / 2, top + 0.08 * k], [x - sh / 2 - 0.05 * k, y - 0.98 * k], [x - 0.3 * k, y - 0.95 * k]], coat(0.3));
  poly(F, [[x + sh / 2, top + 0.08 * k], [x + sh / 2 + 0.05 * k, y - 0.98 * k], [x + 0.3 * k, y - 0.95 * k]], coat(0.6));
  // head in a knit hat
  const hy = top - 0.13 * k;
  disc(F, x, hy, 0.11 * k, L.hat ?? dark);
  disc(F, x + 0.02 * k, hy - 0.06 * k, 0.1 * k, L.hat ?? dark);
  set(F, x + 0.1 * k, hy, rim, 0.6);
  return [x - 0.25 * k, hy - 0.2 * k, x + 0.25 * k, y, h];
}

export function raccoon(F, x, y, k, t, L, dir = 1, { walking = true } = {}) {
  const body = shade(L, 0.6), dark = shade(L, 0.2, 0.7), light = shade(L, 1.0, 1.2), s = dir;
  const step = walking ? 2 * Math.PI * 1.6 * t : 0, bob = walking ? 0.015 * k * Math.abs(Math.sin(step)) : 0;
  const by = y - 0.24 * k - bob;
  // legs: diagonal pairs move together
  for (const [ox, ph] of [[-0.22, 0], [0.18, Math.PI], [-0.16, Math.PI], [0.24, 0]]) {
    const sw = walking ? 0.05 * k * Math.sin(step + ph) : 0, lx = x + s * ox * k + sw;
    for (let yy = Math.floor(by); yy <= y; yy++) set(F, lx, yy, dark);
  }
  // body: hunched, highest over the hips
  poly(F, [[x - s * 0.3 * k, by + 0.04 * k], [x - s * 0.26 * k, by - 0.12 * k], [x - s * 0.05 * k, by - 0.2 * k], [x + s * 0.2 * k, by - 0.12 * k], [x + s * 0.3 * k, by - 0.02 * k], [x + s * 0.18 * k, by + 0.07 * k]], body);
  // head with the dark mask and pale muzzle
  const hx = x + s * 0.36 * k, hy = by - 0.06 * k;
  disc(F, hx, hy, 0.075 * k, body);
  set(F, hx + s * 0.05 * k, hy, dark); set(F, hx, hy - 0.01 * k, dark);
  set(F, hx + s * 0.1 * k, hy + 0.02 * k, light);
  set(F, hx - s * 0.03 * k, hy - 0.08 * k, light);   // ear tip
  // tail: four dark rings on a pale ground
  for (let q = 0; q < 8; q++) { const tx = x - s * (0.32 + q * 0.04) * k, ty = by - 0.02 * k + q * 0.012 * k; disc(F, tx, ty, 0.035 * k, q % 2 ? dark : light); }
}

export function crow(F, x, y, k, t, L, mode = 'perch', ph = 0) {
  const ink = shade(L, 0.25, 0.55), sheen = shade(L, 1, 0.9);
  if (mode === 'perch') {
    // hunched on a wire in rain: a teardrop body, head pulled in, tail down; it shifts its weight now and then
    const shift = Math.sin(t * 0.7 + ph) > 0.93 ? 1 : 0;
    poly(F, [[x - 0.1 * k, y], [x + 0.1 * k, y], [x + 0.12 * k, y - 0.22 * k], [x - 0.03 * k + shift, y - 0.3 * k], [x - 0.12 * k, y - 0.18 * k]], ink);
    disc(F, x - 0.04 * k + shift, y - 0.3 * k, 0.06 * k, ink);
    set(F, x - 0.12 * k + shift, y - 0.3 * k, ink);
    poly(F, [[x + 0.06 * k, y - 0.04 * k], [x + 0.12 * k, y + 0.16 * k], [x + 0.03 * k, y + 0.16 * k]], ink);
    set(F, x + 0.06 * k, y - 0.2 * k, sheen, 0.4);
    return;
  }
  // flying: wing tips sweep through a flap cycle; the body tilts with the beat
  const a = Math.sin(2 * Math.PI * 3.4 * t + ph), span = 0.5 * k, up = a * 0.22 * k;
  poly(F, [[x - 0.14 * k, y], [x + 0.16 * k, y - 0.02 * k], [x + 0.2 * k, y + 0.02 * k], [x - 0.12 * k, y + 0.05 * k]], ink);
  poly(F, [[x - 0.05 * k, y], [x + 0.06 * k, y], [x + 0.02 * k - span * 0.2, y - up - 0.02 * k], [x - span * 0.5, y - up * 1.2]], ink);
  poly(F, [[x - 0.03 * k, y + 0.02 * k], [x + 0.08 * k, y + 0.02 * k], [x + span * 0.35, y - up * 0.8], [x + span * 0.1, y - up]], ink);
}
