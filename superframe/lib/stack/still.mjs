// still.mjs: the living still. One locked frame is held; only its noise is re-rolled, every `hold` frames, so a still
// picture reads as alive (candidate K, from the on-twos clips in intake batch E). It is a time slice of the stack
// whose content axis is frozen and whose noise axis advances.
// Grain is photon shot noise (physics): a cell that should collect s x N photons collects a Poisson count, so its
// variance is s / N. Cell size, the ordered dither and the level count are authored conventions.
import { frame, toDisplay } from './frame.mjs';
import { rngFrom } from '../seed.mjs';

// A Poisson count with mean lam. Exact by inversion up to lam = 100; above that the normal approximation with the
// same mean and variance (its skew is under 0.1 there).
export function poisson(lam, r) {
  if (lam <= 0) return 0;
  if (lam > 100) { let u = 0, v = 0; while (u === 0) u = r(); v = r(); return Math.max(0, Math.round(lam + Math.sqrt(lam) * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v))); }
  let k = 0, p = Math.exp(-lam), c = p; const u = r();
  while (u > c && k < 1000) { k++; p *= lam / k; c += p; }
  return k;
}

// Shot-noise grain on a linear frame: each cell x cell block and channel draws one count from N x its mean signal.
// mono uses one count for all three channels (scaled per channel), like a single silver layer.
export function shotGrain(F, { N = 400, cell = 1, seed = 'grain', mono = false } = {}) {
  const r = rngFrom(seed), out = frame(F.w, F.h);
  for (let by = 0; by < F.h; by += cell) for (let bx = 0; bx < F.w; bx += cell) {
    const mean = [0, 0, 0]; let n = 0;
    for (let y = by; y < Math.min(F.h, by + cell); y++) for (let x = bx; x < Math.min(F.w, bx + cell); x++) { const p = 3 * (y * F.w + x); for (let c = 0; c < 3; c++) mean[c] += F.px[p + c]; n++; }
    const m = mean.map(v => v / n), lum = (m[0] + m[1] + m[2]) / 3, g = mono ? poisson(lum * N, r) / N / (lum || 1) : 0;
    const gain = m.map(v => mono ? g : (v > 0 ? poisson(v * N, r) / N / v : 0));
    for (let y = by; y < Math.min(F.h, by + cell); y++) for (let x = bx; x < Math.min(F.w, bx + cell); x++) { const p = 3 * (y * F.w + x); for (let c = 0; c < 3; c++) out.px[p + c] = F.px[p + c] * gain[c]; }
  }
  return out;
}

// The control for the grain law: signal-independent Gaussian noise of a given standard deviation.
export function flatGrain(F, { sigma = 0.035, seed = 'flat' } = {}) {
  const r = rngFrom(seed), out = frame(F.w, F.h);
  for (let i = 0; i < F.px.length; i++) { let u = 0; while (u === 0) u = r(); out.px[i] = F.px[i] + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }
  return out;
}

const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16);
// Ordered dither to `levels` codes per channel, the threshold matrix shifted by (ox, oy). Returns 8-bit bytes.
export function dither8(F, { levels = 32, ox = 0, oy = 0 } = {}) {
  const b = new Uint8ClampedArray(F.w * F.h * 3), q = levels - 1;
  for (let y = 0; y < F.h; y++) for (let x = 0; x < F.w; x++) {
    const t = BAYER4[((y + oy) & 3) * 4 + ((x + ox) & 3)], p = 3 * (y * F.w + x);
    for (let c = 0; c < 3; c++) b[p + c] = Math.round(Math.min(q, Math.floor(Math.min(1, Math.max(0, F.px[p + c])) * q + t)) / q * 255);
  }
  return { w: F.w, h: F.h, b };
}

// The living still as a frame source: frame n uses noise slot floor(n / hold). grain 0 holds the noise still for
// ever (the frozen control); grain k scales the grain amplitude by k (N / k^2 photons).. movers(F, slot) may draw small moving layers on the linear frame, on the same holds.
export function livingStill(F, { hold = 2, N = 400, cell = 2, levels = 32, seed = 'still', grain = 1, mono = false, movers = null } = {}) {
  const cache = new Map();
  return n => {
    const slot = grain ? Math.floor(n / hold) : 0;
    if (cache.has(slot)) return cache.get(slot);
    let L = F; if (movers) { L = { w: F.w, h: F.h, px: F.px.slice() }; movers(L, slot); }
    const r = rngFrom(`${seed}/${slot}`), G = grain ? shotGrain(L, { N: N / (grain * grain), cell, seed: `${seed}/g/${slot}`, mono }) : L;
    const out = dither8(toDisplay(G), { levels, ox: Math.floor(r() * 4), oy: Math.floor(r() * 4) });
    if (cache.size > 8) cache.delete(cache.keys().next().value);
    cache.set(slot, out); return out;
  };
}

// The module's own counter: the fraction of frames that differ from the one before, times the frame rate.
export function uniqueRate(src, count, fps) {
  let changes = 0, prev = src(0);
  for (let n = 1; n < count; n++) { const cur = src(n); if (cur !== prev && !sameBytes(cur.b, prev.b)) changes++; prev = cur; }
  return changes / (count - 1) * fps;
}
const sameBytes = (a, b) => { if (a.length !== b.length) return false; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false; return true; };

// Fit variance = slope x mean + c over grey patches: the grain law's check.
export function noiseSlope(pairs) {
  const n = pairs.length, mx = pairs.reduce((s, p) => s + p[0], 0) / n, my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0; for (const [x, y] of pairs) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
  return sxy / sxx;
}
