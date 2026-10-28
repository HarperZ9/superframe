// stack-still.test.mjs: the living still and its grain law (PREREG P5 counter, P6, P7 in lib/stack/README.md).
// The motion-lens half of P5 runs on a rendered clip: tools/stack-clip.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { livingStill, uniqueRate, shotGrain, flatGrain, noiseSlope, poisson } from '../lib/stack/still.mjs';
import { frame } from '../lib/stack/frame.mjs';
import { rngFrom } from '../lib/seed.mjs';

const plate = () => { const F = frame(64, 36, [0.05, 0.06, 0.1]); for (let i = 0; i < 64 * 18; i++) F.px.set([0.4, 0.3, 0.2], 3 * i); return F; };

test('P5 counter: grain re-rolled every 2 frames at 30 fps reads 15 Hz unique', () => {
  assert.equal(uniqueRate(livingStill(plate(), { hold: 2 }), 61, 30), 15);
});
test('P5 resolution: holds of 1 and 3 read 30 and 10 Hz', () => {
  assert.equal(uniqueRate(livingStill(plate(), { hold: 1 }), 61, 30), 30);
  assert.equal(uniqueRate(livingStill(plate(), { hold: 3 }), 61, 30), 10);
});
test('P5 control and P7: frozen grain reads 0 Hz', () => {
  assert.equal(uniqueRate(livingStill(plate(), { hold: 2, grain: 0 }), 61, 30), 0);
});

const greys = [0.05, 0.1, 0.2, 0.3, 0.45, 0.6, 0.8, 1.0];
const varOf = F => { let s = 0, q = 0, n = F.px.length; for (const v of F.px) { s += v; q += v * v; } return [s / n, q / n - (s / n) ** 2]; };

test('P6: shot-noise grain variance rises as s / N (slope within 5%)', () => {
  const N = 400, pts = greys.map(g => varOf(shotGrain(frame(128, 128, [g, g, g]), { N, seed: `p6/${g}` })));
  const slope = noiseSlope(pts);
  assert.ok(Math.abs(slope * N - 1) < 0.05, `slope x N = ${slope * N}`);
});
test('P6 control: signal-independent grain shows no slope', () => {
  const N = 400, pts = greys.map(g => varOf(flatGrain(frame(128, 128, [g, g, g]), { sigma: Math.sqrt(0.45 / N), seed: `c6/${g}` })));
  assert.ok(Math.abs(noiseSlope(pts)) < 0.1 / N, `flat grain slope x N = ${noiseSlope(pts) * N}`);
});
test('poisson sampler: mean and variance equal lambda on both branches', () => {
  for (const lam of [0.7, 12, 80, 300]) {
    const r = rngFrom(`pois/${lam}`); let s = 0, q = 0; const n = 40000;
    for (let i = 0; i < n; i++) { const k = poisson(lam, r); s += k; q += k * k; }
    const m = s / n, v = q / n - m * m;
    assert.ok(Math.abs(m - lam) / lam < 0.02 && Math.abs(v - lam) / lam < 0.05, `lam ${lam}: mean ${m} var ${v}`);
  }
});
