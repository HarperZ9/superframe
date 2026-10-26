// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// language.mjs: a text front end (CORE.md "Language and speech"). Properties: words, syllables (vowel-group count, a
// heuristic), sentence lengths. Laws with weights:
//   zipf        rank-frequency exponent (Zipf 1949)            heaps   vocabulary growth V = K N^beta (Heaps 1978)
//   devices     alliteration, anaphora, epistrophe, chiasmus (detected here), plus Articulate's own readouts where the
//               linter is given (rule of three, parallel enumeration, corrective negation, repeated frames): its
//               counts per 100 words become device weights. The devices are for creative and analytic use only;
//               nothing here optimises text against any detector (Articulate's standing rule).
// Readouts for the isomer test: bag of words (order-blind, the control) and ordered bigrams (order-aware).
// Formants: a vowel's readout is its first two formants, estimated from the partials' smoothed envelope; two sources
// with the same envelope and different pitch are vowel metamers, split by a pitch readout.
import { irLayer, irDoc, weight } from './ir.mjs';

export const words = t => (t.toLowerCase().match(/[a-z']+/g) ?? []);
export const syllables = w => Math.max(1, (w.match(/[aeiouy]+/g) ?? []).length - (/[^aeiou]e$/.test(w) ? 1 : 0));
const fit = (xs, ys) => { const n = xs.length, mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; } return sxy / sxx; };

export function zipfExponent(ws, top = 1000) { const c = new Map(); for (const w of ws) c.set(w, (c.get(w) ?? 0) + 1); const f = [...c.values()].sort((a, b) => b - a).slice(0, top); return f.length > 5 ? -fit(f.map((_, i) => Math.log(i + 1)), f.map(Math.log)) : null; }
export function heapsBeta(ws) { const seen = new Set(), xs = [], ys = []; ws.forEach((w, i) => { seen.add(w); if ((i + 1) % 200 === 0) { xs.push(Math.log(i + 1)); ys.push(Math.log(seen.size)); } }); return xs.length > 3 ? fit(xs, ys) : null; }

export function devices(text) {
  const sents = text.split(/(?<=[.!?])\s+/).map(s => words(s)).filter(s => s.length), lines = text.split(/\n+/).map(l => words(l)).filter(l => l.length), N = words(text).length || 1;
  let allit = 0; for (const s of sents) for (let i = 1; i < s.length; i++) if (s[i][0] === s[i - 1][0] && s[i].length > 3 && s[i - 1].length > 3 && !/[aeiou]/.test(s[i][0])) allit++;
  let anaphora = 0, epistrophe = 0; for (let i = 1; i < lines.length; i++) { if (lines[i][0] === lines[i - 1][0] && lines[i][0].length > 2) anaphora++; if (lines[i].at(-1) === lines[i - 1].at(-1) && lines[i].at(-1).length > 3) epistrophe++; }
  let chiasmus = 0; for (const s of sents) { const c = s.filter(w => w.length > 3); for (let i = 0; i + 3 < c.length; i++) for (let j = i + 2; j + 1 < c.length && j < i + 8; j++) if (c[i] === c[j + 1] && c[i + 1] === c[j] && c[i] !== c[i + 1]) chiasmus++; }
  const per = v => +(100 * v / N).toFixed(3);
  return { alliteration: per(allit), anaphora: per(anaphora), epistrophe: per(epistrophe), chiasmus: per(chiasmus) };
}

export function textToIR(text, { name = 'text', articulate = null } = {}) {
  const ws = words(text), z = zipfExponent(ws), hb = heapsBeta(ws), dv = devices(text), syl = ws.reduce((s, w) => s + syllables(w), 0) / Math.max(1, ws.length);
  const art = articulate ? { tricolon: articulate.violations?.rule_of_three ?? 0, parallelism: articulate.violations?.parallel_enumeration ?? 0, antithesis: articulate.higher_order?.corrective_negation?.count ?? 0, repeated_frame: articulate.violations?.repeated_syntactic_frame ?? 0 } : {};
  const N = ws.length || 1, layers = [
    irLayer({ name: 'zipf', order: 1, role: 'statistic', law: 'zipf', w: weight(z ?? 0, 'measured', 'rank-frequency slope, top 1000 ranks'), ticks: [] }),
    irLayer({ name: 'heaps', order: 2, role: 'statistic', law: 'heaps', w: weight(hb ?? 0, 'measured', 'log V against log N, every 200 tokens') }),
    irLayer({ name: 'syllables', order: 3, role: 'meter', law: 'syllable_count', w: weight(syl, 'estimated', 'vowel-group heuristic per word (no stress model)') }),
    ...Object.entries(dv).map(([k, v], i) => irLayer({ name: k, order: 4 + i, role: 'device', law: k, w: weight(v, 'measured', 'detected here, per 100 words') })),
    ...Object.entries(art).map(([k, v], i) => irLayer({ name: k, order: 10 + i, role: 'device', law: k, w: weight(+(100 * v / N).toFixed(3), 'measured', 'Articulate check_writing.py readout, per 100 words') })),
  ];
  return irDoc({ study: `language-${name}`, kind: 'text', medium: 'writing', source: { front_end: 'textToIR', tokens: ws.length }, concepts: [{ name: 'language', label: 'measured', by: 'code', layers }] });
}

export const bagReadout = t => { const c = new Map(); for (const w of words(t)) c.set(w, (c.get(w) ?? 0) + 1); return c; };
export const bigramReadout = t => { const ws = words(t), s = new Set(); for (let i = 1; i < ws.length; i++) s.add(`${ws[i - 1]} ${ws[i]}`); return s; };
export const bagDistance = (a, b) => { const A = bagReadout(a), B = bagReadout(b), keys = new Set([...A.keys(), ...B.keys()]); let d = 0; for (const k of keys) d += Math.abs((A.get(k) ?? 0) - (B.get(k) ?? 0)); return d; };
export const bigramDistance = (a, b) => { const A = bigramReadout(a), B = bigramReadout(b); let i = 0; for (const x of A) if (B.has(x)) i++; return 1 - i / Math.max(1, new Set([...A, ...B]).size); };

// vowels: a harmonic source at f0 shaped by formant resonances; the readout is (F1, F2) from the smoothed envelope
export function vowel(f0, formants = [[700, 110], [1220, 140], [2600, 200]]) { const parts = []; for (let f = f0; f < 4000; f += f0) { let a = 0; for (const [F, B] of formants) a += 1 / (1 + ((f - F) / B) ** 2); parts.push({ f, a: a / Math.sqrt(f / f0) }); } return parts; }
export function formantReadout(parts) {
  const env = Array.from({ length: 400 }, (_, i) => { const f = 10 * i; let s = 0, wsum = 0; for (const p of parts) { const k = Math.exp(-(((p.f - f) / 120) ** 2)); s += p.a * k; wsum += k; } return wsum > 1e-6 ? s / wsum : 0; });
  const peaks = []; for (let i = 1; i < env.length - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1] && env[i] > 0.15 * Math.max(...env)) peaks.push(10 * i);
  return peaks.slice(0, 2);
}
