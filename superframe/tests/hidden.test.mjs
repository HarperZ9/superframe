// hidden.test.mjs: a picture identical in daylight that becomes another by candlelight.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumRGB } from '../lib/medium/spectral.mjs';
import { reflectanceOf, deltaE } from '../lib/medium/metamers.mjs';
import { makeHidden, lpMax } from '../lib/medium/hidden.mjs';

const M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], X = c => M.map(m => m[0] * c[0] + m[1] * c[1] + m[2] * c[2]), W = X([1, 1, 1]);
const S = 48, n = S * S;
// day picture: a field of muted colours; hidden picture: a ring
const day = new Float32Array(3 * n), ring = new Float32Array(n), blank = new Float32Array(n).fill(0.5);
for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
  const i = y * S + x; day[3 * i] = 0.12 + 0.3 * x / S; day[3 * i + 1] = 0.2 + 0.15 * y / S; day[3 * i + 2] = 0.15 + 0.1 * Math.sin(x / 7);
  const r = Math.hypot(x - S / 2, y - S / 2); ring[i] = r > 10 && r < 18 ? 1 : 0;
}
const plain = i => reflectanceOf([day[3 * i], day[3 * i + 1], day[3 * i + 2]]);
const lum = c => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
const corr = (a, b) => { const ma = a.reduce((s, v) => s + v, 0) / a.length, mb = b.reduce((s, v) => s + v, 0) / b.length; let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0; };
const enc = Q => makeHidden(day, Q, n, { render: spectrumRGB });

test('the solver: a small LP with a known optimum', () => {
  // maximise x0 + 2 x1 subject to x0 + x1 + s = 4, x1 + t = 3 -> x1 = 3, x0 = 1
  const x = lpMax([[1, 1, 1, 0], [0, 1, 0, 1]], [4, 3], [1, 2, 0, 0]);
  assert.ok(Math.abs(x[0] - 1) < 1e-9 && Math.abs(x[1] - 3) < 1e-9);
});
test('acceptance: in daylight the hidden version matches the plain picture within delta E 0.5 at every pixel', () => {
  const h = enc(ring); let worst = 0;
  for (let i = 0; i < n; i++) worst = Math.max(worst, deltaE(X([h.day[3 * i], h.day[3 * i + 1], h.day[3 * i + 2]]), X(spectrumRGB(plain(i), 'D65')), W));
  assert.ok(worst < 0.5, `worst ${worst}`);
});
test('by candlelight the hidden picture appears: the luminance change follows it', () => {
  const h = enc(ring), d = [], q = [];
  for (let i = 0; i < n; i++) { d.push(lum([h.night[3 * i], h.night[3 * i + 1], h.night[3 * i + 2]]) - lum(spectrumRGB(plain(i), 'candle'))); q.push(ring[i]); }
  const r = corr(d, q); assert.ok(r > 0.9, `correlation ${r}`);
});
test('control: a blank hidden picture reveals nothing', () => {
  const h = enc(blank), d = [];
  for (let i = 0; i < n; i++) d.push(lum([h.night[3 * i], h.night[3 * i + 1], h.night[3 * i + 2]]) - lum(spectrumRGB(plain(i), 'candle')));
  const r = corr(d, Array.from(ring)); assert.ok(Math.abs(r) < 0.3, `blank correlates ${r} with the ring`);
});
test('control: hiding the ring in RGB breaks the daylight match', () => {
  let worst = 0;
  for (let i = 0; i < n; i++) { const c = spectrumRGB(plain(i), 'D65').map(v => v + 0.04 * ring[i]); worst = Math.max(worst, deltaE(X(c), X(spectrumRGB(plain(i), 'D65')), W)); }
  assert.ok(worst > 0.5, 'an RGB change passed the daylight identity');
});
test('base plain: outside the hidden shape the candle-lit picture is the plain one', () => {
  const h = enc(ring); let worst = 0;
  const Wc = X(spectrumRGB(new Array(16).fill(1), 'candle'));
  for (let i = 0; i < n; i++) if (!ring[i]) worst = Math.max(worst, deltaE(X([h.night[3 * i], h.night[3 * i + 1], h.night[3 * i + 2]]), X(spectrumRGB(plain(i), 'candle')), Wc));
  assert.ok(worst < 0.5, `outside the ring, worst ${worst}`);
});
