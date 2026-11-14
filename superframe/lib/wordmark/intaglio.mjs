// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// intaglio.mjs: direction 4, the record that cannot be erased. CMMNS is engraved in fine intaglio line, banknote
// style: every letter is a bundle of burin cuts running parallel to its centre line, with no outline, each cut
// swelling where a raking light leaves the stroke's round section in shadow. Each revision adds cuts between the
// cuts already there (a van der Corput order, so each new pair halves the widest remaining gap) and never removes
// one, so the mark thickens over versions as a visible ledger. Every cut's small offset and wobble come from its
// revision's entry hash (lib/seed.mjs nodeSeed), and the ledger is microprinted under the word.
// In motion the custody chain plays as an onion skin (lib/stack onionFrame): the cuts each revision added light in
// the spot ink one revision at a time, with the two before it as fading ghosts. Nothing is ever taken away.
import { strokesOf, fusedDistance, gradientOf } from '../../../name-art/lib/strokes.mjs';
import { setName } from '../../../name-art/lib/name.mjs';
import { clamp, fbm, grain } from '../../../name-art/lib/img.mjs';
import { frame, layer } from '../stack/frame.mjs';
import { onionFrame } from '../stack/echo.mjs';
import { nodeSeed } from '../seed.mjs';
import { boxFor } from './looks.mjs';
import { duotone } from '../look/colour.mjs';
import { setWord, contributors, hashUnit } from './word.mjs';
import { oklch } from './palette.mjs';

export const REVISIONS = 12;
export const meta = {
  id: 'intaglio', n: 4, title: 'The record that cannot be erased (intaglio palimpsest)',
  technique: ['name-art intaglio-lines and banknote concepts (burin cuts along centre lines, guilloche tint, microprint)', 'lib/stack/echo.mjs onionFrame (the custody chain)', 'lib/seed.mjs nodeSeed per entry hash'],
  loop: { seconds: 4.8, fps: 24 }, still: (REVISIONS - 0.5) / REVISIONS, reduced: (REVISIONS - 0.5) / REVISIONS,
};
export const INK = { paper: oklch(0.955, 0.012, 92), ink: oklch(0.23, 0.05, 252), tint: oklch(0.83, 0.035, 230), spot: oklch(0.6, 0.2, 352), ghost: oklch(0.78, 0.1, 352) };

// The van der Corput radical inverse in base 2: 1 -> 0.5, 2 -> 0.25, 3 -> 0.75, 4 -> 0.125 ...
export const vdc = n => { let v = 0, d = 0.5; while (n) { if (n & 1) v += d; n >>= 1; d /= 2; } return v; };

// The ledger: per revision its entry hash and the two cut levels it adds (share of the half stroke width).
export function ledger(seed, V = REVISIONS) {
  return contributors(`${seed}/intaglio/ledger`, V).map((hx, r) => {
    const s = nodeSeed(hx, 'cut');
    return { rev: r + 1, entry: hx, seed: s.seed, levels: [vdc(2 * r + 1), vdc(2 * r + 2)].map(l => Math.min(0.97, l + (s.rng() - 0.5) * 0.012)), wobble: s.seedInt % 997 };
  });
}

const geoCache = new Map();
// Per pixel: u (0 at the centre line, 1 at the edge), half width in px, and the shade of the raking light.
export function geometry(W, H, look = 'corrected') {
  const key = `${W}x${H}/${look}`; if (geoCache.has(key)) return geoCache.get(key);
  const N = setWord(W, H, { box: boxFor(look, [0.07, 0.25, 0.93, 0.69]), weight: 800, tracking: 50 }), cap = N.capPx;
  const S = strokesOf(N, Math.max(1, cap / 160)), D = fusedDistance(W, H, S, 0.2 * cap, 0.02 * cap), { gx, gy } = gradientOf(D, W, H);
  const u = new Float32Array(W * H).fill(-1), hw = new Float32Array(W * H), shade = new Float32Array(W * H), Lt = [-0.7, -0.71];
  for (let i = 0; i < W * H; i++) {
    if (!(N.sdf[i] < 0.5) || !isFinite(D[i])) continue;
    hw[i] = D[i] - N.sdf[i]; u[i] = clamp(D[i] / Math.max(1e-3, hw[i]));
    const g = Math.hypot(gx[i], gy[i]) || 1; shade[i] = clamp(0.5 - 0.5 * ((gx[i] / g) * Lt[0] + (gy[i] / g) * Lt[1]) * u[i]);
  }
  const G = { N, u, hw, shade, cap }; geoCache.set(key, G); return G;
}

// Coverage of the cuts at the given levels at pixel i (nearest level wins; levels never sit closer than a cut).
function cutCover(G, i, levels, x, y, wob) {
  const u = G.u[i]; if (u < 0) return 0;
  let best = 0;
  for (const l of levels) {
    const pitch = G.hw[i] / (2 * REVISIONS + 1), d = Math.abs(u - l) * G.hw[i];
    const half = Math.max(0.35, pitch * (0.16 + 0.34 * G.shade[i]) * (0.85 + 0.3 * fbm(x / 60, y / 60, wob, 3)));
    best = Math.max(best, clamp(half - d + 0.5));
  }
  return best;
}

// The plate: paper, a guilloche tint that stops short of the letters, every cut of every revision, the microprint.
export function plate(W, H, seed, look = 'corrected') {
  const G = geometry(W, H, look), L = ledger(seed), F = frame(W, H, INK.paper), all = L.flatMap(r => r.levels), p = Math.max(3, G.cap / 70);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, sd = G.N.sdf[i];
    let ink = cutCover(G, i, all, x, y, 3), tint = 0;
    if (sd > 0.04 * G.cap) { const ph = (y + 0.35 * p * 3 * Math.sin(x / (p * 9)) * Math.sin(y / (p * 23))) / p; tint = clamp(0.1 * p - Math.abs(ph - Math.round(ph)) * p + 0.5) * 0.9; }
    for (let c = 0; c < 3; c++) F.px[3 * i + c] = F.px[3 * i + c] * (1 - tint) + INK.tint[c] * tint;
    for (let c = 0; c < 3; c++) F.px[3 * i + c] = F.px[3 * i + c] * (1 - ink) + INK.ink[c] * ink;
  }
  microprint(F, G, L);
  return { F, G, L };
}

function microprint(F, G, L) {
  const { w, h } = F, text = L.map(r => `r${r.rev} ${r.entry.slice(0, 8)}`).join('  '), base = Math.max(...G.N.spans.map(s => s.base));
  const y0 = (base + 0.16 * G.cap) / h, M = setName(text, w, h, { box: [0.07, y0, 0.93, y0 + Math.max(8, 0.024 * G.cap) / h], style: 'mono', weight: 500, fit: 'width' });
  for (let i = 0; i < w * h; i++) { const m = M.mask[i] * 0.85; if (m > 0) for (let c = 0; c < 3; c++) F.px[3 * i + c] += (INK.ink[c] - F.px[3 * i + c]) * m; }
}

// The cuts revision r added, as a layer in the spot ink.
export function revisionLayer(G, rev, W, H) {
  const Lr = layer(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, a = cutCover(G, i, rev.levels, x, y, rev.wobble); if (a <= 0) continue;
    Lr.a[i] = a; for (let c = 0; c < 3; c++) Lr.px[3 * i + c] = INK.spot[c] * a;
  }
  return Lr;
}

export function render(W, H, { t = 0, seed = 'cmmns-wordmark/1', raw = false, look = 'corrected' } = {}) {
  const { F, G, L } = plate(W, H, seed, look), V = L.length, k = Math.min(V - 1, Math.floor(t * V));
  const seq = n => revisionLayer(G, L[((n % V) + V) % V], W, H);
  const out = onionFrame(seq, k, { ground: F, past: 2, future: 0, pastRGB: INK.ghost, peak: 0.6 });
  // bold: printed in negative, lemon cuts on an ultramarine plate, with a vermilion band through the mid values
  if (look === 'bold') duotone(out, oklch(0.93, 0.17, 100), oklch(0.25, 0.16, 266), { gamma: 1.2, accent: oklch(0.66, 0.21, 33), at: 0.55, width: 0.1 });
  return { image: raw ? out : grain(out, { amount: 1.2, seed: `${seed}/intaglio/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: G.N.text, spoken: G.N.spoken, data: { revision: k + 1, ledger: L.map(r => ({ rev: r.rev, entry: r.entry, levels: r.levels.map(v => +v.toFixed(4)) })) } };
}

// Icon: the cuts merge at icon size, so the letters are solid ink; at 128 px a white-line hatch shows the engraving.
export function icon(G) {
  const { w, h, mask } = G, F = frame(w, h, INK.paper);
  for (let i = 0; i < w * h; i++) {
    const y = (i / w) | 0, hatch = w >= 100 && y % 3 === 0 ? 0.55 : 1, m = mask[i] * hatch;
    for (let c = 0; c < 3; c++) F.px[3 * i + c] += (INK.ink[c] - F.px[3 * i + c]) * m;
  }
  return F;
}

// The reduced-motion still: the plate with every revision in ink and no onion skin (nothing moves, nothing lit).
export function renderSettled(W, H, { seed = 'cmmns-wordmark/1', raw = false } = {}) {
  const { F, G, L } = plate(W, H, seed);
  return { image: raw ? F : grain(F, { amount: 1.2, seed: `${seed}/intaglio/grain`, radius: Math.max(1, Math.round(W / 1600)) }), text: G.N.text, spoken: G.N.spoken, data: { revisions: L.length } };
}
