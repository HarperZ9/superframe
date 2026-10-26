import test from 'node:test';
import assert from 'node:assert/strict';
import { grade, curve, DEFAULTS } from '../film.mjs';
import { raster } from '../../../feed-29/build/lib/field.mjs';
import { toSrgb, toLin } from '../../../feed-29/build/lib/color.mjs';

const NOGRAIN = { grain: { sd: 0 }, flicker: 0, halation: { strength: 0 } };
const code = v => toSrgb(Math.max(0, Math.min(1, v))) * 255;
// CIELAB (D65) from 8-bit-scale sRGB, for comparing with the Python measurement (OpenCV float Lab).
function lab([r, g, b]) {
  const [R, G, B] = [r, g, b].map(v => toLin(v / 255));
  const X = (0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047, Y = 0.2126 * R + 0.7152 * G + 0.0722 * B, Z = (0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883;
  const f = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}
const ramp = (w = 256, h = 8) => { const R = raster(w, h); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 3; c++) R.px[3 * (y * w + x) + c] = toLin(x / (w - 1)); return R; };

test('curve hits the measured black and white points and is monotonic', () => {
  const b = 17.5 / 255, wv = 217 / 255;
  assert.ok(Math.abs(curve(0, b, wv, 1.1, 1.12) - b) < 1e-9);
  assert.ok(Math.abs(curve(1, b, wv, 1.1, 1.12) - wv) < 1e-9);
  let prev = -1; for (let i = 0; i <= 100; i++) { const v = curve(i / 100, b, wv, 1.1, 1.12); assert.ok(v >= prev); prev = v; }
});

test('a neutral ramp lands on the KEY black and white points within 4 code values', () => {
  const G = grade(ramp(), NOGRAIN), lo = [0, 1, 2].map(c => code(G.px[c])), hi = [0, 1, 2].map(c => code(G.px[3 * 255 + c]));
  DEFAULTS.black.forEach((v, c) => assert.ok(Math.abs(lo[c] - v) < 4, `black ${c}: ${lo[c]} vs ${v}`));
  DEFAULTS.white.forEach((v, c) => assert.ok(Math.abs(hi[c] - v) < 4, `white ${c}: ${hi[c]} vs ${v}`));
});

test('split tone: graded neutrals fall in the measured hue bands (shadows ~98, highlights ~94 degrees)', () => {
  const G = grade(ramp(), NOGRAIN), bands = { sh: [], hl: [] };
  for (let x = 0; x < 256; x++) { const L = lab([0, 1, 2].map(c => code(G.px[3 * x + c]))); if (L[0] < 25) bands.sh.push(L); else if (L[0] > 75) bands.hl.push(L); }
  const tint = a => { const A = a.reduce((s, v) => s + v[1], 0) / a.length, B = a.reduce((s, v) => s + v[2], 0) / a.length; return { hue: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360, chroma: Math.hypot(A, B) }; };
  const s = tint(bands.sh), h = tint(bands.hl);
  assert.ok(h.hue > 79 && h.hue < 109, `highlight hue ${h.hue}`);
  assert.ok(h.chroma > 26 && h.chroma < 46, `highlight chroma ${h.chroma} (KEY 35.8)`);
  assert.ok(s.hue > 60 && s.hue < 125, `shadow hue ${s.hue}`);
  assert.ok(s.chroma > 3 && s.chroma < 16, `shadow chroma ${s.chroma} (KEY 8.5)`);
});

test('halation adds a warm fringe that fades with distance, and nothing when off', () => {
  const w = 200, h = 200, R = raster(w, h, [0.02, 0.02, 0.02]);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (Math.hypot(x - 100, y - 100) < 12) R.px.fill(1, 3 * (y * w + x), 3 * (y * w + x) + 3);
  const rb = (G, r) => { let s = 0, n = 0; for (let a = 0; a < 64; a++) { const x = Math.round(100 + r * Math.cos(a / 10)), y = Math.round(100 + r * Math.sin(a / 10)); s += code(G.px[3 * (y * w + x)]) - code(G.px[3 * (y * w + x) + 2]); n++; } return s / n; };
  const on = grade(R, { grain: { sd: 0 }, flicker: 0 }), off = grade(R, NOGRAIN);
  assert.ok(rb(on, 16) - rb(off, 16) > 8, `near fringe ${rb(on, 16) - rb(off, 16)}`);
  assert.ok(rb(on, 16) - rb(off, 16) > rb(on, 60) - rb(off, 60), 'fringe falls off');
});

test('grain: amplitude near the declared sd, clumped (lag-1 correlation 0.6 to 0.95), deterministic, new per frame', () => {
  const w = 256, h = 256, R = raster(w, h, [0.18, 0.18, 0.18]), P = { grain: { sd: 3, chroma: 0 }, flicker: 0, halation: { strength: 0 } };
  const a = grade(R, P, { seed: 's', frame: 3 }), b = grade(R, P, { seed: 's', frame: 3 }), c = grade(R, P, { seed: 's', frame: 4 });
  assert.deepEqual(a.px, b.px); assert.notDeepEqual(a.px, c.px);
  const g = Float64Array.from({ length: w * h }, (_, i) => code(a.px[3 * i + 1])), m = g.reduce((s, v) => s + v, 0) / g.length;
  const sd = Math.sqrt(g.reduce((s, v) => s + (v - m) ** 2, 0) / g.length);
  let num = 0; for (let y = 0; y < h; y++) for (let x = 0; x + 1 < w; x++) num += (g[y * w + x] - m) * (g[y * w + x + 1] - m);
  const r1 = num / (h * (w - 1)) / (sd * sd);
  assert.ok(sd > 2.2 && sd < 3.6, `sd ${sd}`);
  assert.ok(r1 > 0.6 && r1 < 0.95, `lag-1 ${r1}`);
});

test('weave moves the frame by about the declared rms', () => {
  const w = 96, h = 96, R = raster(w, h, [0, 0, 0]);
  for (let y = 40; y < 56; y++) for (let x = 40; x < 56; x++) R.px.fill(1, 3 * (y * w + x), 3 * (y * w + x) + 3);
  let s2 = 0; const N = 40;
  for (let f = 0; f < N; f++) {
    const G = grade(R, { ...NOGRAIN, weave: 1, black: [0, 0, 0], white: [255, 255, 255], shoulder: 0, toe: 1, shadowTint: [0, 0], highlightTint: [0, 0], sat: 1 }, { frame: f });
    let sx = 0, sw = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = G.px[3 * (y * w + x)]; sx += v * x; sw += v; }
    s2 += (sx / sw - 47.5) ** 2;
  }
  const rms = Math.sqrt(s2 / N); assert.ok(rms > 0.6 && rms < 1.5, `rms ${rms}`);
});
