// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// apertures.mjs: direction 2, the missing O's as apertures. CMMNS drops the two O's of COMMONS; here they return
// as two discs of daylight in the gaps between C and M and between N and S, the aperture form from the inspiration
// canon. The letters are clear glass rods (the name-art crystal: Snell, Fresnel, caustics) lying on a dark ground,
// so the light from the two apertures is what the glass carries. Each aperture is drawn as the monogram-orb draws
// its disc: rings at r_k = R sqrt(k / n), tightening toward the rim like Newton's rings, a warm core and a firm rim.
// In motion both apertures breathe on one shared clock; the reduced-motion still holds them fully open.
import { strokesOf, snapJoins, fusedDistance, gradientOf } from '../../../name-art/lib/strokes.mjs';
import { render as crystal } from '../../../name-art/lib/crystal.mjs';
import { img, clamp, smooth, mix, grain, bloom, TAU } from '../../../name-art/lib/img.mjs';
import { setWord } from './word.mjs';
import { oklch } from './palette.mjs';
import { boxFor } from './looks.mjs';

export const meta = {
  id: 'apertures', n: 2, title: 'The missing O’s as apertures',
  technique: ['name-art concepts 13 monogram-orb (the aperture disc) and 31 crystal-rods / 14 glass-tubes (the rods)', 'name-art/lib/crystal.mjs (refraction, caustics)'],
  loop: { seconds: 4, fps: 24 }, still: 0, reduced: 0, crop: [0.22, 0.5],
};

// Daylight, kept clear of the drift verdict's orange: a near-white core, amber, and a violet-grey rim.
export const LIGHT = { ground: oklch(0.12, 0.012, 300), core: oklch(0.98, 0.03, 95), mid: oklch(0.8, 0.13, 78), rim: oklch(0.34, 0.05, 320), line: oklch(0.95, 0.02, 95) };
// Bold: the left aperture burns magenta-violet, the right one amber; the light is scene-referred (cores well past 1).
export const LIGHT_B = { ...LIGHT, ground: oklch(0.1, 0.03, 290), core: oklch(0.95, 0.12, 340), mid: oklch(0.66, 0.24, 330), rim: oklch(0.3, 0.12, 280), line: oklch(0.93, 0.05, 340) };
const palettes = look => (look === 'bold' ? [LIGHT_B, LIGHT] : [LIGHT, LIGHT]);
const gainOf = look => (look === 'bold' ? 2.4 : 1.7);

// Openness on the shared clock: 1 at t = 0 (the still), down to 0 at the half loop.
export const openness = t => 0.5 + 0.5 * Math.cos(TAU * t);

// Centres of the two missing O's from the letter spans: the gap C|M and the gap N|S, on the cap-height midline.
export function apertureCentres(N) {
  const s = N.spans, mid = (s[0].top + s[0].base) / 2;
  return [[(s[0].x1 + s[1].x0) / 2, mid], [(s[3].x1 + s[4].x0) / 2, mid]];
}

function discAt(I, cx, cy, R, o, u, P = LIGHT, gain = 1) {
  const { w, h } = I, reach = R * 7, n = 40;
  const x0 = Math.max(0, Math.floor(cx - reach)), x1 = Math.min(w - 1, Math.ceil(cx + reach)), y0 = Math.max(0, Math.floor(cy - reach)), y1 = Math.min(h - 1, Math.ceil(cy + reach));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = y * w + x, r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy), q = r / R;
    const spill = 0.22 * o * Math.exp(-Math.max(0, q - 1) / 0.45) * smooth(7, 5, q);
    let c = [0, 1, 2].map(k => I.px[i * 3 + k] + P.mid[k] * spill);
    if (q < 1.02) {
      const k = Math.round(q * q * n), dist = Math.abs(q - Math.sqrt(k / n)) * R, cov = clamp(0.5 * Math.max(0.7 * u, 0.9 * u * (1 - q)) + 0.5 - dist) * (k > 0 ? 1 : 0);
      const tone = P.core.map((v, j) => mix(mix(v * (0.6 + 0.8 * o), P.mid[j] * (0.5 + 0.6 * o), smooth(0.05, 0.8, q)), P.rim[j], smooth(0.8, 1, q)));
      const disc = smooth(1.0, 0.995, q);
      c = c.map((v, j) => mix(v, gain * tone[j] * (1 - 0.55 * cov), disc));
      const rr = clamp(1.2 * u - Math.abs(r - R) + 0.5); c = c.map((v, j) => mix(v, P.line[j] * (0.5 + 0.4 * o), rr));
    }
    I.px.set(c, i * 3);
  }
}

// The dark ground the glass lies on, with the two apertures painted into it as light.
export function ground(W, H, N, t, look = 'corrected') {
  const I = img(W, H), u = W / 1280, o = openness(t), R = N.capPx * (0.3 + 0.08 * o);
  const gr = look === 'bold' ? LIGHT_B.ground : LIGHT.ground;
  for (let i = 0; i < W * H; i++) I.px.set(gr, i * 3);
  const pal = palettes(look);
  for (const [k, [cx, cy]] of apertureCentres(N).entries()) discAt(I, cx, cy, R, o, u, pal[k], gainOf(look));
  return { I, R };
}

// Glass rods along the letter centre lines, fused at joins, with lathe grooves (as in crystal-rods).
export function rodsOf(W, H, N) {
  const cap = N.capPx, r = 0.1 * cap, S = snapJoins(strokesOf(N, Math.max(1, cap / 150)), 1.25 * r);
  const D = fusedDistance(W, H, S, r + 2, r / 3), { gx, gy } = gradientOf(D, W, H);
  const top = new Float32Array(W * H), bot = new Float32Array(W * H), mask = new Float32Array(W * H), rough = new Float32Array(W * H), L = [-0.7, -0.71], steps = 14;
  for (let i = 0; i < W * H; i++) {
    const d = D[i]; if (!(d < r + 1)) continue;
    mask[i] = clamp(r - d + 0.5);
    const q = Math.min(0.999, d / r), z = r * Math.sqrt(1 - q * q); top[i] = r + z; bot[i] = r - z;
    const g = Math.hypot(gx[i], gy[i]) || 1, side = (gx[i] / g) * L[0] + (gy[i] / g) * L[1], phi = Math.asin(q);
    // groove frequency in cycles per px grows without bound toward the rim (d phi / dq = 1 / sqrt(1 - q^2)); fade the
    // grooves out where it passes a quarter cycle per px, so they stop aliasing into stair-stepped streaks
    const freq = steps / (Math.PI * r * Math.sqrt(Math.max(1e-4, 1 - q * q))), fade = clamp(1.6 - 2.4 * freq);
    const sh = clamp(0.55 + 0.75 * q * side), ph = phi / Math.PI * steps, f = Math.abs((ph % 1) - 0.5), wd = 0.08 + 0.3 * (1 - sh), v = fade * (f < wd ? 0.5 + 0.5 * Math.cos(Math.PI * f / wd) : 0);
    top[i] -= v * r * 0.025 * Math.cos(phi); rough[i] = v * 0.12;
  }
  return { top, bot, mask, rough, r, D, gx, gy };
}

// The apertures light the glass: each rod catches a diffuse glow and a specular line on the side that faces a disc,
// falling off with distance (an area light at the paper plane, half a radius up).
export function glassGlow(I, N, G, t, look = 'corrected') {
  const { w, h } = I, o = openness(t), R = N.capPx * (0.3 + 0.08 * o), C = apertureCentres(N);
  for (let i = 0; i < w * h; i++) {
    const m = G.mask[i]; if (m <= 0) continue;
    const x = i % w + 0.5, y = (i / w | 0) + 0.5, q = Math.min(0.999, G.D[i] / G.r), g = Math.hypot(G.gx[i], G.gy[i]) || 1;
    const n = [G.gx[i] / g * q, G.gy[i] / g * q, Math.sqrt(1 - q * q)];
    // each aperture lights the glass in its own colour, so the hues cross-fade along the word by distance
    const P = palettes(look), acc = [0, 0, 0];
    for (const [j, [cx, cy]] of C.entries()) {
      const lx = cx - x, ly = cy - y, lz = 0.5 * R, d = Math.hypot(lx, ly, lz), l = [lx / d, ly / d, lz / d];
      const fall = 1 / (1 + (d / (2.2 * R)) ** 2), ndl = Math.max(0, n[0] * l[0] + n[1] * l[1] + n[2] * l[2]);
      const hv = [l[0], l[1], l[2] + 1], hl = Math.hypot(...hv), ndh = Math.max(0, (n[0] * hv[0] + n[1] * hv[1] + n[2] * hv[2]) / hl);
      const sp = Math.pow(ndh, 60) * fall;
      for (let k = 0; k < 3; k++) acc[k] += 0.55 * ndl * fall * P[j].mid[k] + 2.2 * sp * P[j].core[k];
    }
    for (let k = 0; k < 3; k++) I.px[i * 3 + k] += m * o * gainOf(look) * acc[k];
  }
  return I;
}

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const N = setWord(W, H, { spaced: 'C  MMN  S', box: boxFor(look, [0.05, 0.24, 0.95, 0.76]), weight: 500, tracking: 40, sdf: false });
  const { I: paper } = ground(W, H, N, t, look), G = rodsOf(W, H, N), u = W / 1280;
  const image = glassGlow(crystal(paper, G, { sun: { az: 40, el: 30, power: 1.1 }, ambient: 0.9, tint: '#f1f4f6', room: '#f4ecdc', ceiling: '#2c2a33', maxThick: Math.ceil(2 * G.r) }), N, G, t, look);
  // scatter: a wide, soft multi-scale spread (energy-conserving); bold lets more of the light go, with a longer tail
  if (look === 'bold') bloom(image, { threshold: 0.5, radius: 110 * u, strength: 0.55, tail: 0.8, tint: [1, 0.92, 0.95] });
  else bloom(image, { threshold: 0.8, radius: 48 * u, strength: 0.32, tail: 0.7, tint: [1, 0.9, 0.75] });
  return { image: raw ? image : grain(image, { amount: 1.3, seed: `${seed}/apertures/grain`, radius: Math.max(1, Math.round(u)) }), text: N.text, spoken: N.spoken, data: { openness: openness(t), centres: apertureCentres(N).map(c => c.map(v => +v.toFixed(1))) } };
}

// Icon: pale glass letters on the dark ground, with the two apertures as warm light centred on the C|M and N|S gaps,
// behind the glass (at 16 px the gaps are one pixel wide, so the light shows as a glow the letters stand in).
export function icon(G) {
  const { w, h, mask, letter } = G, I = img(w, h), box = [0, 1, 2, 3, 4].map(() => [w, h, 0, 0]);
  for (let i = 0; i < w * h; i++) { const k = letter[i]; if (k < 0) continue; const x = i % w, y = (i / w) | 0, b = box[k]; b[0] = Math.min(b[0], x); b[1] = Math.min(b[1], y); b[2] = Math.max(b[2], x + 1); b[3] = Math.max(b[3], y + 1); }
  const mid = (a, b) => [(box[a][2] + box[b][0]) / 2, (Math.min(box[a][1], box[b][1]) + Math.max(box[a][3], box[b][3])) / 2];
  const small = h <= 16, C = [mid(0, 1), mid(3, 4)], R = Math.max(1.2, (small ? 0.3 : 0.42) * (box[0][3] - box[0][1])), glass = oklch(0.9, 0.025, 230), gain = small ? 0.6 : 0.85;
  for (let i = 0; i < w * h; i++) {
    const x = i % w + 0.5, y = (i / w | 0) + 0.5;
    let light = 0; for (const [cx, cy] of C) { const q = Math.hypot(x - cx, y - cy) / R; light += q < 1 ? 1 - 0.5 * q * q : 0.5 * Math.exp(-(q - 1) / 0.6); }
    light = Math.min(1, light);
    const g = LIGHT.ground.map((v, k) => v + (mix(LIGHT.mid[k], LIGHT.core[k], light * light) - v) * light * gain);
    // at 16 px a one-pixel shadow keeps the glass letters apart from the glow behind them
    const xi = i % w, yi = (i / w) | 0, edge = small && mask[i] < 0.5 && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => mask[(yi + b) * w + xi + a] > 0.5 && xi + a >= 0 && xi + a < w && yi + b >= 0 && yi + b < h);
    for (let k = 0; k < 3; k++) I.px[i * 3 + k] = (edge ? LIGHT.ground[k] : g[k]) * (1 - mask[i]) + glass[k] * mask[i];
  }
  return I;
}
