// Camera and era post (effects queues 5 and 6): operations on a finished frame, the same for the painted frame and the
// glyph frame (each style can also do its own version natively). Depth comes from the plate's geo buffers through the
// light field. All deterministic in (frame, seed, t); flicker and grain honour the accessibility settings.
// Original code.
//   dof(img, F, { focus, range, max })        painterly depth of field for the narrow lens: out-of-focus areas smeared
//                                             along a stroke direction, not blurred round (focus: depth m, range: m)
//   hazeRamp(img, F, { k, col })              the wide lens's air: far samples toward the horizon's colour by fog depth
//   eraPost(img, era, { t, flicker, F })      1 varnish and craquelure; 2 frost-bleached and scraped; 3 print registration
//                                             and dot screen; 4 fluorescent flicker and grain; 5 sodium mono and, with
//                                             { clip: true }, the compression blocks of a filmed clip
const LIN = new Float32Array(256).map((_, i) => { const c = i / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
const enc = (x) => (x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, Math.min(1, x)), 1 / 2.4) - 0.055) * 255;
const hh = (a, b, c = 0) => { let x = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1); x = Math.imul(x ^ (x >>> 15), 0x85ebca6b); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const depthAtPx = (F, W, H) => { const D = new Float32Array(W * H).fill(NaN), sx = F.w / W, sy = F.h / H, B = F.camB; for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = Math.floor(y * sy) * F.w + Math.floor(x * sx), py = F.pos[i * 3 + 1]; if (Number.isFinite(py) && py < 500) D[y * W + x] = (F.pos[i * 3] - B.pos[0]) * B.f[0] + (py - B.pos[1]) * B.f[1] + (F.pos[i * 3 + 2] - B.pos[2]) * B.f[2]; } return D; };
import { camBasis } from "../world/plateworld.mjs";

export function dof(img, F, { focus = null, range = 1.2, max = 6 } = {}) {
  const W = img.width, H = img.height, S = img.data.slice(), D = img.data; F.camB ||= camBasis(F.pj.camera);
  const Z = depthAtPx(F, W, H), f = focus ?? median(Z);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const z = Z[y * W + x], r = Number.isFinite(z) ? Math.min(max, Math.max(0, (Math.abs(z - f) - range) * 5)) : max * 0.6; if (r < 0.75) continue;
    // a smear along a direction that turns slowly over the frame (a brush laid across the soft part), 7 taps
    const a = 6.283 * hh(x >> 5, y >> 5, 7), dx = Math.cos(a), dy = Math.sin(a) * 0.6; let acc = [0, 0, 0], n = 0;
    for (let k = -3; k <= 3; k++) { const X = Math.round(x + dx * r * k / 3), Y = Math.round(y + dy * r * k / 3); if (X < 0 || Y < 0 || X >= W || Y >= H) continue; const q = (Y * W + X) * 4; for (let c = 0; c < 3; c++) acc[c] += LIN[S[q + c]]; n++; }
    const o = (y * W + x) * 4; for (let c = 0; c < 3; c++) D[o + c] = enc(acc[c] / n);
  }
  return img;
}
function median(Z) { const v = []; for (let i = 0; i < Z.length; i += 37) if (Number.isFinite(Z[i])) v.push(Z[i]); v.sort((a, b) => a - b); return v[v.length >> 1] || 0; }
export function hazeRamp(img, F, { k = 1, col = [0.62, 0.66, 0.74] } = {}) {
  const W = img.width, H = img.height, D = img.data, sx = F.w / W, sy = F.h / H;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = Math.floor(y * sy) * F.w + Math.floor(x * sx), f = Math.min(0.7, (F.rec.fog[i] / 255) * k); if (f <= 0.01) continue;
    const o = (y * W + x) * 4; for (let c = 0; c < 3; c++) D[o + c] = enc(LIN[D[o + c]] * (1 - f) + col[c] * f);
  }
  return img;
}
// the per-era looks; each a function of the pixel, its neighbours (from the untouched copy) and the frame's seed
const ERA = {
  1: (c, x, y, S, W) => { const g = [1.0, 0.92, 0.72], crack = hh(Math.floor((x + 3 * Math.sin(y * 0.11)) / 9), Math.floor((y + 3 * Math.sin(x * 0.13)) / 9)) > 0.93 ? 0.82 : 1;   // varnish over a crazed ground
    return c.map((v, k) => (v * g[k] * 0.92 + 0.012 * g[k]) * crack); },
  2: (c, x, y, S, W, t) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], m = c.map((v) => v * 0.6 + l * 0.4), hi = Math.max(0, l - 0.35) * 0.4;   // frost-bleached
    const scrape = hh(x >> 4, y, 3) > 0.996 ? 0.25 : 0;   // a scratch scraped through the paint, short and level
    return m.map((v, k) => v + hi * [0.9, 0.95, 1.05][k] + scrape); },
  3: (c, x, y, S, W) => { const q = (dx, dy, k) => { const X = Math.max(0, Math.min(W - 1, x + dx)), i = (Math.max(0, y + dy) * W + X) * 4 + k; return LIN[S[i] ?? 0]; };   // registration offset
    const r = q(2, -1, 0), g = q(0, 0, 1), b = q(-1, 1, 2), l = 0.2126 * r + 0.7152 * g + 0.0722 * b, dot = Math.hypot((x % 5) - 2, (y % 5) - 2) < 2.6 * Math.sqrt(1 - Math.min(1, l * 1.4)) ? 0.86 : 1;
    return [r * dot * 0.97, g * dot, b * dot * 0.95]; },
  4: (c, x, y, S, W, t, o) => { const fl = o.flicker === "off" ? 1 : 1 - (o.flicker === "reduced" ? 0.02 : 0.07) * (hh(Math.floor(t * 12), 9) > 0.8 ? 1 : 0), grain = o.flicker === "off" ? 0 : (hh(x, y, Math.floor(t * 24)) - 0.5) * 0.05;
    return [c[0] * 0.94 * fl + grain, c[1] * 1.02 * fl + grain, c[2] * 0.97 * fl + grain]; },
  5: (c, x, y, S, W, t, o) => { const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], na = [1.0, 0.56, 0.12], k = o.sodiumK ?? 0.6;   // sodium: colour drained toward one orange
    return c.map((v, i) => v * (1 - k) + l * na[i] * 1.6 * k); },
};
export function eraPost(img, era, { t = 0, flicker = "full", clip = false, sodiumK } = {}) {
  const f = ERA[era]; if (!f) return img; const W = img.width, H = img.height, S = img.data.slice(), D = img.data, o = { flicker, sodiumK };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const q = (y * W + x) * 4, c = f([LIN[S[q]], LIN[S[q + 1]], LIN[S[q + 2]]], x, y, S, W, t, o); for (let k = 0; k < 3; k++) D[q + k] = enc(c[k]); }
  if (era === 5 && clip) clipBlocks(img);
  return img;
}
// a filmed clip, squeezed: 8 x 8 blocks flattened toward their mean where the detail is low, ringing at hard edges
function clipBlocks(img) {
  const W = img.width, H = img.height, D = img.data;
  for (let by = 0; by < H; by += 8) for (let bx = 0; bx < W; bx += 8) {
    const m = [0, 0, 0]; let n = 0, v = 0;
    for (let y = by; y < Math.min(H, by + 8); y++) for (let x = bx; x < Math.min(W, bx + 8); x++) { const q = (y * W + x) * 4; for (let k = 0; k < 3; k++) m[k] += D[q + k]; n++; }
    for (let k = 0; k < 3; k++) m[k] /= n;
    for (let y = by; y < Math.min(H, by + 8); y++) for (let x = bx; x < Math.min(W, bx + 8); x++) { const q = (y * W + x) * 4; v += Math.abs(D[q + 1] - m[1]); }
    const flat = v / n < 14 ? 0.85 : 0.35;
    for (let y = by; y < Math.min(H, by + 8); y++) for (let x = bx; x < Math.min(W, bx + 8); x++) { const q = (y * W + x) * 4; for (let k = 0; k < 3; k++) D[q + k] = Math.round(D[q + k] * (1 - flat) + m[k] * flat); }
  }
}
