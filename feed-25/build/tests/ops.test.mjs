// Operators: each test states the property the operator must keep.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Layer, layer, noise, enc } from '../compose.mjs';

const grey = (w, h, f) => { const L = new Layer(w, h, { seed: 5 }); for (let i = 0; i < w * h; i++) { const v = f(i % w, (i / w) | 0); L.px[3 * i] = L.px[3 * i + 1] = L.px[3 * i + 2] = v; } return L; };
const ramp = () => grey(64, 16, (x) => x / 63);

test('posterize leaves exactly `levels` distinct values on a full ramp', () => {
  const L = ramp().posterize({ levels: 5 }), vals = new Set(Array.from(L.px, (v) => Math.round(enc(v) * 1000)));
  assert.equal(vals.size, 5);
});

test('duotone maps black to the dark ink and white to the light ink', () => {
  const L = ramp().duotone('#102030', '#e0d0c0');
  assert.ok(Math.abs(enc(L.px[0]) - 0x10 / 255) < 0.004); assert.ok(Math.abs(enc(L.px[3 * 63 + 2]) - 0xc0 / 255) < 0.004);
});

test('invert twice is the identity within the 16-bit table', () => {
  const a = noise(32, 32, { seed: 2 }), b = a.clone().invert().invert();
  for (let i = 0; i < a.px.length; i++) assert.ok(Math.abs(enc(a.px[i]) - enc(b.px[i])) < 2e-4);
});

test('blur keeps the mean of the layer', () => {
  const a = noise(48, 48, { seed: 4 }), b = a.clone().blur({ r: 3 }), m = (L) => L.px.reduce((s, v) => s + v, 0) / L.px.length;
  assert.ok(Math.abs(m(a) - m(b)) < 0.01);
});

test('mask with a threshold gives a binary alpha', () => {
  const L = ramp().mask({ by: (u) => u, t: 0.5 }); assert.deepEqual([...new Set(L.a)].sort(), [0, 1]);
});

test('pixelate makes every block one colour', () => {
  const L = noise(64, 64, { seed: 9 }).pixelate({ size: 8 });
  for (let by = 0; by < 64; by += 8) for (let bx = 0; bx < 64; bx += 8) for (let y = by; y < by + 8; y++) for (let x = bx; x < bx + 8; x++) assert.equal(L.px[3 * (y * 64 + x)], L.px[3 * (by * 64 + bx)]);
});

test('modulatePixelate uses big blocks where the field is 0 and small where it is 1', () => {
  const count = (L) => new Set(L.px).size;
  const big = noise(64, 64, { seed: 3 }).modulatePixelate({ by: () => 0, min: 4, max: 32 }), small = noise(64, 64, { seed: 3 }).modulatePixelate({ by: () => 1, min: 4, max: 32 });
  assert.ok(count(big) <= 4 * 3); assert.ok(count(small) > 4 * count(big));
});

test('mosh with carry 0 changes nothing; with carry 1 it moves pixels', () => {
  const a = noise(64, 64, { seed: 6 }); assert.deepEqual(a.clone().mosh({ carry: 0 }).px, a.px);
  assert.notDeepEqual(a.clone().mosh({ carry: 1, block: 8, strength: 2 }).px, a.px);
});

test('mosh with `from` carries the other layer texture', () => {
  const a = noise(64, 64, { seed: 6 }), b = layer(64, 64, { fill: '#ff0000' }), m = a.clone().mosh({ carry: 0.5, from: b });
  assert.ok(m.px[0] > 0.9 && m.px[1] < 0.01);
});

test('scanwave with zero amplitude and no dimming is the identity', () => {
  const a = noise(48, 48, { seed: 8 }), b = a.clone().scanwave({ amp: 0, dim: 1 });
  for (let i = 0; i < a.px.length; i++) assert.ok(Math.abs(a.px[i] - b.px[i]) < 1e-6);
});

test('operators are deterministic under the layer seed', () => {
  const run = () => noise(64, 64, { seed: 1 }).blocks({ count: 20 }).streak({ count: 50, figure: 0 }).lines({ count: 3 }).px;
  assert.deepEqual(run(), run());
});

test('place: multiply and screen follow their formulas in linear light', () => {
  const S = layer(1, 1, { fill: [0.5, 0.5, 0.5] }); S.place(layer(1, 1, { fill: [0.4, 0.4, 0.4] }), 0, 0, { mode: 'multiply' }); assert.ok(Math.abs(S.px[0] - 0.2) < 1e-6);
  const T = layer(1, 1, { fill: [0.5, 0.5, 0.5] }); T.place(layer(1, 1, { fill: [0.4, 0.4, 0.4] }), 0, 0, { mode: 'screen' }); assert.ok(Math.abs(T.px[0] - 0.7) < 1e-6);
});

test('mosaic tiles cover the span with no seam or overlap', () => {
  const S = layer(100, 40, { fill: '#000000' }); S.mosaic({ x: 3, y: 2, pitch: 7.4, cols: 13, rows: 3, fill: () => '#ffffff' });
  const t = S.meta.tiles; assert.equal(t.length, 39);
  const row = t.filter((q) => q.j === 0); assert.equal(row.reduce((s, q) => s + q.w, 0), Math.round(3 + 13 * 7.4) - 3);
  for (let k = 1; k < row.length; k++) assert.equal(row[k].x, row[k - 1].x + row[k - 1].w);
});

test('soft posterize keeps flat values on the levels and ramps only near a boundary', () => {
  const L = new Layer(64, 1, { seed: 1 }); for (let x = 0; x < 64; x++) L.px[3 * x] = L.px[3 * x + 1] = L.px[3 * x + 2] = x / 63;
  const H = L.clone().posterize({ levels: 5 }), S = L.clone().posterize({ levels: 5, soft: 0.15 });
  let same = 0; for (let x = 0; x < 64; x++) if (Math.abs(enc(H.px[3 * x]) - enc(S.px[3 * x])) < 1e-3) same++;
  assert.ok(same > 32 && same < 64, `same ${same}`);
});
