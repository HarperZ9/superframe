// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// word.mjs: the CMMNS word as geometry, and the contributor hashes the directions seed their pieces from.
// CMMNS is written in capitals and spoken "commons". Every render returns TEXT and SPOKEN beside the picture, so the
// real text travels with the art (screen readers, search, alt text).
// The letters are set in Accession through the name-art setter (name-art/lib/name.mjs); this file only
// fixes the word, the box and the defaults the six directions share.
// Contributor hashes here are synthetic stand-ins drawn from the recipe seed (xmur3-mulberry32/1). They are not
// real contributors; a production mark would take real entry hashes from the record in their place.
import { setName } from '../../../name-art/lib/name.mjs';
import { rngFrom } from '../seed.mjs';

export const TEXT = 'CMMNS';
export const SPOKEN = 'commons';

/**
 * setWord(W, H, opts) -> the setName result for CMMNS, with text and spoken label attached.
 *   box share of the frame, weight 300..900, cut (e.g. 'stencil'), tracking in em units, sdf on by default.
 *   spaced: the word as typed with spaces in the gaps (the letters stay CMMNS; only the layout opens).
 */
export function setWord(W, H, { box = [0.07, 0.3, 0.93, 0.7], weight = 900, cut, tracking = 40, sdf = true, spaced = null, style = 'display' } = {}) {
  const N = setName(spaced ?? TEXT, W, H, { box, weight, cut, tracking, sdf, style });
  return { ...N, text: TEXT, spoken: SPOKEN };
}

// n contributor hashes, 64 hex characters each, from the recipe seed.
export function contributors(seed, n) {
  const out = [];
  for (let k = 0; k < n; k++) {
    const r = rngFrom(`${seed}/contributor/${k}`);
    let h = '';
    for (let j = 0; j < 8; j++) h += Math.floor(r() * 4294967296).toString(16).padStart(8, '0');
    out.push(h);
  }
  return out;
}

// The i-th 32-bit word of a hex hash as a unit number in [0, 1).
export const hashUnit = (hex, i) => parseInt(hex.slice((8 * i) % 64, (8 * i) % 64 + 8), 16) / 4294967296;

// Box of the inked letters (coverage above 0.5) in px: [x0, y0, x1, y1].
export function inkBox(mask, w, h) {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (mask[y * w + x] > 0.5) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return [x0, y0, x1, y1];
}
