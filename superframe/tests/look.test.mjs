// look.test.mjs: the shared finishing core (lib/look). Each test names the failure it guards against, and each has a
// control that the old behaviour fails, so a pass cannot come from a test that sees nothing.
import test from 'node:test';
import assert from 'node:assert/strict';
import { displayPixel, agxPixel, bloom, filmGrain, encode8 } from '../lib/look/index.mjs';
import { separate, press, spotThreshold } from '../lib/look/print.mjs';
import { caricature } from '../lib/look/warp.mjs';
import { brushLine } from '../lib/look/ink.mjs';

const hue = ([r, g, b]) => Math.atan2(Math.sqrt(3) * (g - b), 2 * r - g - b);
const pic = (w, h, f) => { const I = { w, h, px: new Float32Array(w * h * 3) }; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) I.px.set(f(x, y), (y * w + x) * 3); return I; };

test('display transform: in-gamut colours pass untouched; over-range light keeps its hue and goes toward white', () => {
  assert.deepEqual(displayPixel(0.83, 0.78, 0.69), [0.83, 0.78, 0.69], 'a palette ground under the knee is exact');
  const hot = [3, 1.2, 0.2], o = displayPixel(...hot);
  assert.ok(Math.max(...o) <= 1 && Math.min(...o) >= 0);
  const clip = hot.map(v => Math.min(1, v));    // control: the per-channel clip the old export did
  assert.ok(Math.abs(hue(clip) - hue(hot)) > 0.15, 'control: clipping shifts the hue');
  assert.ok(o[0] > o[1] && o[1] > o[2], 'channel order (the hue family) is kept');
  // the over-range pixel desaturates toward white instead of plateauing at the clipped colour
  assert.ok(o[2] > clip[2] + 0.2, `blue lifted by the path to white: ${o[2]}`);
  let prev = -1; for (let v = 0; v <= 8; v += 0.05) { const m = displayPixel(v, v * 0.6, v * 0.2)[0]; assert.ok(m >= prev - 1e-9, `monotone at ${v}`); prev = m; }
});

test('AgX: monotone, black stays black, +8 stops stays under 1, a saturated highlight desaturates', () => {
  let prev = -1;
  for (let ev = -14; ev <= 10; ev += 0.25) { const v = agxPixel(0.18 * 2 ** ev, 0.18 * 2 ** ev, 0.18 * 2 ** ev)[1]; assert.ok(v >= prev - 1e-6, `monotone at ${ev} EV`); prev = v; }
  assert.ok(agxPixel(0, 0, 0)[0] < 0.002);
  assert.ok(agxPixel(46, 46, 46)[0] < 1);
  const mid = agxPixel(0.18, 0.18, 0.18)[0]; assert.ok(mid > 0.15 && mid < 0.3, `mid grey ${mid}`);
  const sat = c => (Math.max(...c) - Math.min(...c)) / Math.max(...c);
  assert.ok(sat(agxPixel(64, 16, 2)) < sat(agxPixel(1, 0.25, 0.03)), 'brighter is whiter');
});

test('bloom conserves energy and spreads light round, not boxed', () => {
  const w = 160, h = 160, I = pic(w, h, (x, y) => (Math.hypot(x - 80, y - 80) < 3 ? [8, 6, 3] : [0, 0, 0]));
  const sum = () => I.px.reduce((a, b) => a + b, 0), s0 = sum();
  bloom(I, { strength: 0.4, radius: 24 });
  assert.ok(Math.abs(sum() - s0) / s0 < 1e-3, `energy ${s0} -> ${sum()}`);
  // isotropy: points 40 px away on the axis and on the diagonal receive the same light. Box blurs favour the axes and
  // a too-coarse pyramid level favours the diagonal (the first version measured 23% there; this caught it)
  const at = (x, y) => { const x0 = Math.floor(x - 0.5), y0 = Math.floor(y - 0.5), ax = x - 0.5 - x0, ay = y - 0.5 - y0, g = (X, Y) => I.px[(Y * w + X) * 3]; return (g(x0, y0) * (1 - ax) + g(x0 + 1, y0) * ax) * (1 - ay) + (g(x0, y0 + 1) * (1 - ax) + g(x0 + 1, y0 + 1) * ax) * ay; };
  const ax = at(120, 80), dg = at(80 + 40 * Math.SQRT1_2, 80 + 40 * Math.SQRT1_2);
  assert.ok(ax > 0 && Math.abs(ax - dg) / ax < 0.05, `axis ${ax} vs diagonal ${dg}`);
});

test('film grain: deterministic, visible in the midtones, quiet at paper white and black, mostly monochrome', () => {
  const mk = () => pic(256, 96, (x, y) => { const v = y < 32 ? 0 : y < 64 ? 0.18 : 1; return [v, v, v]; });
  const A = filmGrain(mk(), { amount: 4, size: 1.2, seed: 's' }), B = filmGrain(mk(), { amount: 4, size: 1.2, seed: 's' });
  assert.deepEqual(A.px, B.px);
  const band = (y0, y1, c) => { const v = []; for (let y = y0; y < y1; y++) for (let x = 0; x < 256; x++) v.push(A.px[(y * 256 + x) * 3 + c]); const m = v.reduce((a, b) => a + b) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length); };
  assert.ok(band(32, 64, 1) > 5 * band(64, 96, 1), 'mid grey grain dominates paper white');
  assert.ok(band(32, 64, 1) > 5 * band(0, 32, 1), 'and true black');
  let lum = 0, chr = 0;
  for (let y = 32; y < 64; y++) for (let x = 0; x < 256; x++) { const i = (y * 256 + x) * 3, r = A.px[i], g = A.px[i + 1], b = A.px[i + 2], m = (r + g + b) / 3; lum += (m - 0.18) ** 2; chr += ((r - m) ** 2 + (g - m) ** 2 + (b - m) ** 2) / 3; }
  assert.ok(Math.sqrt(chr / lum) < 0.6, `chroma ratio ${Math.sqrt(chr / lum)}`);
});

test('encode8 dither breaks a shallow ramp into many code transitions (no bands)', () => {
  const w = 512, I = pic(w, 4, x => { const v = 0.2 + 0.02 * x / w; return [v, v, v]; }), o = encode8(I, { seed: 3 });
  let changes = 0; for (let x = 1; x < w; x++) if (o[4 * x] !== o[4 * (x - 1)]) changes++;
  assert.ok(changes > 100, `transitions ${changes} (an undithered ramp this shallow has about 4)`);
});

test('newsprint press: separation round-trips greys, dots cover what they should, frames repeat', () => {
  const s = separate(0.18, 0.18, 0.18); assert.ok(s.K > 0.3 && s.C < 0.2, JSON.stringify(s));
  assert.ok(spotThreshold(0.5) > -0.1 && spotThreshold(0.5) < 0.1);
  const src = () => ({ C: 0.5, M: 0, Y: 0, K: 0 }), A = press(96, 64, src, { register: 0, gain: 0, trap: 0, mottle: 0, showThrough: 0, paperOpts: { fibre: 0, age: 0 } });
  const B = press(96, 64, src, { register: 0, gain: 0, trap: 0, mottle: 0, showThrough: 0, paperOpts: { fibre: 0, age: 0 } });
  assert.deepEqual(A.px, B.px);
  // red channel: cyan absorbs it; mean red should sit near the 50% mix of paper and cyan-on-paper
  let r = 0; for (let i = 0; i < 96 * 64; i++) r += A.px[3 * i]; r /= 96 * 64;
  const paper = 0.78, inked = paper * 0.02, want = 0.5 * paper + 0.5 * inked;
  assert.ok(Math.abs(r - want) < 0.06, `mean red ${r} vs ${want}`);
});

test('caricature warp is the identity outside every feature, and swells inside a bulge', () => {
  const m = caricature({ bulges: [{ x: 50, y: 50, r: 20, k: 0.8 }] });
  assert.deepEqual(m(90, 90), [90, 90]);
  const [sx] = m(60, 50); assert.ok(sx < 60 && sx > 50, 'samples nearer the centre, so the inside reads larger');
});

test('brush line is heavier on the shadow side than the lit side', () => {
  const w = 200, h = 200, D = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) D[y * w + x] = Math.hypot(x + 0.5 - 100, y + 0.5 - 100) - 60;
  const L = brushLine(D, w, h, { width: 10, light: [-0.7, -0.7], swell: 0, dry: 0 });
  const across = (x0, y0, dx, dy) => { let s = 0; for (let t = 40; t < 90; t++) s += L[Math.round(y0 + dy * t) * w + Math.round(x0 + dx * t)]; return s; };
  assert.ok(across(100, 100, 0.707, 0.707) > 1.6 * across(100, 100, -0.707, -0.707), 'lower right (away from the light) is heavier');
});
