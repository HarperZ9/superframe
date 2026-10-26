// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// views.mjs: every element in every view (CORE.md), all back ends of one layer, so a person can take the property in
// through the sense that suits them:
//   visual       the combined picture (linear rgb); motion is the sequence of these
//   auditory     a sonification with a documented mapping: 16 column bands of the read field, left to right as
//                time, each band's mean -> pitch 220 * 2^(2 mean) Hz, its spread -> loudness
//   textual      one plain sentence: law, weight, what the ticks hold now
//   conceptual   the CORE breakdown: properties, law, structure, readout, metamer class; neighbours by law family
//   descriptive  measured values with their instrument and basis (measured or estimated)
//   tactile      a navigator.vibrate pattern (ms on/off) from 8 column bands; the page feature-detects it
// featureOf(view, v) turns any view into numbers for the machine check (tools/views_check.mjs).
import { combine, readField } from './combine.mjs';

const bands = (F, w, h, n) => Array.from({ length: n }, (_, b) => { let s = 0, s2 = 0, c = 0; for (let j = 0; j < h; j++) for (let i = Math.floor(b * w / n); i < Math.floor((b + 1) * w / n); i++) { const v = F[j * w + i]; s += v; s2 += v * v; c++; } const m = s / c; return [m, Math.sqrt(Math.max(0, s2 / c - m * m))]; });

export function views(L, g = null) {
  const key = readField(L), F = L.fields[key].length === L.n ? L.fields[key] : Float32Array.from({ length: L.n }, (_, k) => L.fields[key][k * (L.fields[key].length / L.n)]);
  const b16 = bands(F, L.w, L.h, 16), b8 = bands(F, L.w, L.h, 8), mean = F.reduce((a, v) => a + v, 0) / L.n, d = g?.describe?.() ?? {};
  const visual = combine([L]).rgb;
  const auditory = { mapping: 'column band k of 16 -> time slot k; band mean m -> pitch 220 * 2^(2m) Hz; band spread -> amplitude', partials: b16.map(([m, s], k) => ({ t: k * 0.125, f: +(220 * 2 ** (2 * m)).toFixed(2), a: +Math.min(1, 0.2 + 2 * s).toFixed(3) })) };
  const textual = `${L.gen} acts by ${L.law.shape} on its ${key} ticks; their mean is ${mean.toFixed(2)}, densest in the ${b8.reduce((bi, x, i) => (x[0] > b8[bi][0] ? i : bi), 0) < 4 ? 'left' : 'right'} half.`;
  const conceptual = { properties: Object.keys(L.fields), law: { shape: L.law.shape, weights: L.weights }, structure: { order: L.order ?? null, side: 'above' }, readout: `mean of ${key}`, metamerClass: `any ${key} field with mean ${mean.toFixed(3)}`, neighbours: neighbours(L.law.shape) };
  const descriptive = { values: { mean: +mean.toFixed(4), bands8: b8.map(x => +x[0].toFixed(3)) }, instrument: `${L.gen} v${L.version ?? '?'} on a ${L.w} x ${L.h} grid, after ${L.steps} steps`, basis: 'measured (computed from the ticks)', provenance: d.credits ?? [] };
  const tactile = b8.flatMap(([m]) => [Math.round(20 + 180 * Math.min(1, m)), 40]);
  return { visual, auditory, textual, conceptual, descriptive, tactile };
}

const FAMILY = { absorb: ['ink', 'pigment', 'deposit'], cover: ['tiles', 'paint'], sheet: ['transparency', 'claim'], emit: ['light', 'heat'], refract: ['glass', 'lens'], screen: ['frost', 'light'], front: ['transfer'], clock: ['timing'] };
const neighbours = shape => Object.entries(FAMILY).filter(([k]) => k !== shape).slice(0, 2).map(([k]) => k).concat(FAMILY[shape] ?? []);

export function featureOf(view, v) {
  if (view === 'visual') { const n = v.length / 3, f = []; for (let b = 0; b < 16; b++) { let s = 0, c = 0; for (let k = Math.floor(b * n / 16); k < Math.floor((b + 1) * n / 16); k++) { s += v[3 * k] + v[3 * k + 1] + v[3 * k + 2]; c++; } f.push(s / c); } return f; }
  if (view === 'auditory') return v.partials.flatMap(p => [Math.log2(p.f / 220), p.a]);
  if (view === 'textual') { const m = /mean is ([\d.]+)/.exec(v), side = /left half/.test(v) ? 0 : 1; return [m ? +m[1] : 0, side]; }
  if (view === 'conceptual') return [parseFloat(/mean ([\d.]+)/.exec(v.metamerClass)?.[1] ?? 0)];
  if (view === 'descriptive') return [v.values.mean, ...v.values.bands8];
  if (view === 'tactile') return v.filter((_, i) => i % 2 === 0).map(x => x / 200);
  return [];
}
