// codebook.mjs: the colours a quantizer may emit. Two shapes:
//   channels: an independent set of 8-bit levels per channel (bit depths, posterize levels); the product is the set.
//   list:     an explicit palette of 8-bit colours (Game Boy greens, 1-bit, two-ink). `ramp: true` marks a palette
//             ordered along one tone axis, which ordered dither can bracket.
// Every codebook carries its colours both as 8-bit codes and as linear light, because dither mixes in linear light.
import { lin8, parseHex, rgb8ToLab } from '../study/cmath.mjs';

const uniq = a => [...new Set(a)].sort((x, y) => x - y);

// n evenly spaced sRGB codes per channel, the way posterize spaces them.
export const levelCodes = n => uniq(Array.from({ length: n }, (_, i) => Math.round((i * 255) / (n - 1))));

// A bit depth per channel: codes are the 8-bit expansion by bit replication, as display hardware does it.
export function replicate(v, b) { let x = 0, n = 0; while (n < 8) { x = (x << b) | v; n += b; } return x >> (n - 8); }
export const bitCodes = b => uniq(Array.from({ length: 2 ** b }, (_, v) => replicate(v, b)));

export function channels(codes, label) {
  const code = codes.map(c => c.slice());
  return { kind: 'channels', label, code, lin: code.map(c => c.map(lin8)) };
}
export const levels = (n, label = `${n} levels per channel`) => channels([n, n, n].map(levelCodes), label);
export const bits = ([r, g, b], label = `RGB${r}${g}${b}`) => channels([r, g, b].map(bitCodes), label);

export function list(hexes, { label, ramp = false } = {}) {
  const code = hexes.map(h => (typeof h === 'string' ? parseHex(h) : h));
  const linv = code.map(c => c.map(lin8)), Y = linv.map(([r, g, b]) => 0.2126729 * r + 0.7151522 * g + 0.0721750 * b);
  const order = ramp ? Y.map((y, i) => [y, i]).sort((a, b) => a[0] - b[0]).map(p => p[1]) : null;
  return { kind: 'list', label, code, lin: linv, lab: code.map(c => rgb8ToLab(...c)), Y, ramp, order };
}

// Nearest codebook entry. Channel codebooks: per channel, nearest 8-bit code (posterize). Lists: nearest in CIELAB
// (CIE76), the fair perceptual choice for a palette. Returns the index triple (channels) or the palette index.
export function nearestCode(cb, r8, g8, b8) {
  if (cb.kind === 'channels') return [r8, g8, b8].map((v, c) => { const L = cb.code[c]; let k = 0; for (let i = 1; i < L.length; i++) if (Math.abs(L[i] - v) < Math.abs(L[k] - v)) k = i; return L[k]; });
  const lab = rgb8ToLab(r8, g8, b8); let best = 0, bd = Infinity;
  cb.lab.forEach((q, i) => { const d = (q[0] - lab[0]) ** 2 + (q[1] - lab[1]) ** 2 + (q[2] - lab[2]) ** 2; if (d < bd) { bd = d; best = i; } });
  return cb.code[best];
}

// The control: nearest mapping, no dither. On a channel codebook this is posterize.
export function nearest({ w, h, rgba }, cb) {
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { const c = nearestCode(cb, rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]); out.set([c[0], c[1], c[2], 255], 4 * i); }
  return { w, h, rgba: out };
}

// Does every pixel of an image lie in the codebook?
export function inCodebook({ w, h, rgba }, cb) {
  const set = cb.kind === 'list' ? new Set(cb.code.map(c => c.join())) : null;
  for (let i = 0; i < w * h; i++) {
    const p = [rgba[4 * i], rgba[4 * i + 1], rgba[4 * i + 2]];
    if (set ? !set.has(p.join()) : p.some((v, c) => !cb.code[c].includes(v))) return false;
  }
  return true;
}
