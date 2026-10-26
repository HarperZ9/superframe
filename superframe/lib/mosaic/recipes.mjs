// lib/mosaic/recipes.mjs: the site's mark recipes on one law family, so the site can call them (HarperZ9.github.io
// DESIGN-RULES.md, the ordered-dither, ASCII and poster-dither fields; docs/design/inspiration-families-2026-07-09.md,
// the riso, duotone, fax-noise, glyph-stamp, hue-poster and xerox tile recipes). Read from the site repository's
// origin/main; rebuilt here on lib/mosaic, with no code taken from it.
// Every recipe takes a tone field (Float32Array W*H, 0 dark to 1 light) and returns linear RGB (Float32Array W*H*3).
//   orderedField(tone, W, H, { n, inks: [dark, light] })
//   asciiRecipe(tone, W, H, { cw, ch, ramp, atlas, inks })             glyphs chosen by measured coverage
//   posterDither(tone, W, H, { palette, n })                          ordered dither between adjacent palette steps
//   riso(tone, W, H, { ink, ground, cell, speckle, seed })            one ink, coarse ordered dither, eroded edges
//   duotone(tone, W, H, { inks: [a, b, c?], bands, n, speckle })      banded gradient map, dither eats the seams
//   faxNoise(rgb, W, H, { rects, ink, seed })                         ordered-dithered noise in 2 or 3 small rects
//   glyphStamp(rgb, W, H, { count, chars, atlas, ink, seed })         20 to 40 tiny glyph stamps
//   huePoster(tone, W, H, { lut, n })                                 5 to 7 luminance bands, dithered boundaries
//   xeroxTiles(tone, W, H, { count, inks, seed })                     re-dithered rects, some inverted, misregistered
import { bayerMask, thresholdMask, ordered } from './marks.mjs';
import { asciiField, drawField } from './glyphs.mjs';

export const lin = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
const rgbOf = (W, H) => new Float32Array(W * H * 3);
const put = (o, i, c) => { o[3 * i] = c[0]; o[3 * i + 1] = c[1]; o[3 * i + 2] = c[2]; };
function rng(seed) { let s = [...String(seed)].reduce((a, c) => Math.imul(a ^ c.charCodeAt(0), 16777619), 2166136261) >>> 0 || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const inkOf = tone => Float32Array.from(tone, v => 1 - v);

export function orderedField(tone, W, H, { n = 8, inks = ['#141414', '#ebe5d8'] } = {}) {
  const m = ordered(inkOf(tone), W, H, { n }), A = lin(inks[0]), B = lin(inks[1]), o = rgbOf(W, H);
  for (let i = 0; i < W * H; i++) put(o, i, m[i] ? A : B);
  return o;
}

export function asciiRecipe(tone, W, H, { cw = 10, ch = 16, ramp, atlas, inks = ['#141414', '#ebe5d8'] } = {}) {
  const f = asciiField(inkOf(tone), W, H, { cw, ch, ramp }), cov = drawField(f, W, H, atlas), A = lin(inks[0]), B = lin(inks[1]), o = rgbOf(W, H);
  for (let i = 0; i < W * H; i++) { const a = cov[i]; put(o, i, [B[0] + (A[0] - B[0]) * a, B[1] + (A[1] - B[1]) * a, B[2] + (A[2] - B[2]) * a]); }
  return { rgb: o, text: f.lines };
}

// palette ordered dark to light; between two neighbouring steps the Bayer threshold picks one
export function posterDither(tone, W, H, { palette = ['#141414', '#3f5f8a', '#b8893a', '#ebe5d8'], n = 4, ox = 0, oy = 0 } = {}) {
  const P = palette.map(lin), L = P.length - 1, { mask } = bayerMask(n), o = rgbOf(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, v = Math.min(0.99999, Math.max(0, tone[i])) * L, k = Math.floor(v), t = mask[((y + oy) % n) * n + ((x + ox) % n)];
    put(o, i, P[v - k > t ? k + 1 : k]);
  }
  return o;
}

export function riso(tone, W, H, { ink = '#e87018', ground = '#5058c8', cell = 3, n = 4, speckle = 0.08, seed = 'riso' } = {}) {
  const w = Math.ceil(W / cell), h = Math.ceil(H / cell), small = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) small[y * w + x] = 1 - tone[Math.min(H - 1, y * cell) * W + Math.min(W - 1, x * cell)];
  const m = ordered(small, w, h, { n }), A = lin(ink), G = lin(ground), r = rng(seed), o = rgbOf(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const on = m[Math.floor(y / cell) * w + Math.floor(x / cell)] && r() > speckle;   // chalky erosion of the ink
    put(o, y * W + x, on ? A : G);   // riso ink is near opaque over its flat ground
  }
  return o;
}

export function duotone(tone, W, H, { inks = ['#5b2fd6', '#b6ff2e'], bands = 4, n = 4, speckle = 0.015, seed = 'duo' } = {}) {
  const P = inks.map(lin), ramp = Array.from({ length: bands }, (_, b) => { const t = b / (bands - 1), s = t * (P.length - 1), k = Math.min(P.length - 2, Math.floor(s)), f = s - k; return P[k].map((v, c) => v + (P[k + 1][c] - v) * f); });
  const o = posterDither(tone, W, H, { palette: ramp.map(c => '#' + c.map(v => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)).toString(16).padStart(2, '0')).join('')), n });
  const r = rng(seed); for (let i = 0; i < W * H; i++) if (r() < speckle) { const c = r() < 0.5 ? P[0] : P.at(-1); put(o, i, c); }
  return o;
}

export function faxNoise(rgb, W, H, { rects = 3, ink = '#141414', n = 4, seed = 'fax' } = {}) {
  const r = rng(seed), A = lin(ink), o = Float32Array.from(rgb);
  for (let k = 0; k < rects; k++) {
    const w = Math.round(W * (0.06 + 0.1 * r())), h = Math.round(H * (0.03 + 0.06 * r())), x0 = Math.floor(r() * (W - w)), y0 = Math.floor(r() * (H - h)), noise = new Float32Array(w * h);
    for (let i = 0; i < w * h; i++) noise[i] = r();
    const m = ordered(noise, w, h, { n });
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) put(o, (y0 + y) * W + x0 + x, A);
  }
  return o;
}

export function glyphStamp(rgb, W, H, { count = 30, chars = '0123456789+*#<>', atlas, ink = '#ebe5d8', seed = 'stamp' } = {}) {
  if (!atlas) throw new Error('glyphStamp: needs a glyph atlas (atlas(chars, cw, ch))');
  const r = rng(seed), A = lin(ink), o = Float32Array.from(rgb), { cw, ch } = atlas;
  for (let k = 0; k < count; k++) {
    const g = atlas.masks.get(chars[Math.floor(r() * chars.length)]); if (!g) continue;
    const x0 = Math.floor(r() * (W - cw)), y0 = Math.floor(r() * (H - ch));
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const a = g[y * cw + x]; if (!a) continue; const i = (y0 + y) * W + x0 + x; for (let c = 0; c < 3; c++) o[3 * i + c] += (A[c] - o[3 * i + c]) * a; }
  }
  return o;
}

export const ACID = Object.freeze(['#1c1440', '#5b2fd6', '#1c50d8', '#2e8f8a', '#7dffc4', '#d6e33b', '#ff8a00']);
export const huePoster = (tone, W, H, { lut = ACID, n = 4 } = {}) => posterDither(tone, W, H, { palette: lut, n });

export function xeroxTiles(tone, W, H, { count = 60, inks = ['#141414', '#ece8dc'], seed = 'xerox' } = {}) {
  const r = rng(seed), A = lin(inks[0]), B = lin(inks[1]), o = orderedField(tone, W, H, { n: 8, inks });
  for (let k = 0; k < count; k++) {
    const w = Math.round(W * (0.04 + 0.12 * r())), h = Math.round(H * (0.04 + 0.12 * r())), x0 = Math.floor(r() * (W - w)), y0 = Math.floor(r() * (H - h));
    const n = [2, 4, 8][Math.floor(r() * 3)], bias = (r() - 0.5) * 0.3, inv = r() < 0.25, dx = Math.round((r() - 0.5) * 6), dy = Math.round((r() - 0.5) * 6), ink = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.min(W - 1, Math.max(0, x0 + x + dx)), sy = Math.min(H - 1, Math.max(0, y0 + y + dy)); ink[y * w + x] = Math.min(1, Math.max(0, 1 - tone[sy * W + sx] + bias)); }
    const m = thresholdMask(ink, w, h, bayerMask(n));
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) put(o, (y0 + y) * W + x0 + x, (m[y * w + x] ^ inv) ? A : B);
  }
  return o;
}

export const RECIPES = Object.freeze({ ordered: orderedField, poster: posterDither, riso, duotone, hue: huePoster, xerox: xeroxTiles });
