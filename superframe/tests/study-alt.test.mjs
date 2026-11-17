// study.md's Sound and Touch alt lines say what the sound and the pulses do, from the rendered sound, and the
// vendored describer is the site's file byte for byte. Run: node --test superframe/tests/study-alt.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compute, write } from '../lib/artifact/render.mjs';
import { loudness, tactile } from '../lib/artifact/sound.mjs';
import { soundAlt, touchAlt } from '../lib/artifact/study.mjs';
import { checkDescription } from '../lib/vendor/chart-describe.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = {
  seed: 'alt', size: [192, 108], sim: [96, 54], text: 'what the sound does', sound: { seconds: 2 },
  elements: [{ id: 'coral', law: 'rd', ink: '#2b3a6b', region: { cx: 0.3, cy: 0.4, rx: 0.2, ry: 0.3 }, scale: 60 }],
};
const ok = (d) => assert.deepEqual(checkDescription(d.text, d.facts), [], d.text);

// a made sound whose loudness rises steadily over 2 s, on two bands with the upper one twice as strong
function ramp() {
  const rate = 8000, n = rate * 2, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = 0.3 * (i / n) * Math.sin(i * 0.3); R[i] = L[i]; }
  return { rate, channels: [L, R], env: [Float32Array.of(0.1, 0.1), Float32Array.of(0.2, 0.2)], freqs: [110, 880], seconds: 2 };
}
const R0 = { sound: { seconds: 2, lo: 110, hi: 880 } };

test('planted: the old mapping-only Sound and Touch lines fail against the envelope they sat on', () => {
  const s = soundAlt(R0, ramp()), t = touchAlt(tactile(ramp()));
  assert.ok(checkDescription('2 s, left to right in time, top of the frame as high pitch, 110 Hz to 880 Hz.', s.curve.facts).some((e) => /no trend/.test(e)));
  assert.ok(checkDescription('tactile.json, a vibration pattern following the loudness over time.', t.curve.facts).length > 0);
  assert.ok(checkDescription('Loudness falls from 0.1 RMS to 0 RMS.', s.curve.facts).some((e) => /never falls/.test(e)));
});

test('known answer: a rising envelope reads as rising, in sound and in touch, with its loudest band', () => {
  const s = soundAlt(R0, ramp()), t = touchAlt(tactile(ramp()));
  ok(s); ok(t);
  assert.match(s.text, /^2 s, left to right in time, top of the frame as high pitch, 110 Hz to 880 Hz\. Loudness rises from /);
  assert.match(s.text, /at a nearly steady rate\./);
  assert.match(s.text, /The band that carries the most is 880 Hz\.$/);
  assert.match(t.text, /^tactile\.json, 20 of 20 steps of 100 ms carry a pulse\. Pulse length rises from 3 ms at 0 s to 88 ms at 1\.9 s, at a nearly steady rate\.$/);
});

test('the loudness the study reads is the one the touch pattern is made from', () => {
  const snd = compute(BASE, { only: ['sound'] }).sound, tac = tactile(snd), env = loudness(snd, 100);
  assert.equal(tac.pattern.length, 2 * env.length);
  env.forEach((v, i) => assert.equal(tac.pattern[2 * i], Math.round(Math.min(1, v * 3) * 100)));
});

test('study.md carries the computed lines for a rendered recipe', () => {
  const out = compute(BASE), dir = mkdtempSync(join(tmpdir(), 'sf-alt-')); write(out, dir);
  const md = readFileSync(join(dir, 'study.md'), 'utf8'), s = soundAlt(out.r, out.sound), t = touchAlt(tactile(out.sound));
  ok(s); ok(t);
  assert.ok(md.includes(`- Sound: ${s.text}`), md.slice(-600));
  assert.ok(md.includes(`- Touch: ${t.text}`));
  assert.doesNotMatch(md, /a vibration pattern following the loudness over time/);
});

test('the vendored describer is the site file unchanged: its body hashes to the pin in its header', () => {
  const text = readFileSync(join(HERE, '../lib/vendor/chart-describe.mjs'), 'utf8').replace(/\r\n/g, '\n');
  const pin = /SHA-256 of everything after it: ([0-9a-f]{64})/.exec(text)[1], body = text.slice(text.indexOf('// ---\n') + 7);
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  assert.equal(sha(body), pin);
  assert.notEqual(sha(body.replace('Three significant', 'Two significant')), pin, 'planted: a one-word edit must break the pin');
});
