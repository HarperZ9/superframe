// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// ribbon: a signal drawn along a curve, its width the signal's amplitude (lead reading of the 2026-10-26 batch's
// BCI visuals, labelled inferred). From first principles: discs are placed along the curve at even arc steps; disc i
// has radius r_i = r0 + gain * |s(arc_i - flow * t)|, so the signal flows along the curve; their radial falloff
// fields sum (metaballs, Blinn 1982): F(x) = sum_i r_i^2 / (|x - c_i|^2 + r_i^2 / k). The colour is a ramp on F,
// core to rim (pink core, then blue, then an orange rim, after the batch's reading). A context front layer scales
// each disc by the front's weight at its centre, so a cellular-automaton front can switch the ribbon on piece by
// piece; a context source gives the signal (its column means), else a seeded EMG-like burst train is used.
// Data to form: it fits EMG, audio onsets and claim against correction reach (the same family as ink in water and
// the tide line).
import { defineGen } from '../core/gen.mjs';
import { makeLayer, F32, clamp, rngFrom, hexLin, smooth } from '../core/layer.mjs';
import { quantizeAngles } from './orbit.mjs';

const RAMP = ['#f3a6c8', '#e04f9a', '#3c6fd6', '#e8873a'].map(hexLin);   // core, inner, mid, rim (inferred from the batch)
const ramp = f => { const t = clamp(f, 0, 1) * (RAMP.length - 1), i = Math.min(RAMP.length - 2, Math.floor(t)), u = t - i; return RAMP[i].map((v, c) => v + (RAMP[i + 1][c] - v) * u); };

export const ribbon = defineGen({
  id: 'ribbon',
  kind: 'conformational',
  law: { shape: 'cover', params: { field: 'metaball sum', ramp: 'core pink, blue, orange rim' } },
  weights: { r0: 'base radius, cells', gain: 'radius per unit signal', flow: 'arc fraction per second the signal moves', k: 'falloff sharpness', quant: 'angle quantisation weight 0 (free) to 1 (eight directions)', discs: 'disc count' },
  inputs: { source: 'optional: the signal (column means of its amount)', drive: 'optional front: scales each disc' },
  mechanism: 'F(x) = sum_i r_i^2 / (|x - c_i|^2 + r_i^2 / k), r_i = r0 + gain |s(arc_i - flow t)|; cover = smoothstep(0.6, 1.2, F); colour = ramp(F / 3)',
  credits: ['Blinn 1982, A Generalization of Algebraic Surface Drawing (metaballs)', 'the 2026-10-26 BCI visuals (lead reading, inferred)', 'Kibernetyk Mono angle rule, used as a rule only'],
  create({ w = 160, h = 100, r0 = 1.2, gain = 5, flow = 0.12, k = 2.5, quant = 0, discs = 90, seed = 'ribbon', kind = 'wave' } = {}) {
    const r = rngFrom(seed), sig = Float32Array.from({ length: 512 }, (_, i) => { const burst = Math.exp(-((((i % 128) - 64) / 18) ** 2)); return burst * (r() * 2 - 1) * 0.8 + 0.2 * Math.sin(i * 0.2); });
    let pts = Array.from({ length: 200 }, (_, i) => { const u = i / 199; return kind === 'circle' ? [w * (0.5 + 0.34 * Math.cos(6.283 * u)), h * (0.5 + 0.34 * Math.sin(6.283 * u))] : [w * (0.06 + 0.88 * u), h * (0.5 + 0.18 * Math.sin(6.283 * u * 1.2) + 0.06 * Math.sin(6.283 * u * 3.1))]; });
    pts = quantizeAngles(pts, quant);
    const L = makeLayer('ribbon', { w, h, law: { shape: 'cover', params: {} }, weights: { r0, gain, flow, k, quant, discs }, fields: { rgb: F32(3 * w * h) }, state: { pts: resample(pts, discs), sig, F: F32(w * h) } });
    return L;
  },
  step(L, dt, ctx) {
    const S = L.state, W = L.weights, { w, h } = L, F = S.F, src = ctx.source?.fields.amount, drv = ctx.drive?.fields.amount; F.fill(0);
    const signal = u => { if (src) { const x = clamp(Math.floor(u * w), 0, w - 1); let m = 0; for (let j = 0; j < h; j++) m += src[j * w + x]; return m / h * 4; } const p = ((u - W.flow * L.t) % 1 + 1) % 1 * S.sig.length; return S.sig[Math.floor(p)]; };
    S.pts.forEach(([cx, cy], i) => {
      const u = i / (S.pts.length - 1), gate = drv ? drv[clamp(Math.round(cy), 0, h - 1) * w + clamp(Math.round(cx), 0, w - 1)] : 1, rad = (W.r0 + W.gain * Math.abs(signal(u))) * gate; if (rad < 0.05) return;
      const R = rad * 3, r2 = rad * rad;
      for (let y = Math.max(0, Math.floor(cy - R)); y <= Math.min(h - 1, cy + R); y++) for (let x = Math.max(0, Math.floor(cx - R)); x <= Math.min(w - 1, cx + R); x++) F[y * w + x] += r2 / ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 + r2 / W.k);
    });
    const A = L.fields.amount, C = L.fields.rgb;
    for (let k = 0; k < L.n; k++) { A[k] = smooth(0.6, 1.2, F[k]); const c = ramp(1 - Math.min(1, F[k] / 3)); C[3 * k] = c[0]; C[3 * k + 1] = c[1]; C[3 * k + 2] = c[2]; }
  },
});

function resample(pts, n) {
  const s = [0]; for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return Array.from({ length: n }, (_, q) => { const t = q / (n - 1) * s.at(-1); let i = 1; while (i < s.length - 1 && s[i] < t) i++; const f = (t - s[i - 1]) / ((s[i] - s[i - 1]) || 1); return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f]; });
}
