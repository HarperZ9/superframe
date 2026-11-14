// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// strata.mjs: direction 3, shared ground. CMMNS is cut down through layered ground. Each stratum is a dated
// contribution, newest on top, and the letters are trenches through all of them, so every stroke shows the whole
// history in its far wall and stands on a pale floor of bedrock.
// The section is read with lib/stack: the ground is sliced along height into thin sheets that share one hole (the
// letters), and the sheets are stacked bottom first, each shifted by its depth along the view direction (sprite
// stacking, the height axis read by stacking). The walls are nothing but the edges of the sheets.
// Each stratum's colour comes from palettes measured off reference photographs by the study plates' palette method
// (tools/wordmark-plates.mjs writes strata-plates.mjs); lightness alternates per stratum so neighbours separate.
// In motion the view sways a little east and west, so the walls swing like a section seen while walking past.
import { layer, frame, over } from '../stack/frame.mjs';
import { shiftLayer } from '../stack/stack.mjs';
import { fbm, grain, smooth } from '../../../name-art/lib/img.mjs';
import { setWord, contributors, hashUnit } from './word.mjs';
import { boxFor } from './looks.mjs';

import { hexLin, linOklab, oklabLin } from './palette.mjs';
import { PLATES } from './strata-plates.mjs';

export const meta = {
  id: 'strata', n: 3, title: 'Shared ground (strata)',
  technique: ['lib/stack (height slices composited bottom first: sprite stacking)', 'lib/study palette method on four CC0 references (tools/wordmark-plates.mjs)'],
  loop: { seconds: 4, fps: 24 }, still: 0, reduced: 0,
};

const SWATCHES = PLATES.flatMap(p => p.swatches.map(s => ({ ...s, ref: p.id })));
const clampL = c => c.map(v => Math.min(1, Math.max(0, v)));

// The strata, newest first: colour from a measured swatch picked by the contribution's hash (weighted by share),
// lightness pushed light or dark alternately, chroma lifted a little; thickness share from the hash.
export function strataOf(seed, n = 22) {
  const hashes = contributors(`${seed}/strata`, n), total = SWATCHES.reduce((s, w) => s + w.share, 0);
  return hashes.map((hx, k) => {
    let u = hashUnit(hx, 0) * total, sw = SWATCHES[0];
    for (const s of SWATCHES) { if (u < s.share) { sw = s; break; } u -= s.share; }
    const [L, a, b] = linOklab(hexLin(sw.hex)), lift = (k % 2 ? 0.1 : -0.06) + 0.12 * (hashUnit(hx, 1) - 0.5);
    return { contributor: hx, ref: sw.ref, swatch: sw.hex, rgb: clampL(oklabLin(Math.min(0.9, Math.max(0.2, L + lift)), a * 1.35, b * 1.35)), thick: 0.5 + hashUnit(hx, 2) };
  });
}

// One sheet of ground at depth z: full coverage outside the letters (the letters are the hole through every sheet).
function sheet(mask, w, h, rgb, tex, dark) {
  const L = layer(w, h);
  for (let i = 0; i < w * h; i++) {
    const a = 1 - mask[i]; if (a <= 0) continue;
    const k = dark * (0.9 + 0.2 * tex[i]);
    L.a[i] = a; for (let c = 0; c < 3; c++) L.px[3 * i + c] = rgb[c] * k * a;
  }
  return L;
}

/**
 * section(mask, w, h, opts) -> frame. Slices at `pitch` px through `depth` px of ground, bottom (the floor) first.
 *   strata  from strataOf; thickness shares scale to the depth
 *   view    [vx, vy] image offset per px of depth (the sway)
 *   top     surface colour, floor colour, sdf (optional: the floor darkens near the walls), seed
 */
export function section(mask, w, h, { strata, depth, view = [0.28, 1], pitch = 3, top, floor, sdf = null, seed = 's' }) {
  const tex = new Float32Array(w * h), sc = 90 / Math.max(w, 1) * (w > 400 ? 1 : 6);
  for (let i = 0; i < w * h; i++) tex[i] = fbm((i % w) * sc * 0.25, ((i / w) | 0) * sc, 7, 4);
  const F = frame(w, h, [0, 0, 0]), fl = layer(w, h), dmax = depth * view[1];
  for (let i = 0; i < w * h; i++) {
    const ao = sdf ? 0.55 + 0.45 * smooth(0, 0.6 * depth, -sdf[i]) : 1;
    fl.a[i] = 1; for (let c = 0; c < 3; c++) fl.px[3 * i + c] = floor[c] * ao * (0.94 + 0.12 * tex[i]);
  }
  over(F, shiftLayer(fl, depth * view[0], dmax));
  const cum = []; let acc = 0; const tot = strata.reduce((s, q) => s + q.thick, 0);
  for (const q of strata) { cum.push(acc); acc += q.thick / tot * depth; }
  for (let z = Math.floor(depth / pitch) * pitch; z >= pitch; z -= pitch) {
    let k = strata.length - 1; while (k > 0 && cum[k] > z) k--;
    const lam = 0.94 + 0.06 * Math.sin(z * 2.1 + k);   // laminae inside a stratum
    over(F, shiftLayer(sheet(mask, w, h, strata[k].rgb, tex, (1 - 0.32 * z / depth) * lam), z * view[0], z * view[1]));
  }
  over(F, sheet(mask, w, h, top, tex, 1));
  return F;
}

export const swayOf = t => [0.28 * Math.cos(2 * Math.PI * t), 1];
export const SURFACE = { top: oklabLin(0.24, 0.01, 0.02), floor: oklabLin(0.9, 0.0, 0.015) };

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const N = setWord(W, H, { box: boxFor(look, [0.07, 0.24, 0.93, 0.7]), weight: 900, tracking: 60 });
  const strata = strataOf(seed), depth = 0.3 * N.capPx;
  const F = section(N.mask, W, H, { strata, depth, view: swayOf(t), pitch: Math.max(1, Math.round(W / 1280)), top: SURFACE.top, floor: SURFACE.floor, sdf: N.sdf, seed });
  return { image: raw ? F : grain(F, { amount: 1.5, seed: `${seed}/strata/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text, spoken: N.spoken, data: { strata: strata.map(s => ({ contributor: s.contributor.slice(0, 12), ref: s.ref, swatch: s.swatch })) } };
}

export function icon(G, { seed = 'cmmns-wordmark/1' } = {}) {
  const depth = G.h <= 16 ? 1 : Math.max(2, Math.round(G.h * 0.07)), strata = strataOf(seed, 22);
  return section(G.mask, G.w, G.h, { strata, depth, view: [0.28, 1], pitch: 1, top: SURFACE.top, floor: SURFACE.floor, seed });
}
