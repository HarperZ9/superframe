// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// record.mjs: the transparency record on every crossing (BLEED section 24; CORE.md "which properties survived a
// crossing, and how much"). combineRecorded() returns the result and a record that is a prediction, made from the
// laws and weights alone before any ablation:
//   sources      each layer's law, weight, mean tick, tick spread, structure (order)
//   predicted    each layer's expected visible contribution (law-specific contrast x weight x what lies above it)
//   survived     layers predicted visible; lost: predicted invisible
//   ticks        whether a layer's tick pattern (not only its mean) is predicted to show: a cover above it, or a
//                law that flattens, merges its tick metamers into one readout
//   structure    the order the laws were applied in (an isomer change is a change here)
// recordCheck() then measures by ablation (remove one layer, CIE76 change of the result) and scores the prediction.
// The control: the same records with the predictions shuffled between layers must score worse.
import { combine } from './combine.mjs';
import { deltaE } from './spectral.mjs';
import { hexLin } from './layer.mjs';

const mean = a => { let s = 0; for (let k = 0; k < a.length; k++) s += a[k]; return s / a.length; };
const spread = a => { const m = mean(a); let s = 0; for (let k = 0; k < a.length; k++) s += (a[k] - m) ** 2; return Math.sqrt(s / a.length); };

function contrast(L, paper) {
  const sh = L.law.shape, a = mean(L.fields.amount), str = L.law.params?.strength ?? 1;
  if (sh === 'absorb') { if (L.fields.absorb) { let s = 0; for (const v of L.fields.absorb) s += v; return 1 - Math.exp(-s / L.fields.absorb.length); } const k = (L.ink ?? [0.2, 0.2, 0.2]).map(c => -Math.log(Math.max(0.02, c))); return 1 - Math.exp(-str * a * (k[0] + k[1] + k[2]) / 3); }
  if (sh === 'sheet') return a * (1 - (L.ink ?? [0.5, 0.5, 0.5]).reduce((s, c) => s + c, 0) / 3);
  if (sh === 'cover' || sh === 'tiles') { const R = L.fields.rgb; let d = 0; if (R) { for (let k = 0; k < L.n; k++) d += L.fields.amount[k] * (Math.abs(R[3 * k] - paper[0]) + Math.abs(R[3 * k + 1] - paper[1]) + Math.abs(R[3 * k + 2] - paper[2])) / 3; return d / L.n; } return a * 0.5; }
  if (sh === 'emit') { const R = L.fields.rgb; let d = 0; if (R) for (let k = 0; k < R.length; k++) d += R[k]; return R ? d / R.length : a; }
  if (sh === 'screen') return a * 0.6;
  if (sh === 'refract') { const H = L.fields.height, w = L.w; let g = 0; for (let k = 1; k < H.length - w; k++) g += Math.abs(H[k + 1] - H[k]) + Math.abs(H[k + w] - H[k]); return Math.min(1, g / H.length * L.weights.depth * 0.5); }
  return 0;
}

export function predict(layers, weights = null, { paper = '#efe9dc', tau = 0.012 } = {}) {
  const P = hexLin(paper), wt = i => { const v = weights?.[i] ?? 1; return typeof v === 'number' ? v : mean(v); };
  const c = layers.map((L, i) => wt(i) * contrast(L, P));
  // what lies above: covers and sheets above a layer hide it by their mean cover
  const above = layers.map((_, i) => layers.slice(i + 1).reduce((h, U, j) => (['cover', 'tiles'].includes(U.law.shape) ? h * (1 - Math.min(1, wt(i + 1 + j) * mean(U.fields.amount))) : U.law.shape === 'sheet' ? h * (1 - 0.5 * Math.min(1, mean(U.fields.amount))) : h), 1));
  return layers.map((L, i) => {
    const v = c[i] * above[i], flat = ['front', 'clock'].includes(L.law.shape);
    return { name: L.name, gen: L.gen, law: L.law.shape, weight: +wt(i).toFixed(4), meanTick: +mean(L.fields.amount).toFixed(4), tickSpread: +spread(L.fields.amount).toFixed(4), order: i + 1, predictedContribution: +v.toFixed(4), visible: !flat && v > tau, ticksVisible: !flat && v > tau && spread(L.fields.amount) > 0.02 && above[i] > 0.3 };
  });
}

export function combineRecorded(layers, weights = null, opts = {}) {
  const out = combine(layers, weights, opts), pred = predict(layers, weights, opts);
  out.record = { format: 'creation-engine.transparency/1', structure: { order: layers.map(L => L.name) }, sources: pred, survived: pred.filter(p => p.visible).map(p => p.name), lost: pred.filter(p => !p.visible).map(p => p.name),
    metamers: { merged: pred.filter(p => p.visible && !p.ticksVisible && p.tickSpread > 0.02).map(p => `${p.name}: only its mean is predicted to show; its tick pattern is covered`), kept: pred.filter(p => p.ticksVisible).map(p => p.name) } };
  return out;
}

// ablation: what each layer measurably contributes (mean CIE76 change when it is removed)
export function ablate(layers, weights = null, opts = {}) {
  const full = combine(layers, weights, opts).rgb, n = full.length / 3;
  return layers.map((L, i) => {
    const r = combine(layers.filter((_, j) => j !== i), weights ? weights.filter((_, j) => j !== i) : null, opts).rgb; let d = 0;
    for (let k = 0; k < n; k += 7) d += deltaE([full[3 * k], full[3 * k + 1], full[3 * k + 2]], [r[3 * k], r[3 * k + 1], r[3 * k + 2]]);
    return d / Math.ceil(n / 7);
  });
}

// score: the share of layers whose predicted visibility matches the measured one (measured visible: ablation dE > 1)
export function recordCheck(cases, { threshold = 1, shuffles = 50, seed = 7 } = {}) {
  let hit = 0, tot = 0, sh = 0, shTot = 0; let s = seed; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  for (const { layers, weights } of cases) {
    const pred = predict(layers, weights).map(p => p.visible), meas = ablate(layers, weights).map(d => d > threshold);
    pred.forEach((p, i) => { if (['front', 'clock'].includes(layers[i].law.shape)) return; hit += p === meas[i] ? 1 : 0; tot++; });
    for (let q = 0; q < shuffles; q++) { const perm = pred.map((_, i) => i).sort(() => r() - 0.5); perm.forEach((j, i) => { if (['front', 'clock'].includes(layers[i].law.shape)) return; sh += pred[j] === meas[i] ? 1 : 0; shTot++; }); }
  }
  return { accuracy: hit / tot, shuffledAccuracy: sh / shTot, layers: tot, pass: hit / tot > sh / shTot + 0.1 };
}
