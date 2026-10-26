// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// metamer.mjs: the general metamer harness (BLEED sections 12, 18, 22; CORE.md: different properties, same readout).
// For any layer:
//   readout       the observer's law: the mean of the ticks the layer's law reads (amount, or height for glass,
//                 absorbance for pigments, light for emitters); for colour, the ink seen at unit amount under D65
//   spectrum      the ticks beneath it (for colour, the 16-band ink spectrum)
//   class         'ticks': the same mean, a different distribution (an error-diffused half-tone of the read field,
//                 its range kept); 'colour': the same D65 colour, another spectrum (base + a metameric black)
//   light change  tried in turn, each reported: a chord (recombined with an absorbing glaze ramp, a nonlinear law);
//                 near reading (the observer reads each tick in CIELAB and averages, against reading the mean: the
//                 display-size change); illuminant A; the layer's own tick field (thickness, for inks)
//   split         CIE76 between the pair after the light change
// Controls, which must not separate: the summary reader (laws fed the mean) and, for colour, the RGB path (each ink
// replaced by the smooth spectrum of its own D65 readout). A generator whose law is linear in its ticks shows no
// split under the chord: that is reported as a finding (section 12: linear laws need only values), not hidden.
import { combine, combineSummary, readField } from './combine.mjs';
import { combineSpectral, specOf, deltaE, lab } from './spectral.mjs';
import { metamericBlack, spectrumRGB } from '../../../superframe/lib/medium/spectral.mjs';
import { makeLayer } from './layer.mjs';

const meanRGB = (rgb, n) => { const m = [0, 0, 0]; for (let k = 0; k < n; k++) for (let c = 0; c < 3; c++) m[c] += rgb[3 * k + c] / n; return m; };
const meanLab = (rgb, n) => { const m = [0, 0, 0]; for (let k = 0; k < n; k++) { const q = lab([rgb[3 * k], rgb[3 * k + 1], rgb[3 * k + 2]]); for (let c = 0; c < 3; c++) m[c] += q[c] / n; } return m; };
const clone = L => ({ ...L, fields: Object.fromEntries(Object.entries(L.fields).map(([k, v]) => [k, Float32Array.from(v)])) });

export { readField };

// a second tick spectrum with the same mean per channel: an error-diffused half-tone between the field's own min and max
export function tickMetamer(L, how = 'halftone') {
  const B = clone(L), key = readField(L), F = B.fields[key], C = F.length / L.n;
  for (let c = 0; c < C; c++) {
    let lo = Infinity, hi = -Infinity, m = 0; for (let k = 0; k < L.n; k++) { const v = F[k * C + c]; lo = Math.min(lo, v); hi = Math.max(hi, v); m += v / L.n; }
    if (how === 'flat' || hi - lo < 1e-9) { for (let k = 0; k < L.n; k++) F[k * C + c] = m; continue; }
    let err = 0, same = true; for (let k = 0; k < L.n; k++) { const v = F[k * C + c] + err, q = v > (lo + hi) / 2 ? hi : lo; err = v - q; if (q !== F[k * C + c]) same = false; F[k * C + c] = q; }
    // a field that is already two-valued is its own half-tone: its other metamer is the flat field at its mean
    if (same) for (let k = 0; k < L.n; k++) F[k * C + c] = m;
  }
  if (key === 'absorb' && L.state?.absorbSpectrum) B.state = { ...L.state, absorbSpectrum: null };   // the half-tone now lives in the RGB absorbance
  return B;
}

export function chordLayer(w, h, ink = [0.75, 0.42, 0.18]) {
  const L = makeLayer('chord', { w, h, law: { shape: 'absorb', params: { strength: 1.6 } }, ink });
  for (let k = 0; k < w * h; k++) L.fields.amount[k] = 0.4 + 0.6 * ((k % w) / w);
  return L;
}

export function tickTest(L, { how = 'halftone' } = {}) {
  const B = tickMetamer(L, how), n = L.n, key = readField(L), T = chordLayer(L.w, L.h), mean = X => X.fields[key].reduce((a, b) => a + b, 0) / X.fields[key].length;
  const rA = mean(L), rB = mean(B), alone = [combine([L]).rgb, combine([B]).rgb], chord = [combine([L, T]).rgb, combine([B, T]).rgb];
  const splits = { chord: deltaE(meanRGB(chord[0], n), meanRGB(chord[1], n)), near: Math.hypot(...meanLab(alone[0], n).map((v, i) => v - meanLab(alone[1], n)[i])) };
  const ctl = [combineSummary([L, T]).rgb, combineSummary([B, T]).rgb], control = deltaE(meanRGB(ctl[0], n), meanRGB(ctl[1], n));
  const best = Object.entries(splits).sort((a, b) => b[1] - a[1])[0];
  return { class: 'ticks', field: key, readout: { A: rA, B: rB, diff: Math.abs(rA - rB) }, spectrum: `${key} ticks: original against ${how}`, splits, lightChange: best[0], split: best[1], control, linearUnderChord: splits.chord < 0.5, pass: Math.abs(rA - rB) < 1e-3 && best[1] > 0.5 && control < 0.05,
    // three states (proposed amendment A2): a constant field has no second spectrum to build, so nothing can be shown
    verdict: constant(L.fields[key]) ? 'unverifiable' : Math.abs(rA - rB) < 1e-3 && best[1] > 0.5 && control < 0.05 ? 'pass' : 'fail' };
}

// colour metamer: the ink seen at unit amount is the readout; illuminant A, then the layer's own ticks, split it
export function colourTest(L) {
  if (!L.ink && !L.spectrum) return null;
  const base = L.spectrum ?? specOf(L.ink), blk = metamericBlack(base, 'D65', { seed: 3 }), alt = base.map((v, i) => v + blk[i]), n = L.n;
  const unit = X => ({ ...X, fields: { ...X.fields, amount: new Float32Array(n).fill(1) }, state: {} });
  const WHITE = new Array(16).fill(1), view = (X, illum, paper = WHITE) => meanRGB(combineSpectral([X], null, { illum, paper }).rgb, n);
  const A = { ...L, spectrum: base, state: {} }, B = { ...L, spectrum: alt, state: {} };
  const readout = deltaE(view(unit(A), 'D65'), view(unit(B), 'D65'));
  const splits = { illuminantA: deltaE(view(unit(A), 'A'), view(unit(B), 'A')), ownTicks: deltaE(view(A, 'D65'), view(B, 'D65')), paperGround: deltaE(view(unit(A), 'D65', '#efe9dc'), view(unit(B), 'D65', '#efe9dc')) };
  const rA = { ...A, spectrum: specOf(spectrumRGB(base)) }, rB = { ...A, spectrum: specOf(spectrumRGB(alt)) }, control = deltaE(view(unit(rA), 'A'), view(unit(rB), 'A'));
  const best = Object.entries(splits).sort((a, b) => b[1] - a[1])[0];
  return { class: 'colour', readout: { inkDeltaE_D65: readout }, spectrum: 'ink: smooth upsampled spectrum against the same plus a metameric black', splits, lightChange: best[0], split: best[1], control, pass: readout < 1 && best[1] > 1 && control < 0.3, verdict: readout >= 1 ? 'unverifiable' : best[1] > 1 && control < 0.3 ? 'pass' : 'fail' };
}

function constant(F) { let lo = Infinity, hi = -Infinity; for (const v of F) { if (v < lo) lo = v; if (v > hi) hi = v; } return hi - lo < 1e-6; }
export function metamerBreakdown(L) { return { ticks: tickTest(L), colour: colourTest(L) }; }
