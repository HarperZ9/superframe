// Export, grain and determinism (QUALITY-SPEC R4, S3).
import test from 'node:test';
import assert from 'node:assert/strict';
import { layer, sheet, grainField, rng } from '../compose.mjs';

const stdOf = (o, n, c = 0) => { let s = 0, s2 = 0; for (let i = 0; i < n; i++) { const v = o[4 * i + c]; s += v; s2 += v * v; } const m = s / n; return Math.sqrt(s2 / n - m * m); };

test('per-pixel grain lands at the requested std (in code values)', () => {
  const L = layer(256, 256, { fill: '#808080', seed: 3 }), o = L.out({ grain: { std: 0.015 } });
  assert.ok(Math.abs(stdOf(o, 256 * 256) - 0.015 * 255) < 0.35, `got ${stdOf(o, 256 * 256)}`);
});

test('sized grain keeps its std and is correlated over its size', () => {
  const g = grainField(256, 256, 6, rng(1)); let s2 = 0, c1 = 0;
  for (let i = 0; i < g.length; i++) s2 += g[i] * g[i];
  for (let y = 0; y < 256; y++) for (let x = 0; x < 255; x++) c1 += g[y * 256 + x] * g[y * 256 + x + 1];
  assert.ok(Math.abs(s2 / g.length - 1) < 1e-3); assert.ok(c1 / s2 > 0.6, `lag-1 correlation ${c1 / s2}`);
});

test('mono grain moves the three channels together', () => {
  const o = layer(64, 64, { fill: '#808080', seed: 2 }).out({ grain: { std: 0.03 } });
  let same = 0; for (let i = 0; i < 64 * 64; i++) if (Math.abs(o[4 * i] - o[4 * i + 2]) <= 2) same++;
  assert.ok(same / (64 * 64) > 0.95);
});

test('16-bit export spans 0..65535 and keeps the 8-bit picture', () => {
  const L = layer(4, 1, { fill: '#000000' }); L.px.set([1, 1, 1], 9);
  const o16 = L.out({ depth: 16, dither: false }), o8 = L.out({ dither: false });
  assert.ok(o16 instanceof Uint16Array); assert.equal(o16[0], 0); assert.equal(o16[12], 65535); assert.equal(o8[12], 255);
});

test('same seed, same bytes; another seed, other bytes', () => {
  const a = sheet(96, 96, { seed: 4 }).out({ grain: { std: 0.02 } }), b = sheet(96, 96, { seed: 4 }).out({ grain: { std: 0.02 } }), c = sheet(96, 96, { seed: 5 }).out({ grain: { std: 0.02 } });
  assert.deepEqual(a, b); assert.notDeepEqual(a, c);
});

test('sheet mat is 5% and the unit is a thousandth of the inner width', () => {
  const S = sheet(1000, 1000); assert.deepEqual(S.inner, { x: 50, y: 50, w: 900, h: 900 }); assert.equal(S.u, 0.9);
});

test('run(recipe) equals the same chain written by hand, and rejects unknown names', async () => {
  const { run, chladni } = await import('../compose.mjs');
  const a = run({ size: [48, 48], seed: 3, source: ['chladni', { n: 2, m: 3 }], ops: [['posterize', { levels: 4 }], ['mosh', { block: 8 }]] });
  const b = chladni(48, 48, { n: 2, m: 3, seed: 3 }).posterize({ levels: 4 }).mosh({ block: 8 });
  assert.deepEqual(a.px, b.px);
  assert.throws(() => run({ source: ['nope', {}] })); assert.throws(() => run({ ops: [['nope']] }));
});
