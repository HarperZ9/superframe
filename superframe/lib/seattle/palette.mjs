// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// palette.mjs: from a lamp's spectrum to a pixel-art palette. A palette here is not picked by eye. It is the set of
// colours the scene's materials can take under the scene's lights, at the brightness steps the scene reaches, after
// the same tone curve the frames use, merged down to a fixed count in CIELAB.
//
// The narrow sodium spectrum is the reason this matters. Under high-pressure sodium nearly all the light sits between
// 560 and 620 nm, so a red car, a green hedge and a grey road reflect almost the same mix and land on almost the same
// orange: the palette collapses toward one hue ramp. Under a blackbody the same materials keep their hues. The
// palette carries that difference before any pixel is drawn.
//
//   candidates({ lights, materials, gains, tone })   every lit colour, display-linear
//   reduce(cands, max)                               greedy agglomerative merge in CIELAB (weights kept)
//   lampPalette(spec)                                -> { hexes, cb } where cb is a quantize codebook list
import { litRGB, lightRGB } from './spd.mjs';
import { spectrumOf } from '../medium/spectral.mjs';
import { list } from '../quantize/codebook.mjs';
import { enc, linToXYZ, xyzToLab } from '../study/cmath.mjs';
import { toneRGB } from './pixq.mjs';

const curve3 = (c, g, e, W) => toneRGB(c[0] * g, c[1] * g, c[2] * g, e, W);

const lab = v => xyzToLab(linToXYZ(v));
const hex = v => '#' + v.map(c => Math.round(255 * enc(Math.max(0, Math.min(1, c)))).toString(16).padStart(2, '0')).join('');

// lights: [{ spd, adapt?, gains: [scene intensity steps] }]; materials: hex reflectances (daylight appearance) or
// 16-band spectra; emitters: [{ spd, gains }] for the lamps themselves; colors: [{ rgb, gains }] for lights already
// in linear RGB (a signal lens is a filter over a filament, computed in lights.mjs).
export function candidates({ lights = [], materials = [], emitters = [], colors = [], exposure = 1, white = 6 }) {
  const out = [{ v: [0, 0, 0], w: 50 }], R = materials.map(m => (typeof m === 'string' ? spectrumOf(m) : m));
  for (const L of lights) for (const r of R) {
    const c = litRGB(r, L.spd, { adapt: L.adapt ?? 0 });
    for (const g of L.gains) out.push({ v: curve3(c, g, exposure, white), w: 1 });
  }
  for (const C of colors) for (const g of C.gains) out.push({ v: curve3(C.rgb, g, exposure, white), w: 2 });
  for (const E of emitters) { const c = lightRGB(E.spd, { adapt: E.adapt ?? 0 }); for (const g of E.gains) out.push({ v: curve3(c, g, exposure, white), w: 2 }); }
  return out;
}

export function reduce(cands, max) {
  const items = cands.map(c => ({ v: c.v.slice(), w: c.w, L: lab(c.v) }));
  while (items.length > max) {
    let bi = 0, bj = 1, bd = Infinity;
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i].L, b = items[j].L, d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
      // a mild weight term: merging two heavy clusters costs more than folding a stray colour into one
      const cost = d * Math.min(items[i].w, items[j].w) ** 0.25;
      if (cost < bd) { bd = cost; bi = i; bj = j; }
    }
    const A = items[bi], B = items[bj], W = A.w + B.w, keepA = A.w >= 50 || B.w < 50;
    const v = keepA && A.w >= 50 ? A.v : B.w >= 50 ? B.v : A.v.map((x, k) => (x * A.w + B.v[k] * B.w) / W);
    items[bi] = { v, w: W, L: lab(v) }; items.splice(bj, 1);
  }
  return items.map(i => i.v);
}

export function lampPalette(spec) {
  const vs = reduce(candidates(spec), spec.max ?? 40);
  vs.sort((a, b) => lab(a)[0] - lab(b)[0]);
  const hexes = [...new Set(vs.map(hex))];
  return { hexes, cb: list(hexes, { label: spec.label ?? 'lamp palette' }) };
}
