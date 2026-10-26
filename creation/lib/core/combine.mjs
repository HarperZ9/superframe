// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// combine(layers, weights): weighted recombination with no law above the layers (BLEED sections 9, 11 and 12).
// Each layer applies its own law to what lies under it, in order, bottom first; the weight scales how much of that
// law acts, per layer (a number) or per tick (a Float32Array the size of the grid). Nothing here reads a layer's
// value: every law reads the ticks, which is why two layers with one value can turn into different things (the
// metamer test, tests/metamer.test.mjs).
// Laws (layer.law.shape):
//   paper    sets the ground: ink is the paper colour
//   sheet    a translucent sheet; consecutive sheets meet in the superframe's sheet engine (lib/medium/sheets.mjs
//            composite: multiply, density_add, weber, screen), each sheet with its own law
//   absorb   Beer-Lambert: c *= exp(-w * strength * a * k), k = -ln(ink) per channel, or the layer's own per-tick
//            absorbance (fields.absorb) where it carries one (pigments)
//   emit     light added: c += w * exposure * a-weighted rgb (blackbody)
//   screen   light scattered back: c = 1 - (1 - c)(1 - w * a * ink)
//   cover    opaque paint or glass tiles: c = lerp(c, rgb, w * a)
//   tiles    alias of cover (mosaic)
//   refract  glass: what lies under is read at displaced positions per channel (Cauchy dispersion), times the caustic
//   front    a transfer: its amount t moves weight between two groups of layers named in its params, from (1 - t)
//            to t, tick by tick; it draws nothing itself (BLEED section 13: transformation is weight shifting)
//   clock    timing layers draw nothing
import { composite } from '../../../superframe/lib/medium/sheets.mjs';
import { F32, hexLin, sampleC, clamp } from './layer.mjs';
import { cauchy, RGB_UM } from '../gen/glass.mjs';

const inkAbs = ink => ink.map(c => -Math.log(Math.max(0.02, c)));

export function combine(layers, weights = null, { paper = '#efe9dc', w = layers[0].w, h = layers[0].h } = {}) {
  const n = w * h, C = F32(3 * n), P = hexLin(paper);
  for (let k = 0; k < n; k++) { C[3 * k] = P[0]; C[3 * k + 1] = P[1]; C[3 * k + 2] = P[2]; }
  const Wt = layers.map((L, i) => (weights ? weights[i] ?? 1 : 1));
  // fronts turn their groups' weights into per-tick masks
  layers.forEach((L, i) => {
    if (L.law.shape !== 'front' || !L.law.params?.from) return;
    const t = L.fields.amount, mask = (idx, flip) => { const base = Wt[idx], m = F32(n); for (let k = 0; k < n; k++) m[k] = (typeof base === 'number' ? base : base[k]) * (flip ? t[k] : 1 - t[k]); Wt[idx] = m; };
    for (const name of L.law.params.from) mask(indexOf(layers, name), false);
    for (const name of L.law.params.to) mask(indexOf(layers, name), true);
  });
  const wAt = (i, k) => { const v = Wt[i]; return typeof v === 'number' ? v : v[k]; };
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i], shape = L.law.shape, A = L.fields.amount, str = L.law.params?.strength ?? 1;
    if (shape === 'sheet') {
      // a run of sheets meets in the sheet engine, each with its own law
      let j = i; while (j + 1 < layers.length && layers[j + 1].law.shape === 'sheet') j++;
      if (j === i && L.law.params.law !== 'saturate') {   // one sheet alone: multiply, density_add and weber all reduce to its transmission (same result, no per-pixel arrays)
        const ink = L.ink, scr = L.law.params.law === 'screen';
        for (let k = 0; k < n; k++) { const cov = clamp(A[k] * wAt(i, k), 0, 1); if (cov <= 0) continue; for (let c = 0; c < 3; c++) C[3 * k + c] = scr ? 1 - (1 - C[3 * k + c]) * (1 - cov * ink[c]) : C[3 * k + c] * (1 - cov * (1 - ink[c])); }
        continue;
      }
      if (layers.slice(i, j + 1).every(S => S.law.params.law === 'saturate')) {
        // a stack with a ceiling (PARTS-SCHEMA: "saturation needs a shape with a ceiling"): densities add, and the
        // stack is seen as dmax (1 - exp(-D / dmax)) per channel; dmax travels with the sheet (its own law parameter)
        for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) {
          let D = 0, dm = 0; for (let q = i; q <= j; q++) { const S = layers[q], cov = clamp(S.fields.amount[k] * wAt(q, k), 0, 1); if (cov <= 0) continue; D += -Math.log(Math.max(1e-4, 1 - cov * (1 - S.ink[c]))); dm = Math.max(dm, S.law.params.dmax ?? 1); }
          if (D > 0) C[3 * k + c] *= Math.exp(-dm * (1 - Math.exp(-D / dm)));
        }
        i = j; continue;
      }
      for (let k = 0; k < n; k++) {
        const sheets = []; for (let q = i; q <= j; q++) { const S = layers[q], cov = clamp(S.fields.amount[k] * wAt(q, k), 0, 1); if (cov > 0) sheets.push({ ink: S.ink, cover: cov, law: S.law.params.law }); }
        if (!sheets.length) continue;
        const c = composite([C[3 * k], C[3 * k + 1], C[3 * k + 2]], sheets); C[3 * k] = c[0]; C[3 * k + 1] = c[1]; C[3 * k + 2] = c[2];
      }
      i = j; continue;
    }
    if (shape === 'paper') { const Pp = L.ink; for (let k = 0; k < n; k++) { const t = wAt(i, k) * A[k]; for (let c = 0; c < 3; c++) C[3 * k + c] += (Pp[c] - C[3 * k + c]) * t; } continue; }
    if (shape === 'absorb') {
      const K = L.ink ? inkAbs(L.ink) : [1, 1, 1], Ab = L.fields.absorb;
      for (let k = 0; k < n; k++) { const s = wAt(i, k) * str; if (!s) continue; for (let c = 0; c < 3; c++) C[3 * k + c] *= Math.exp(-s * (Ab ? Ab[3 * k + c] : A[k] * K[c])); }
      continue;
    }
    if (shape === 'emit') { const R = L.fields.rgb, e = L.law.params?.exposure ?? 1; for (let k = 0; k < n; k++) { const s = wAt(i, k) * e; for (let c = 0; c < 3; c++) C[3 * k + c] += s * (R ? R[3 * k + c] : A[k] * L.ink[c]); } continue; }
    if (shape === 'screen') { const I = L.ink ?? [1, 1, 1]; for (let k = 0; k < n; k++) { const s = wAt(i, k) * A[k]; for (let c = 0; c < 3; c++) C[3 * k + c] = 1 - (1 - C[3 * k + c]) * (1 - s * I[c]); } continue; }
    if (shape === 'cover' || shape === 'tiles') { const R = L.fields.rgb; for (let k = 0; k < n; k++) { const s = clamp(wAt(i, k) * A[k], 0, 1); if (!s) continue; for (let c = 0; c < 3; c++) C[3 * k + c] += ((R ? R[3 * k + c] : L.ink[c]) - C[3 * k + c]) * s; } continue; }
    if (shape === 'refract') { refract(C, L, i, wAt, w, h); continue; }
    // front and clock draw nothing
  }
  return { w, h, rgb: C };
}

function indexOf(layers, name) { const i = layers.findIndex(L => L.name === name); if (i < 0) throw new Error(`combine: no layer named ${name}`); return i; }

function refract(C, L, i, wAt, w, h) {
  const H = L.fields.height, G = cauchy(L.weights.nd, L.weights.abbe), ns = RGB_UM.map(G.n), depth = L.weights.depth, src = Float32Array.from(C);
  for (let j = 0; j < h; j++) for (let x = 0; x < w; x++) {
    const k = j * w + x, s = wAt(i, k); if (!s) continue;
    const l = H[j * w + Math.max(0, x - 1)], r = H[j * w + Math.min(w - 1, x + 1)], u = H[Math.max(0, j - 1) * w + x], d = H[Math.min(h - 1, j + 1) * w + x];
    const gx = (r - l) / 2, gy = (d - u) / 2, lap = l + r + u + d - 4 * H[k];
    for (let c = 0; c < 3; c++) {
      const dn = (ns[c] - 1) * depth * s, v = sampleC(src, 3, c, w, h, x - dn * gx, j - dn * gy), caustic = clamp(1 / (1 + dn * lap), 0.35, 2.5);
      C[3 * k + c] = v * caustic;
    }
  }
}

// The control for the metamer test: the same laws, fed each layer's value (its mean) in place of its ticks. If this
// and combine() ever agree on a metamer pair, the engine has stopped reading ticks.
// the field a layer's law reads: height for glass, absorbance for pigments, light for emitters, else amount
export const readField = L => (L.law.shape === 'refract' ? 'height' : L.fields.absorb ? 'absorb' : L.law.shape === 'emit' && L.fields.rgb ? 'rgb' : 'amount');
export function combineSummary(layers, weights, opts) {
  const flat = layers.map(L => {
    const key = readField(L), F = L.fields[key], C = F.length / L.n, out = F32(F.length);
    for (let c = 0; c < C; c++) { let m = 0; for (let k = 0; k < L.n; k++) m += F[k * C + c] / L.n; for (let k = 0; k < L.n; k++) out[k * C + c] = m; }
    return { ...L, fields: { ...L.fields, [key]: out } };
  });
  return combine(flat, weights, opts);
}
