// Bodies: the distance transform is exact, the bevel rises to the stated thickness, reeds add the stated depth.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { edt, fromMask, flute, normalAt, figure, arch, maskFromSdf, sd } from '../lib/body.js';

test('EDT matches brute force on a random mask', () => {
  const w = 23, h = 17, M = new Uint8Array(w * h); let s = 7;
  for (let i = 0; i < M.length; i++) { s = (Math.imul(s, 1103515245) + 12345) >>> 0; M[i] = (s >>> 16) % 5 ? 1 : 0; }
  const D = edt(M, w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = Infinity;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) if (!M[j * w + i]) best = Math.min(best, Math.hypot(i - x, j - y));
    const want = M[y * w + x] ? best : 0;
    assert.ok(Math.abs(D[y * w + x] - want) < 1e-6, `${x},${y}: ${D[y * w + x]} vs ${want}`);
  }
});

test('bevel reaches full thickness inside and stays 0 outside; the normal points up on the flat', () => {
  const w = 80, h = 60, m = maskFromSdf(w, h, (x, y) => sd.box(x, y, 40, 30, 30, 22));
  const b = fromMask(m, w, h, { radius: 8, thickness: 20, soften: 0 });
  assert.ok(Math.abs(b.height[30 * w + 40] - 20) < 1e-6);
  assert.equal(b.height[2 * w + 2], 0);
  assert.ok(normalAt(b, 40, 30)[2] > 0.999);
  assert.ok(normalAt(b, 12, 30)[0] < -0.3, 'the left bevel faces left');
});

test('reeds add a half-sine of the stated depth at the stated pitch, only where asked', () => {
  const w = 64, h = 32, b = { w, h, mask: new Float32Array(w * h).fill(1), height: new Float32Array(w * h) };
  const f = flute(b, { pitch: 16, depth: 4, from: 8 });
  assert.ok(Math.abs(f.height[20 * w + 8] - 4) < 1e-9);
  assert.ok(Math.abs(f.height[20 * w + 16]) < 1e-9);
  assert.equal(f.height[2 * w + 8], 0);
});

test('the figure has an open ring for a head; the arch is solid with wall 0 and open with a wall', () => {
  const w = 200, h = 200, f = figure(w, h, { cx: 0.5, top: 0.1, base: 1 }), u = f.unit;
  assert.ok(f.mask[Math.round(0.1 * h + 1.25 * u) * w + 100] < 0.5, 'the aperture is open');
  assert.ok(f.mask[Math.round(0.1 * h + 6.6 * u) * w + 100] > 0.5, 'the torso is solid');
  assert.ok(arch(w, h, { wall: 0 }).mask[150 * w + 100] > 0.5);
  assert.ok(arch(w, h, { wall: 0.05 }).mask[150 * w + 100] < 0.5);
});
