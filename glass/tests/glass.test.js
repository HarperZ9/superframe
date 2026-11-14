// Glass: refraction moves what is behind; caustics move energy without creating it; dispersion splits channels.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderGlass, opticsField, causticMap, displacementMap, fromMask, maskFromSdf, sd } from '../glass.js';
import { raster } from '../lib/raster.js';

const W = 96, H = 64;
const stripes = () => { const R = raster(W, H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = (x >> 2) & 1 ? 0.8 : 0.1; R.data.set([v, v, v, 1], (y * W + x) * 4); } return R; };
const lens = () => fromMask(maskFromSdf(W, H, (x, y) => sd.circle(x, y, 48, 32, 22)), W, H, { radius: 22, thickness: 18, soften: 0 });

test('outside the body the background passes untouched (no caustic), inside it is changed', () => {
  const bg = stripes(), out = renderGlass(bg, lens(), { caustic: null });
  for (const i of [0, 5 * W + 3, (H - 1) * W + W - 1]) for (let c = 0; c < 3; c++) assert.equal(out.data[i * 4 + c], bg.data[i * 4 + c]);
  let d = 0; for (let y = 22; y < 42; y++) for (let x = 38; x < 58; x++) d += Math.abs(out.data[(y * W + x) * 4] - bg.data[(y * W + x) * 4]);
  assert.ok(d > 5);
});

test('a convex lens pulls rays inward (magnifies) and blue is pulled further than red', () => {
  const b = lens(), f = opticsField(b, { glass: 'dense', gap: 60 }), i = 32 * W + 36;
  assert.ok(f.off[i * 6 + 2] > 0, 'left of centre samples toward the centre');
  assert.ok(Math.abs(f.off[i * 6 + 4]) > Math.abs(f.off[i * 6]), 'blue offset exceeds red');
});

test('caustics conserve energy: the map sums to the open-ground total within 3% (the rest leaves the frame or is trapped)', () => {
  const b = lens(), o = { glass: 'crown', gap: 40, tint: '#ffffff', density: 0, caustic: { blur: 0 } };
  const f = opticsField(b, o); for (let i = 0; i < f.F.length; i++) f.F[i] = 0;
  const C = causticMap(b, f, o); let s = 0; for (let i = 0; i < W * H; i++) s += C[i * 3 + 1];
  assert.ok(Math.abs(s / (W * H) - 1) < 0.03, `mean irradiance ${s / (W * H)}`);
  let mx = 0; for (let i = 0; i < W * H; i++) mx = Math.max(mx, C[i * 3 + 1]); assert.ok(mx > 1.5, 'light gathers into a caustic');
});

test('the displacement map is neutral outside and reports the channel spread', () => {
  const d = displacementMap(lens(), { glass: 'dense', gap: 60 }, 48);
  assert.equal(d.rgba[0], 128); assert.equal(d.rgba[1], 128);
  assert.ok(d.spread.b > 1 && d.spread.r < 1);
});
