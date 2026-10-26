import test from 'node:test';
import assert from 'node:assert/strict';
import { Surface, tip, linear, Grain } from '../index.js';

const lum = (s, x, y) => { const q = s.read(x, y); return (q[0] + q[1] + q[2]) / 3; };

test('a soft dab is full at the centre, zero beyond its radius, and never darkens a white ground', () => {
  const s = new Surface(64, 64).fill(linear('#000000'));
  s.dab(tip('round', { hardness: 0.6 }), 32, 32, { radius: 10, color: linear('#ffffff'), alpha: 1 });
  assert.ok(lum(s, 32, 32) > 0.99, `centre ${lum(s, 32, 32)}`);
  assert.equal(lum(s, 32 + 12, 32), 0);
  const w = new Surface(32, 32).fill([1, 1, 1]);
  w.dab(tip('round', { hardness: 0 }), 16, 16, { radius: 8, color: [1, 1, 1], alpha: 0.5 });
  for (let x = 0; x < 32; x++) assert.ok(lum(w, x, 16) >= 0.999999, 'white over white stays white (linear-light blend)');
});

test('premultiplied source-over matches the closed form', () => {
  const s = new Surface(4, 4).fill([0.2, 0.4, 0.6]);
  s.dab(tip('square', { hardness: 1 }), 2, 2, { radius: 3, color: [1, 0, 0], alpha: 0.25 });
  const q = s.read(2, 2);
  assert.ok(Math.abs(q[0] - (0.25 + 0.2 * 0.75)) < 1e-6 && Math.abs(q[1] - 0.4 * 0.75) < 1e-6 && Math.abs(q[3] - 1) < 1e-6);
});

test('add only adds light, screen never exceeds 1, erase removes coverage', () => {
  const s = new Surface(16, 16).fill([0.3, 0.3, 0.3]);
  s.dab(tip('round', { hardness: 0 }), 8, 8, { radius: 6, color: [0.5, 0.5, 0.5], alpha: 1, mode: 'add' });
  for (let x = 0; x < 16; x++) assert.ok(lum(s, x, 8) >= 0.3 - 1e-9);
  const t = new Surface(16, 16).fill([0.9, 0.9, 0.9]);
  for (let k = 0; k < 20; k++) t.dab(tip('round', { hardness: 0.5 }), 8, 8, { radius: 6, color: [0.9, 0.9, 0.9], alpha: 1, mode: 'screen' });
  assert.ok(lum(t, 8, 8) <= 1 + 1e-9 && lum(t, 8, 8) > 0.99);
  const e = new Surface(16, 16).fill([1, 1, 1]);
  e.dab(tip('square', { hardness: 1 }), 8, 8, { radius: 4, alpha: 1, mode: 'erase', color: [0, 0, 0] });
  assert.equal(e.read(8, 8)[3], 0);
});

test('tilt stretches the footprint along its angle: aspect 3 at angle 0 is three times wider than tall', () => {
  const s = new Surface(80, 80).fill([0, 0, 0]);
  s.dab(tip('round', { hardness: 0.9 }), 40, 40, { radius: 6, aspect: 3, angle: 0, color: [1, 1, 1], alpha: 1 });
  let wx = 0, wy = 0;
  for (let i = 0; i < 80; i++) { if (lum(s, i, 40) > 0.5) wx++; if (lum(s, 40, i) > 0.5) wy++; }
  assert.ok(Math.abs(wx / wy - 3) < 0.35, `ratio ${wx / wy}`);
});

test('a sub-pixel dab keeps its area instead of flickering on and off', () => {
  const a = new Surface(8, 8).fill([0, 0, 0]), b = new Surface(8, 8).fill([0, 0, 0]);
  a.dab(tip('round', { hardness: 0 }), 4, 4, { radius: 0.4, color: [1, 1, 1], alpha: 1 });
  b.dab(tip('round', { hardness: 0 }), 4.37, 4.81, { radius: 0.4, color: [1, 1, 1], alpha: 1 });
  const sum = (s) => { let t = 0; for (let i = 0; i < s.px.length; i += 4) t += s.px[i]; return t; };
  assert.ok(sum(a) > 0 && Math.abs(sum(a) - sum(b)) / sum(a) < 0.35, `${sum(a)} vs ${sum(b)}`);
});

test('no banding: a slow glaze over 2000 px stays smooth in float and the 8-bit export is dithered', () => {
  const W = 2000, s = new Surface(W, 4).fill([0, 0, 0]);
  // a long dark ramp, the case that bands worst in 8-bit (deep shadows, small steps)
  for (let x = 0; x < W; x++) for (let y = 0; y < 4; y++) { const i = (y * W + x) * 4, v = 0.002 + 0.02 * (x / W); s.px[i] = s.px[i + 1] = s.px[i + 2] = v; }
  const d = s.toRGBA8({ dither: true }), n = s.toRGBA8({ dither: false });
  const longestRun = (px) => { let best = 0, run = 1; for (let x = 1; x < W; x++) { if (px[x * 4] === px[(x - 1) * 4]) run++; else { best = Math.max(best, run); run = 1; } } return Math.max(best, run); };
  const plain = longestRun(n), dithered = longestRun(d);
  assert.ok(plain > 60, `control: undithered export should show flat bands, longest run ${plain}`);
  assert.ok(dithered < plain / 4, `dithered longest run ${dithered} vs ${plain}`);
  // and the dither is unbiased: a 64 px box average stays within half a code value of the true ramp
  for (let x0 = 0; x0 < W - 64; x0 += 256) {
    let m = 0; for (let x = x0; x < x0 + 64; x++) m += d[x * 4]; m /= 64;
    let t = 0; for (let x = x0; x < x0 + 64; x++) { const v = 0.002 + 0.02 * (x / W); t += (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255; } t /= 64;
    assert.ok(Math.abs(m - t) < 0.5, `box at ${x0}: ${m} vs ${t}`);
  }
});

test('16-bit export carries values an 8-bit export cannot', () => {
  const s = new Surface(3, 1).fill([0, 0, 0]);
  [0.001, 0.0011, 0.0012].forEach((v, x) => { s.px[x * 4] = s.px[x * 4 + 1] = s.px[x * 4 + 2] = v; });
  const a = s.toRGBA16(), b = s.toRGBA8({ dither: false });
  assert.ok(a[0] < a[4] && a[4] < a[8], 'three distinct 16-bit levels');
  assert.equal(new Set([b[0], b[4], b[8]]).size <= 2, true);
});

// Grain period: the distance at which a texture's autocorrelation first falls below 0.15, against the period asked.
function decorrelation(g) {
  const n = g.size, row = (y) => Array.from({ length: n }, (_, x) => g.at(x, y));
  const lags = [];
  for (let y = 0; y < n; y += Math.max(1, n >> 4)) {
    const r = row(y), m = r.reduce((a, b) => a + b) / n, v = r.reduce((a, b) => a + (b - m) ** 2, 0);
    for (let lag = 1; lag < n / 2; lag++) { let c = 0; for (let x = 0; x < n; x++) c += (r[x] - m) * (r[(x + lag) % n] - m); if (c / v < 0.15) { lags.push(lag); break; } }
  }
  lags.sort((a, b) => a - b); return lags[lags.length >> 1];
}

test('grain features sit at the period asked for (measured reference: 5.9 to 7.8 px), and the tile wraps', () => {
  for (const period of [4, 7, 12]) {
    const g = new Grain({ period, kind: 'paper', seed: 3 }), d = decorrelation(g);
    assert.ok(d >= period * 0.35 && d <= period * 1.1, `period ${period}: decorrelates at ${d}`);
    assert.equal(g.at(-1, -1), g.at(g.size - 1, g.size - 1));
  }
  const g = new Grain({ period: 7 }); let m = 0; for (const v of g.data) m += v; m /= g.data.length;
  assert.ok(Math.abs(m - 0.5) < 0.02, `grain mean ${m}`);
});
