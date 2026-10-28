// value.test.mjs: the value budget (lib/value). PREREG in lib/value/README.md: P1, P1s, P1n, P2, P3, and the physics
// the ceiling rests on (diffuse radiance never exceeds it; caustic flux is conserved; two Fresnel forms agree).
import test from 'node:test';
import assert from 'node:assert/strict';
import { curve, xAt, mapPixel, toDisplay, D_W, lumOf } from '../lib/value/tone.mjs';
import { whiteOnWhite } from '../lib/value/presets.mjs';
import { render, ggxKey } from '../lib/value/trace.mjs';
import { causticMap, causticFlux } from '../lib/value/caustic.mjs';
import { fresnelDielectric, diffuseCeiling, keyIrradiance } from '../lib/value/scene.mjs';
import { fresnelConductor } from '../lib/value/gold.mjs';
import { specLabels, whiteCheck, shuffleLabels, uniformField } from '../lib/value/measure.mjs';
import { runValue, runDark } from '../lib/value/run.mjs';

test('P3: the curve is d_w x up to the ceiling, reaches 0.95 at 1 + ln4 / 4, and is monotonic toward 1', () => {
  for (const x of [0.25, 0.5, 1]) assert.ok(Math.abs(curve(x) - D_W * x) < 1e-9);
  assert.ok(Math.abs(xAt(0.95) - (1 + Math.log(4) / 4)) < 1e-12 && Math.abs(curve(xAt(0.95)) - 0.95) < 1e-12);
  let p = -1; for (let x = 0; x < 40; x += 0.005) { assert.ok(curve(x) >= p); p = curve(x); }
  assert.ok(curve(1e6) <= 1 && curve(1e6) > 0.999999);
});
test('mapped colour keeps the curve\'s luminance and stays inside [0, 1]', () => {
  for (const c of [[3, 1, 0.2], [0.5, 0.5, 0.5], [10, 0, 0], [0.1, 0.9, 2]]) {
    const o = mapPixel(...c, 1); assert.ok(o.every(v => v >= -1e-12 && v <= 1 + 1e-12));
    assert.ok(Math.abs(lumOf(...o) - curve(lumOf(...c))) < 1e-6, JSON.stringify(c));
  }
});
test('physics: every pixel\'s diffuse-origin radiance stays under the ceiling', () => {
  const s = whiteOnWhite({ caustics: false, shadowSamples: 4 }), img = render(s, { w: 120, h: 75, ss: 1 });
  for (let i = 0; i < 120 * 75; i++) assert.ok(lumOf(img.dif[3 * i], img.dif[3 * i + 1], img.dif[3 * i + 2]) <= s.C);
  assert.equal(s.C, diffuseCeiling(s));
});
test('physics: the caustic carries the flux the glass intercepts, times (1 - F)^2, within 3%', () => {
  const s = { ground: { rho: 0.8 }, env: 0, light: { p: [0, 30, 0], r: 0.3, Le: 1000 }, spheres: [{ c: [0, 1, 0], r: 1, mat: 'glass', ior: 1.5 }] };
  const map = causticMap(s, { n: 200000 }), Eperp = Math.PI * 1000 * 0.09 / 29 ** 2;
  let T = 0; const N = 4000; for (let k = 0; k < N; k++) { const b = (k + 0.5) / N, F = fresnelDielectric(Math.sqrt(1 - b * b), 1 / 1.5); T += (1 - F) ** 2 * 2 * b / N; }
  const want = Eperp * Math.PI * T; assert.ok(Math.abs(causticFlux(map) - want) / want < 0.03, `${causticFlux(map)} vs ${want}`);
});
test('two Fresnel forms agree: the dielectric one, and the conductor one at k = 0', () => {
  for (let c = 0.02; c <= 1; c += 0.07) assert.ok(Math.abs(fresnelDielectric(c, 1 / 1.5) - fresnelConductor(c, 1.5, 0)) < 1e-9);
});
test('P1: above 0.95, pixels are specular at least 95% of the time; the plain clamp and shuffled labels fail', () => {
  const V = runValue({ w: 240, h: 150, ss: 2, photons: 50000 });
  assert.ok(V.P1.bright > 0 && V.P1.share >= 0.95, JSON.stringify(V.P1));
  assert.ok(V.P1c.share < 0.5, JSON.stringify(V.P1c));
  assert.ok(V.P1s.share < 0.5, JSON.stringify(V.P1s));
});
test('P1n: a structureless field has no pixel above 0.95 and no pass', () => {
  const r = whiteCheck(uniformField(32, 32, 0.8), new Uint8Array(1024)); assert.equal(r.bright, 0); assert.equal(r.pass, false); assert.equal(r.share, null);
  const all = whiteCheck(uniformField(8, 8, 1), new Uint8Array(64).fill(1)); assert.equal(all.pass, true);   // the checker can say yes
});
test('false accept: shuffling labels keeps their count and breaks their place', () => {
  const L = new Uint8Array(1000); for (let i = 0; i < 30; i++) L[i] = 1; const S = shuffleLabels(L);
  assert.equal(S.reduce((a, b) => a + b, 0), 30); assert.ok(S.slice(0, 30).reduce((a, b) => a + b, 0) < 5);
});
test('P2: one source in a dark field leaves half the frame below L* 25; the flat control does not', () => {
  const D = runDark({ w: 160, h: 100, ss: 1, photons: 30000 });
  assert.ok(D.P2.dark >= 0.5 && D.P2.white <= 0.01, JSON.stringify({ dark: D.P2.dark, white: D.P2.white }));
  assert.ok(D.P2c.dark < 0.1, `${D.P2c.dark}`);
  assert.ok(D.P2.check.bright > 0 && D.P2.check.share >= 0.95, JSON.stringify(D.P2.check));   // PREREG P2: >= 95% of the white pixels specular
});
test('the plain clamp puts diffuse pixels at 1.0, the budget never does', () => {
  const s = whiteOnWhite({ caustics: false, shadowSamples: 2 }), img = render(s, { w: 96, h: 60, ss: 1 }), L = specLabels(img);
  const b = toDisplay(img, { C: s.C }), c = toDisplay(img, { mode: 'clamp' });
  const diffuseWhite = d => { let n = 0; for (let i = 0; i < L.length; i++) if (!L[i] && d.rgba[4 * i + 1] >= 254) n++; return n; };
  assert.equal(diffuseWhite(b), 0); assert.ok(diffuseWhite(c) > 0);
});
test('physics: a near-mirror coat highlight peak tends to the mirror radiance F x L_e (within 10%)', () => {
  const sc = { light: { p: [0, 10, 0], r: 0.5, Le: 100 } }, E = keyIrradiance(sc, [0, 0, 0], [0, 1, 0]);
  const peak = ggxKey(sc, [0, 0, 0], [0, 1, 0], [0, 1, 0], 0.001, 1.5, E), mirror = fresnelDielectric(1, 1 / 1.5) * 100;
  assert.ok(Math.abs(peak - mirror) / mirror < 0.1, `${peak} vs ${mirror}`);
});
