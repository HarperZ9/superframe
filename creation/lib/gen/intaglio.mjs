// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// intaglio: the cut that holds the ink. Tone comes from line width and line density, never from flat fill
// (SYNTHESIS-MAP section 2; the reference library's rule "burin: tone by line"). From first principles:
//   phase    phi(x) = (x . n) / pitch + follow * D(x) / pitch: straight engraved lines (direction n) bent to run
//            along the form's contours (D is the tone's smoothed signed height about its mean, so iso-lines of
//            phi bend where the form rises), and the burin follows the form
//   width    a line's half-width at x is 0.5 * pitch * tone(x)^gamma: dark tone swells the cut, light tone thins it
//            to a hairline, and the coverage is the antialiased band |frac(phi) - 0.5| * pitch < half-width
//   cross    below the shadow threshold a second set at +angle2 is cut, and only there
//   cutting  the burin travels along each line: a line cell shows once the burin's travel along the line direction
//            passes it, each line starting at its own seeded offset, so the plate is cut forward line by line
// amount = ink held in the cut (0..1). Context: source (tone: a picture, a field, a word's mask), timing (the cut).
// The swell of a line under raking light belongs to glass and relief (gen/glass.mjs reads amount as height).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, smooth, textMask, blur } from '../core/layer.mjs';

export const intaglio = defineGen({
  id: 'intaglio',
  law: { shape: 'absorb', params: { beer: true } },
  weights: { pitch: 'line spacing, cells', angle: 'line direction, degrees', follow: 'how much lines bend to the form 0..1', gamma: 'tone to width exponent', shadow: 'cross-hatch threshold', angle2: 'cross-hatch angle', speed: 'burin travel, widths per second' },
  inputs: { source: 'optional: tone field', timing: 'optional: drives the cut' },
  mechanism: 'phi = (x.n)/pitch + follow*D/pitch; ink = aa(|frac(phi)-0.5|*pitch < 0.5*pitch*tone^gamma) * [cut front passed]; cross set where tone > shadow',
  credits: ['Goltzius, swelling-line engraving (1590s)', 'Jobard and Lefer 1997 (evenly spaced streamlines)', 'Nees and Molnar (plotter line art, 1960s)', 'Giger ballpoint crosshatch (density from one pen, as a reading)', 'techniques/lib/burin.js (our structure-tensor burin, the streamline method this phase method complements)'],
  create({ w = 160, h = 100, tone = null, text = null, pitch = 3.2, angle = -18, follow = 0.7, gamma = 0.8, shadow = 0.62, angle2 = 52, speed = 0.35, box, bend = 18, soften = 3 } = {}) {
    const T = tone ? Float32Array.from(tone) : text ? blur(textMask(text, w, h, box), w, h, 2).map(v => clamp(0.15 + v * 1.4, 0, 1)) : radial(w, h);
    const L = makeLayer('intaglio', { w, h, law: { shape: 'absorb', params: { strength: 2.4 } }, weights: { pitch, angle, follow, gamma, shadow, angle2, speed }, state: { T, D: edgeDist(T, w, h, bend, soften), p: 0 } });
    L.ink = [0.09, 0.07, 0.16];
    cut(L, null); return L;
  },
  step(L, dt, ctx) {
    const S = L.state; S.p = ctx.timing?.state ? ctx.timing.state.progress : Math.min(1, S.p + dt * L.weights.speed);
    if (ctx.source) { const s = ctx.source.fields.amount; for (let k = 0; k < L.n; k++) S.T[k] = 0.85 * S.T[k] + 0.15 * clamp(s[k], 0, 1); }
    cut(L);
  },
});

function cut(L) {
  const { w, h } = L, S = L.state, W = L.weights, A = L.fields.amount, a1 = W.angle * Math.PI / 180, a2 = W.angle2 * Math.PI / 180, aa = 0.6;
  const band = (x, y, a, k, set) => {
    const nx = -Math.sin(a), ny = Math.cos(a), phi = (x * nx + y * ny) / W.pitch + W.follow * S.D[k] / W.pitch, line = Math.floor(phi), f = phi - line;
    const half = 0.5 * W.pitch * Math.pow(S.T[k], W.gamma) * (set ? 0.8 : 1), dist = Math.abs(f - 0.5) * W.pitch;
    const along = ((x * Math.cos(a) + y * Math.sin(a)) / Math.hypot(w, h) + 0.5), start = hash(line * 7 + set) * 0.35, reach = (S.p * 1.6 - start);
    return smooth(half + aa, half - aa, dist) * smooth(0, 0.04, reach - along);
  };
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = j * w + i; let v = band(i + 0.5, j + 0.5, a1, k, 0);
    if (S.T[k] > W.shadow) v = Math.max(v, band(i + 0.5, j + 0.5, a2, k, 1) * smooth(W.shadow, W.shadow + 0.12, S.T[k]));
    A[k] = v;
  }
}
const hash = i => { let q = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b); q ^= q >>> 13; q = Math.imul(q, 0xc2b2ae35); return ((q ^ (q >>> 16)) >>> 0) / 4294967296; };
function radial(w, h) { const T = F32(w * h); for (let k = 0; k < T.length; k++) { const x = (k % w) / w - 0.38, y = (k / w | 0) / h - 0.42; T[k] = clamp(0.25 + 0.9 * Math.exp(-(x * x + y * y) * 7) * (0.6 + 0.4 * Math.sin(8 * x)), 0, 1); } return T; }
// the tone's signed height about its mean, smoothed: the form whose contours the lines follow
function edgeDist(T, w, h, bend = 18, soften = 3) { let m = 0; for (const v of T) m += v; m /= T.length; const D = F32(w * h); for (let k = 0; k < D.length; k++) D[k] = (T[k] - m) * bend; return blur(D, w, h, soften); }
