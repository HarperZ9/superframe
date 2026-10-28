// moments.test.mjs: directional light from 9 numbers (lib/medium/moments.mjs), the claims of
// docs/prereg/MOMENTS-PREREG.md at a size that runs in seconds.
// Accept: MaxEnt-2 is never negative and beats SH-2 on a compact disc lamp; SH-2 goes negative there.
// Controls: a uniform sky is reproduced by all three (to the quadrature's error); one scene's light read from
// another scene's 9 numbers loses to the isotropic baseline.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sphere, project, shIrradiance, irradiance, maxentFit, maxentRadiance } from '../lib/medium/moments.mjs';

const dirs = sphere(2048), normals = sphere(128);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
// a hard-edged disc lamp: uniform radiance inside a cone (outside MaxEnt-2's exponential family)
const disc = (mu, halfDeg, power) => { const c = Math.cos(halfDeg * Math.PI / 180), om = 2 * Math.PI * (1 - c); return w => (dot(mu, w) >= c ? power / om : 0); };
const scene = (...lamps) => dirs.map(w => lamps.reduce((a, f) => a + f(w), 0));
const rel = (e, t) => Math.sqrt(e.reduce((a, v, i) => a + (v - t[i]) ** 2, 0) / e.length) / Math.sqrt(t.reduce((a, v) => a + v * v, 0) / t.length);
function read(L, c = project(L, dirs)) {
  const truth = normals.map(n => irradiance(L, dirs, n)), fit = maxentFit(c, dirs);
  const Lm = maxentRadiance(fit, dirs);
  return { truth, fit, sh: normals.map(n => shIrradiance(c, n)), me: normals.map(n => irradiance(Lm, dirs, n)), iso: normals.map(() => c[0] / 0.282095 / 4) };
}

test('a compact disc lamp: MaxEnt-2 is positive and closer than SH-2, which goes negative', () => {
  const r = read(scene(disc(norm([0.3, 0.5, 0.8]), 10, 5)));
  assert.ok(r.fit.ok, 'the Newton fit converges');
  assert.ok(Math.min(...r.me) >= 0, 'MaxEnt-2 irradiance is never negative');
  assert.ok(Math.min(...r.sh) < 0, 'SH-2 rings below zero opposite a compact lamp');
  assert.ok(rel(r.me, r.truth) < 0.5 * rel(r.sh, r.truth), `maxent ${rel(r.me, r.truth)} sh ${rel(r.sh, r.truth)}`);
});

test('two lamps on opposite sides: both fit, MaxEnt-2 stays positive', () => {
  const r = read(scene(disc([1, 0, 0], 12, 3), disc([-1, 0, 0], 20, 2)));
  assert.ok(r.fit.ok);
  assert.ok(Math.min(...r.me) >= 0);
  assert.ok(rel(r.me, r.truth) < rel(r.iso, r.truth));
});

test('control: a uniform sky is reproduced by every method, to the quadrature error', () => {
  const r = read(dirs.map(() => 1));
  for (const k of ['sh', 'me', 'iso']) assert.ok(rel(r[k], r.truth) < 1e-3, `${k} ${rel(r[k], r.truth)}`);
});

test('control: light read from another scene\'s 9 numbers loses to the isotropic baseline', () => {
  const L = scene(disc(norm([0, 0.2, 1]), 8, 4)), other = project(scene(disc(norm([0.1, -0.3, -1]), 8, 4)), dirs);
  const r = read(L, other);
  assert.ok(rel(r.me, r.truth) > rel(r.iso, r.truth), `maxent ${rel(r.me, r.truth)} iso ${rel(r.iso, r.truth)}`);
  assert.ok(rel(r.sh, r.truth) > rel(r.iso, r.truth));
});
