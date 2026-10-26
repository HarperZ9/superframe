import test from 'node:test';
import assert from 'node:assert/strict';
import { digit, envelope, events, audio, formula, draw, DEMO } from '../eqseq.mjs';

test('digit reads an integer left to right', () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7].map(s => digit(90009040, s, 8)), [9, 0, 0, 0, 9, 0, 4, 0]);
});

test('envelope peaks at velocity on the step and decays by e^-decay per beat', () => {
  const kick = DEMO.voices[0];
  assert.equal(envelope(kick, 0, 8), 1);
  assert.equal(envelope(kick, 0.5, 8), 0, 'rest step');
  assert.ok(Math.abs(envelope(kick, 3, 8) - 4 / 9) < 1e-12, 'step 6 has velocity 4');
  assert.ok(Math.abs(envelope(kick, 0.25, 8) - Math.exp(-9 * 0.25)) < 1e-12);
});

test('events: one per non-zero digit per bar, sorted, on the step grid', () => {
  const E = events(DEMO), perBar = DEMO.voices.reduce((s, v) => s + [...v.digits].filter(d => d !== '0').length, 0);
  assert.equal(E.events.length, perBar * DEMO.bars);
  assert.ok(Math.abs(E.duration - DEMO.bars * 4 * 60 / DEMO.bpm) < 1e-9);
  const step = (4 / DEMO.steps) * 60 / DEMO.bpm;
  for (let i = 0; i < E.events.length; i++) {
    const e = E.events[i]; if (i) assert.ok(e.t >= E.events[i - 1].t);
    assert.ok(Math.abs(e.t / step - Math.round(e.t / step)) < 1e-9);
    assert.ok(e.args.vel > 0 && e.args.vel <= 1);
  }
});

test('audio: deterministic, bounded, and loud exactly where the envelopes say', () => {
  const p = { ...DEMO, bars: 1 }, a = audio(p, 16000), b = audio(p, 16000);
  assert.deepEqual(a, b);
  assert.ok(a.every(v => v >= -1 && v <= 1));
  const step = Math.round((4 / p.steps) * 60 / p.bpm * 16000), rms = (s) => Math.sqrt(a.subarray(s, s + 400).reduce((q, v) => q + v * v, 0) / 400);
  assert.ok(rms(0) > 0.1, 'step 0 sounds');
  assert.ok(rms(0) > 4 * rms(step - 400), 'decayed before the next step');
});

test('formula names every voice and its integer; draw is deterministic with a hot playhead', () => {
  const f = formula(DEMO);
  for (const v of DEMO.voices) { assert.ok(f.includes(`${v.name}(x)`)); assert.ok(f.includes(String(Number(v.digits)))); }
  const A = draw({ w: 320, h: 200, t: 1.3 }), B = draw({ w: 320, h: 200, t: 1.3 });
  assert.deepEqual(A.px, B.px);
  let hot = 0; for (let i = 0; i < 320 * 200; i++) if (A.px[3 * i] > 0.3 && A.px[3 * i + 2] < 0.1) hot++;
  assert.ok(hot > 10, `hot pixels ${hot}`);
});
