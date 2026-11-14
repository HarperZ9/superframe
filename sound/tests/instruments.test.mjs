// Origin: the author's sound workspace, tests/instruments.test.mjs, carried on 2026-11-14 with the run line repointed.
// Node test for the v3 instrument set: every preset renders, finite, no clipping, sensible level, and the pitched models
// land on pitch (FFT peak of the reed and flute models against the requested note). Run: node --test sound/tests/instruments.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { INSTRUMENTS, preset } from '../sound/v3/instruments/index.js';
import { reed } from '../sound/v3/instruments/index.js';

const stats = (r) => { let pk = 0, s = 0, nan = 0; for (const ch of [r.L, r.R]) for (const v of ch) { if (!Number.isFinite(v)) nan++; pk = Math.max(pk, Math.abs(v)); s += v * v; } return { pk, rms: Math.sqrt(s / (2 * r.L.length)), nan }; };
for (const [id, inst] of Object.entries(INSTRUMENTS)) for (const name of Object.keys(inst.meta.presets)) {
  test(`${id} / ${name} renders clean`, () => {
    const r = inst.play(preset(inst.meta, name), { sr: 22050 }), s = stats(r);
    assert.equal(s.nan, 0); assert.ok(s.pk <= 1.0, `peak ${s.pk}`); assert.ok(s.rms > 1e-4, `rms ${s.rms}`);
  });
}
function peakHz(x, sr) { // naive DFT over 40..2000 Hz on a steady middle chunk, 1 Hz steps
  const a = Math.floor(x.length * 0.3), n = Math.min(8192, Math.floor(x.length * 0.4)); let best = 0, bf = 0;
  for (let f = 40; f < 2000; f += 1) { let re = 0, im = 0; for (let i = 0; i < n; i += 2) { const w = 2 * Math.PI * f * i / sr; re += x[a + i] * Math.cos(w); im += x[a + i] * Math.sin(w); } const m = re * re + im * im; if (m > best) { best = m; bf = f; } }
  return bf;
}
for (const sr of [22050, 48000]) for (const model of ['reed', 'flute']) for (const m of [55, 61, 64, 69, 76]) {
  test(`${model} model at ${sr} Hz lands on MIDI ${m} within 35 cents (strongest partial, any of harmonics 1 to 4)`, () => {
    const p = { ...preset(reed.meta, model === 'flute' ? 'temple-flute' : 'dark-reed'), vibrato: 0, scoop: 0 }, x = reed.note(m, 0.7, 1.2, p, sr);
    const f = peakHz(x, sr), want = 440 * Math.pow(2, (m - 69) / 12), k = Math.max(1, Math.round(f / want)); let c = 1200 * Math.log2(f / (want * k)); // the strongest partial can be the 2nd or 3rd harmonic (a reed's odd harmonics)
    assert.ok(Math.abs(c) < 35, `${model} ${m}: peak ${f} Hz against ${want.toFixed(1)}, ${c.toFixed(0)} cents`);
  });
}

import * as perceive from '../sound/v3/instruments/perceive.js';
const bandDb = (x, sr, f) => { let re = 0, im = 0; for (let i = 0; i < x.length; i++) { const w = 2 * Math.PI * f * i / sr; re += x[i] * Math.cos(w); im += x[i] * Math.sin(w); } return 10 * Math.log10((re * re + im * im) / x.length + 1e-20); };
test('phantom bass: the fundamental is at least 30 dB under the second harmonic', () => {
  const sr = 22050, x = perceive.phantomBass(33, 0.9, 1.0, { sr }), f = 440 * Math.pow(2, (33 - 69) / 12);
  assert.ok(bandDb(x, sr, 2 * f) - bandDb(x, sr, f) > 30, `${(bandDb(x, sr, 2 * f) - bandDb(x, sr, f)).toFixed(1)} dB`);
});
test('text to rhythm: vowels are long, consonants short, a full stop accents the hit before it', () => {
  const r = perceive.textRhythm('ab.'); assert.equal(r.events[0].len, 2); assert.equal(r.events[1].len, 1); assert.equal(r.events[1].vel, 1);
});
test('data to melody: the lowest value maps to the root, the highest to the top of the range', () => {
  const n = perceive.seriesNotes([1, 5, 9], { root: 49, octaves: 2 }); assert.equal(n[0], 49); assert.ok(n[2] > n[1] && n[2] <= 49 + 24);
});

// A held note must sit on zero: the waveguide's mean pressure is removed inside the voice (2026-11-11).
for (const model of ['reed', 'flute']) test(`${model}: a held note carries no DC offset`, () => {
  const p = { ...preset(reed.meta, model === 'flute' ? 'temple-flute' : 'dark-reed') }, x = reed.note(64, 0.7, 2, p, 48000); let mean = 0;
  for (let i = 4800; i < 96000; i++) mean += x[i]; mean /= 91200; assert.ok(Math.abs(mean) < 5e-4, `mean ${mean}`);
});
