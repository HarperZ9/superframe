// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
/* Demo: text -> symbol sequence -> motif spectrum, with a shuffled control.
   chars --tokens (isomorphism)--> tokens --words (homomorphism: keeps word-type counts up to case)--> words
   --motif (homomorphism: keeps the motif's positions)--> 0/1 sequence --pad (embedding)--> --spectrum
   (isomorphism)--> --magnitude (homomorphism)--> motif spectrum.
   Statistic: the highest spectral power over bins 2 .. n/2, divided by the mean power there. The control
   shuffles the words 200 times (seeded) and recomputes it; z is the real value against that spread. */
"use strict";
const fs = require("fs");
const path = require("path");
const F = require("../src/index.js");

const WORD = /^[A-Za-z0-9']+$/;
const tokenize = (s) => s.match(/[A-Za-z0-9']+|[^A-Za-z0-9']+/g) || [];

const C = {
  tokens: F.converter({ id: "text.tokens", claims: "isomorphism", residual: "symbol",
    forward: (f) => { const t = tokenize(f.values.join("")); return { values: t, domain: { kind: "sequence", shape: [t.length] }, unit: "symbol", sigma: 0, rep: { kind: "digital", encoding: "utf8 tokens" } }; },
    inverse: (out) => Array.from(out.values.join("")),
    targets: (src, out) => { const t = tokenize("Isomorphic values, variables, and measurable states: a second text, never seen by the first."); return F.derive(out, { values: t, domain: { kind: "sequence", shape: [t.length] }, method: "other text" }); },
  }),
  words: F.converter({ id: "text.words", claims: "homomorphism",
    forward: (f) => { const w = f.values.filter((t) => WORD.test(t)).map((t) => t.toLowerCase()); return { values: w, domain: { kind: "sequence", shape: [w.length] }, unit: "word", sigma: 0 }; },
    keeps: { name: "word-type counts up to case", check: (src, out) => {
      const a = new Map(), b = new Map();
      for (const m of src.values.join("").matchAll(/[A-Za-z0-9']+/g)) a.set(m[0].toLowerCase(), (a.get(m[0].toLowerCase()) || 0) + 1);
      for (const w of out.values) b.set(w, (b.get(w) || 0) + 1);
      const ok = a.size === b.size && [...a].every(([k, v]) => b.get(k) === v);
      return { ok, detail: `${a.size} word types` };
    } },
    lossEstimate: (src, out) => {
      const k = (f) => 8 * F.compression(f).bytesPacked;
      return { bits: k(src) - k(out), method: "compressed length K(tokens) - K(words), deflate" };
    },
  }),
  motif: (word) => F.converter({ id: "text.motif:" + word, claims: "homomorphism",
    forward: (f) => ({ values: Float64Array.from(f.values, (w) => (w === word ? 1 : 0)), unit: "count", sigma: 0, rep: { kind: "digital", bits: 1 } }),
    keeps: { name: "positions of '" + word + "'", check: (src, out) => {
      const a = src.values.flatMap((w, i) => (w === word ? [i] : [])), b = Array.from(out.values).flatMap((v, i) => (v ? [i] : []));
      return { ok: a.length === b.length && a.every((x, i) => x === b[i]), detail: a.length + " occurrences" };
    } },
    forwardLoss: (w) => (w === word ? 1 : 0),
  }),
};

const peakStat = (P) => {
  const n = P.length / 2;
  let best = 0, at = 0, sum = 0;
  for (let k = 2; k < n; k++) { sum += P[k]; if (P[k] > best) { best = P[k]; at = k; } }
  return { ratio: best / (sum / (n - 2)), bin: at };
};

/* The fundamental period: the highest autocorrelation, ifft(|X|^2), over lags 2 .. n/4. */
const fundamental = (powerField, n) => {
  const c = new Float64Array(2 * n);
  for (let i = 0; i < n; i++) c[2 * i] = powerField[i];
  const ac = F.ifft(F.make({ name: "power", domain: { kind: "sequence", shape: [n] }, values: c, components: 2, unit: "1", sigma: null, prov: { status: "derived" }, rep: { kind: "digital", encoding: "float64" } }));
  let best = -Infinity, lag = 0;
  for (let k = 2; k < n / 4; k++) if (ac.values[2 * k] > best) { best = ac.values[2 * k]; lag = k; }
  return lag;
};

const spectrumOf = (words, word) => {
  const m = F.apply(C.motif(word), words), p = F.apply(F.C.pad(), m), s = F.apply(F.C.spectrum(), p), mag = F.apply(F.C.magnitude(), s);
  const P = Float64Array.from(mag.values, (a) => a * a);
  return { field: mag, stat: peakStat(P), n: p.values.length, lag: fundamental(P, p.values.length) };
};

/* The control needs only the statistic: the same operators without the per-step grading. */
const statFast = (words, word, n) => {
  const v = new Float64Array(n);
  words.forEach((w, i) => { if (w === word) v[i] = 1; });
  const X = F.fft(F.make({ name: "shuffled", domain: { kind: "sequence", shape: [n] }, values: v, unit: "count", sigma: 0, prov: { status: "derived" }, rep: { kind: "digital", bits: 1 } }));
  return peakStat(F.power(X).values).ratio;
};

const shuffle = (arr, r) => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* text: a string; word: the motif; label and source for provenance. */
const study = (text, word, label, source, nShuffle = 200) => {
  const chars = F.make({ name: label, domain: { kind: "sequence", shape: [Array.from(text).length] }, values: Array.from(text), unit: "char", sigma: 0,
    prov: { status: "defined", source, sha256: F.sha256(text) }, rep: { kind: "digital", encoding: "utf8" } });
  const tok = F.apply(C.tokens, chars), words = F.apply(C.words, tok), real = spectrumOf(words, word);
  const r = F.rng(20261031), null_ = [];
  for (let i = 0; i < nShuffle; i++) null_.push(statFast(shuffle(words.values, r), word, real.n));
  const mean = null_.reduce((a, b) => a + b, 0) / nShuffle, sd = Math.sqrt(null_.reduce((a, b) => a + (b - mean) ** 2, 0) / (nShuffle - 1));
  const above = null_.filter((x) => x >= real.stat.ratio).length;
  return {
    label, word, words: words.values.length, occurrences: words.values.filter((w) => w === word).length,
    peak: real.stat, peak_period_words: real.stat.bin ? real.n / real.stat.bin : null, fundamental_lag_words: real.lag, shuffled_mean: mean, shuffled_sd: sd,
    z: (real.stat.ratio - mean) / sd, p_perm: (above + 1) / (nShuffle + 1),
    chain: real.field.ledger.map((e) => ({ converter: e.converter, claimed: e.claimed, measured: e.measured, bitsLost: e.bitsLost, method: e.method })),
    field: real.field,
  };
};

/* Known answer: a refrain every 37 words among seeded filler, and the same words shuffled. */
const planted = () => {
  const r = F.rng(5), filler = "stone river light window paper copper field signal grain hollow ember lattice".split(" "), out = [];
  for (let i = 0; i < 2400; i++) out.push(i % 37 === 0 ? "nevermore" : filler[Math.floor(r() * filler.length)]);
  return out.join(" ");
};

const run = () => {
  const findings = process.env.FIELD_DEMO_TEXT || path.resolve(__dirname, "../../../CHANGELOG.md");
  const text = fs.readFileSync(findings, "utf8");
  const plantedText = planted();
  const shuffledText = shuffle(plantedText.split(" "), F.rng(9)).join(" ");
  return {
    planted: study(plantedText, "nevermore", "planted refrain every 37 words", "demos/text.js planted()"),
    planted_shuffled: study(shuffledText, "nevermore", "planted text, words shuffled", "demos/text.js planted() shuffled"),
    long_text: study(text, "the", "a long text, motif 'the'", findings),
  };
};

module.exports = { run, C, tokenize, study };
