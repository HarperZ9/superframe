import { test } from 'node:test';
import assert from 'node:assert/strict';
import { integratedLufs, truePeakDb, levelLufs } from '../lib/loudness.mjs';

const sine = (f, amp, secs, sr = 48000, phase = 0) => Float64Array.from({ length: Math.round(secs * sr) }, (_, i) => amp * Math.sin(2 * Math.PI * f * i / sr + phase));

test('BS.1770 reference: a 997 Hz sine at 0 dBFS in one channel reads -3.01 LUFS; in two channels 0.0', () => {
  const s = sine(997, 1, 5);
  assert.ok(Math.abs(integratedLufs([s], 48000) + 3.01) < 0.05, `${integratedLufs([s], 48000)}`);
  assert.ok(Math.abs(integratedLufs([s, s], 48000) - 0.0) < 0.05);
});

test('the K-weighting holds at 44.1 kHz too, and loudness scales 1:1 with gain', () => {
  const s = sine(997, 0.1, 5, 44100);
  assert.ok(Math.abs(integratedLufs([s], 44100) - (-3.01 - 20)) < 0.06);
});

test('gating: silence and quiet passages do not drag the integrated value down', () => {
  const sr = 48000, loud = sine(997, 0.5, 3), quiet = sine(997, 0.0005, 3), silence = new Float64Array(3 * sr);
  const alone = integratedLufs([loud], sr), mixed = integratedLufs([Float64Array.from([...loud, ...silence, ...quiet])], sr);
  // the quiet part is 60 dB down, so the relative gate drops it; blocks that straddle the loud end still count (0.2 dB)
  assert.ok(Math.abs(alone - mixed) < 0.3, `${alone} vs ${mixed}`);
  const ungated = 10 * Math.log10((3 * 0.125 + 3 * 1.25e-7) / 9) - 0.691 - 3.01 + 3.01;
  assert.ok(mixed - ungated > 4, `gating matters: ${mixed} vs an ungated mean near ${ungated}`);
  assert.equal(integratedLufs([silence], sr), -Infinity);
});

test('true peak finds an inter-sample over that the sample peak misses', () => {
  // fs/4 sine at 45 degrees: every sample sits at 0.707 of the waveform's real peak
  const sr = 48000, s = sine(sr / 4, 1, 1, sr, Math.PI / 4);
  const sp = 20 * Math.log10(Math.max(...s.map(Math.abs)));
  const tp = truePeakDb([s]);
  assert.ok(sp < -2.9 && sp > -3.1, `sample peak ${sp}`);
  assert.ok(tp > -0.3, `true peak ${tp}`);
});

test('levelLufs reaches the target, and the true-peak ceiling wins when it must', () => {
  const sr = 48000, a = sine(440, 0.05, 4), b = Float64Array.from(a);
  const r = levelLufs([a, b], sr, { target: -14, ceilingDbtp: -1.6 });
  assert.equal(r.limitedBy, 'loudness');
  assert.ok(Math.abs(integratedLufs([a, b], sr) + 14) < 0.05);
  // a spiky signal: clicks over a quiet bed, so the ceiling binds first
  const c = new Float64Array(4 * sr); for (let i = 0; i < c.length; i += sr / 2) c[i] = 0.9; for (let i = 0; i < c.length; i++) c[i] += 0.001 * Math.sin(i / 7);
  const q = levelLufs([c], sr, { target: -14, ceilingDbtp: -1.6 });
  assert.equal(q.limitedBy, 'true-peak');
  assert.ok(truePeakDb([c]) <= -1.55);
});
