// controls.mjs: two checks that run with every colour study, so a reader can see the measures respond the way a
// correct instrument should. Shuffle: the subject's pixels in a seeded random order; the palette and its shares
// must not move (they ignore arrangement) while composition coherence must fall. Grey: a uniform grey at the
// subject's mean lightness; it must give one swatch and a balance distance of 0 on both light scales.
import { rngFrom } from '../seed.mjs';
import { palette } from './palette.mjs';
import { composition } from './measures.mjs';
import { balance, SCALES } from './extension.mjs';
import { labToRgb8 } from './cmath.mjs';

export function shuffled(S, seed = 'study/shuffle') {
  const n = S.w * S.h, idx = new Uint32Array(n), rng = rngFrom(seed), out = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)), t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  for (let i = 0; i < n; i++) out.set(S.rgba.subarray(4 * idx[i], 4 * idx[i] + 4), 4 * i);
  return { ...S, rgba: out };
}

export function uniform(rgb, w = 64, h = 64) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) rgba.set([rgb[0], rgb[1], rgb[2], 255], 4 * i);
  return { w, h, rgba };
}

export function runControls(S, measured, opts) {
  const sh = shuffled(S), P = palette(sh, opts), C = P.swatches.length ? composition(sh, P.binToSwatch, P.swatches.length) : { coherence: 1 };
  const a = measured.palette.swatches, dShare = Math.max(0, ...a.map((s, i) => Math.abs(s.share - (P.swatches[i]?.share ?? 0))));
  const sameHex = a.length === P.swatches.length && a.every((s, i) => s.hex === P.swatches[i].hex);
  const grey = labToRgb8([measured.value.mean_L, 0, 0]).rgb, G = palette(uniform(grey), opts);
  const gd = Object.fromEntries(Object.keys(SCALES).map(id => [id, balance(G.swatches, id).distance]));
  return {
    method: 'shuffle: the same pixels in a seeded random order (Fisher-Yates, seed "study/shuffle"), measured with the same palette settings; grey: a 64 x 64 uniform grey at the subject\'s mean L*',
    shuffle: { swatches: P.swatches.map(s => ({ hex: s.hex, share: s.share })), max_share_change: dShare, same_hexes: sameHex, coherence: C.coherence, coherence_original: measured.composition.coherence, holds: sameHex && dShare < 1e-12 && C.coherence <= measured.composition.coherence },
    grey: { hex: '#' + grey.map(v => v.toString(16).padStart(2, '0')).join(''), swatches: G.swatches.length, distance: gd, holds: G.swatches.length === 1 && Object.values(gd).every(v => v === 0) },
  };
}
