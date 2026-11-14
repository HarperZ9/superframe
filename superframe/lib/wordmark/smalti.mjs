// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// smalti.mjs: direction 1, many hands. Each letter is laid in glass tesserae, and every tessera takes its colour,
// its tilt and its pressing from a different contributor's hash, so no two pieces match. Close up it is a crowd of
// colours; at reading distance the light tiles merge into one pale CMMNS on a dark field, a metamer of a clean mark.
// Tiles are laid by the name-art andamento (courses follow each stroke, the field is opus tessellatum) and lit by its
// tesserae shader; this file only decides what each tile is made of. In motion the light swings and the glass
// flickers tile by tile, as a wall does when you walk past.
import { layTiles } from '../../../name-art/lib/mosaic/andamento.mjs';
import { shade } from '../../../name-art/lib/mosaic/tesserae.mjs';
import { strokesOf } from '../../../name-art/lib/strokes.mjs';
import { img, grain } from '../../../name-art/lib/img.mjs';
import { setWord, contributors, hashUnit } from './word.mjs';
import { oklch, openHue, linHex } from './palette.mjs';
import { nodeSeed } from '../seed.mjs';
import { boxFor } from './looks.mjs';


export const meta = {
  id: 'smalti', n: 1, title: 'Many hands (smalti)',
  technique: ['name-art/lib/mosaic andamento + tesserae (the mosaic-smalti and mosaic-andamento concepts)', 'lib/quantize/eye.mjs S-CIELAB metamer check'],
  loop: { seconds: 4, fps: 24 }, still: 0.18, reduced: 0.18,
};

// What a tile is made of, by zone (0 field, 1 halo course, 2 letter), from its contributor hash.
export function tileColour(zone, hex, look = 'corrected') {
  const u0 = hashUnit(hex, 0), u1 = hashUnit(hex, 1);
  // bold: glass at full chroma in the letters, a coloured (not grey) field, the halo kept dark so the word cuts out
  if (look === 'bold') return zone === 2 ? oklch(0.66 + 0.2 * u0, 0.16 + 0.07 * hashUnit(hex, 4), openHue(u1)) : zone === 1 ? oklch(0.12, 0.02, openHue(u1)) : oklch(0.27 + 0.1 * u0, 0.07 + 0.04 * hashUnit(hex, 4), openHue(u1));
  if (zone === 2) return oklch(0.8 + 0.12 * u0, 0.07 + 0.06 * hashUnit(hex, 4), openHue(u1));
  if (zone === 1) return oklch(0.13 + 0.03 * u0, 0.015, openHue(u1));
  return oklch(0.23 + 0.05 * u0, 0.025 + 0.03 * hashUnit(hex, 4), openHue(u1));
}

const ZONES = { field: { material: 'smalti', tilt: 0.12, dome: 0.14, gloss: 0.32 }, halo: { material: 'smalti', tilt: 0.1, dome: 0.14, gloss: 0.2 }, letter: { material: 'smalti', tilt: 0.2, dome: 0.12, gloss: 0.5 } };

// Give every tile its own contributor: colour per zone, tilt angle (h1) and tilt amount (h2) from the hash.
function assign(layout, hashes, look) {
  const n = layout.tiles.length, cols = [[], [], []];
  layout.tiles.forEach((t, k) => {
    const hx = hashes[k];
    for (let z = 0; z < 3; z++) cols[z].push(z === t.zone ? tileColour(z, hx, look) : [0, 0, 0]);
    t.h1 = hashUnit(hx, 2); t.h2 = hashUnit(hx, 3); t.h3 = (k + 0.5) / n; t.contributor = hx;
  });
  return cols;
}

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const N = setWord(W, H, { box: boxFor(look, [0.075, 0.26, 0.925, 0.74]), weight: 900, tracking: 46 });
  const T = Math.max(3, 0.056 * N.capPx), strokes = strokesOf(N, Math.max(1, T / 6));
  const layout = layTiles(W, H, { sdf: N.sdf, strokes, tile: T, halo: 1, ratio: 1.12, grout: Math.max(0.8, 0.1 * T), fieldScale: 1.1, seed: nodeSeed(seed, 'smalti/tiles').seedInt });
  const hashes = contributors(`${seed}/smalti`, layout.tiles.length), cols = assign(layout, hashes, look);
  const zones = [ZONES.field, ZONES.halo, ZONES.letter].map((z, k) => ({ ...z, colours: cols[k].map(linHex) }));
  const az = -2.3 + 0.7 * Math.sin(2 * Math.PI * t), L = look === 'bold' ? [Math.cos(az) * 0.9, Math.sin(az) * 0.9, 0.38] : [Math.cos(az) * 0.75, Math.sin(az) * 0.75, 0.62];
  const image = shade(W, H, layout, { zones, light: L, grout: '#17161a' });
  const counts = [0, 0, 0]; for (const tl of layout.tiles) counts[tl.zone]++;
  return { image: raw ? image : grain(image, { amount: 1.4, seed: `${seed}/smalti/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: N.text, spoken: N.spoken, data: { tiles: layout.tiles.length, field: counts[0], halo: counts[1], letter: counts[2] } };
}

// Icon: at icon size a pixel (or a small cell) is one tessera. Letter cells take light contributor glass, cells that
// touch a letter take the dark outline course, the rest is the dark field.
export function icon(G, { seed = 'cmmns-wordmark/1' } = {}) {
  const { w, h, mask } = G, I = img(w, h), cell = Math.max(1, Math.round(Math.min(w, h) / 40)), hashes = contributors(`${seed}/smalti/icon/${w}x${h}`, Math.ceil(w / cell) * Math.ceil(h / cell));
  const near = i => { const x = i % w, y = (i / w) | 0; for (let j = -1; j <= 1; j++) for (let q = -1; q <= 1; q++) { const X = x + q, Y = y + j; if (X >= 0 && Y >= 0 && X < w && Y < h && mask[Y * w + X] > 0.5) return true; } return false; };
  for (let i = 0; i < w * h; i++) {
    const x = i % w, y = (i / w) | 0, c = ((y / cell) | 0) * Math.ceil(w / cell) + ((x / cell) | 0), hx = hashes[c], m = mask[i];
    const ground = near(i) && m < 0.5 ? tileColour(1, hx) : tileColour(0, hx), ink = tileColour(2, hx);
    const joint = cell >= 3 && (x % cell === 0 || y % cell === 0) ? 0.55 : 1;
    for (let k = 0; k < 3; k++) I.px[i * 3 + k] = (ground[k] * (1 - m) + ink[k] * m) * joint;
  }
  return I;
}
