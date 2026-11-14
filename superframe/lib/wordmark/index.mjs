// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// lib/wordmark: six display directions for the CMMNS wordmark (spoken "commons"), the product formerly called
// Daylight Commons. Each direction is a module with
//   meta    { id, n, title, technique, loop { seconds, fps }, still (loop phase of the hero still), reduced (phase of
//           the reduced-motion still) }
//   render(W, H, { t, seed, settled }) -> { image (linear, lib/img shape), text 'CMMNS', spoken 'commons', data }
//   icon(G, { seed }) -> image, where G is the icon geometry from icon.mjs (square or strip, 16 to 128 px)
// The spec is Part 3 of the Commons rename note in the author's workspace. The author picks; nothing here
// changes an icon or a repository.
import * as smalti from './smalti.mjs';
import * as apertures from './apertures.mjs';
import * as strata from './strata.mjs';
import * as intaglio from './intaglio.mjs';
import * as marbling from './marbling.mjs';
import * as stencil from './stencil.mjs';
import { iconWord, ICON_SIZES } from './icon.mjs';
import { finish, ssFor } from './looks.mjs';
export { TEXT, SPOKEN } from './word.mjs';

export const DIRECTIONS = [smalti, apertures, strata, intaglio, marbling, stencil];
export const SEED = 'cmmns-wordmark/1';
export const byId = id => { const d = DIRECTIONS.find(m => m.meta.id === id || String(m.meta.n) === String(id)); if (!d) throw new Error(`wordmark: no direction ${id}`); return d; };

// mode 'still' (the hero frame), 'reduced' (the settled frame for reduced motion) or 'frame' (loop phase t).
// look 'corrected' (default) or 'bold' (looks.mjs). ss overrides the look's supersampling (1 = none): the direction
// renders raw at ss x the size, is box-filtered down, and only then gets its tone and grain, so grain stays one size.
export async function renderDirection(id, W, H, { mode = 'still', t = 0, seed = SEED, look = 'corrected', ss = null } = {}) {
  const D = byId(id), phase = mode === 'still' ? D.meta.still : mode === 'reduced' ? D.meta.reduced : t, k = ss ?? ssFor(D.meta.id, look);
  const r = mode === 'reduced' && D.renderSettled ? await D.renderSettled(W * k, H * k, { seed, raw: true, look }) : await D.render(W * k, H * k, { t: phase, seed, raw: true, look });
  return { ...r, image: finish(D.meta.id, look, r.image, W, seed, k) };
}

export function renderIcon(id, layout, size, { seed = SEED } = {}) {
  const D = byId(id), G = iconWord(layout, size, id === 'stencil' || id === '6' ? { cut: 'stencil', weight: 800 } : {});
  return { image: D.icon(G, { seed }), w: G.w, h: G.h, text: G.text, spoken: G.spoken };
}
export { ICON_SIZES };
