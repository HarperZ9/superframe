// The gradient-field poster generator: physics of the colour model, the grain spec, each motif's geometric claim,
// determinism, loop seams, and golden images (QUALITY-SPEC S3, S5, R4, R7).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { poster } from '../gradfield.mjs';
import { metaField, subdivide, wedges } from '../motifs.mjs';
import { cmf, E_WHITE, spectrumToLin, filmReflectance, filmColor, linToOklab, oklabToLin } from '../lib/color.mjs';
import { grain, encode, raster, rng } from '../lib/field.mjs';
import { golden } from '../lib/io.mjs';

const GOLD = new URL('./golden/gradfield.json', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
const MOTIFS = ['capsules', 'spheres', 'wedges', 'metaballs', 'subdivide', 'steps'];
const meanDiff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; };

test('CIE fit: luminance peaks near 555 nm; illuminant E reads pink unbalanced and neutral once balanced', () => {
  assert.ok(E_WHITE[0] > 1.1 && E_WHITE[2] < 0.95, `raw E ${E_WHITE}`);
  let best = 0, at = 0; for (let l = 400; l <= 700; l++) { const y = cmf(l)[1]; if (y > best) { best = y; at = l; } }
  assert.ok(at >= 550 && at <= 565, `peak at ${at}`);
  const W = spectrumToLin(() => 1), m = (W[0] + W[1] + W[2]) / 3;
  for (const c of W) assert.ok(Math.abs(c / m - 1) < 1e-9, `white ${W}`);
});

test('thin film: a soap film thinner than 10 nm is black, a quarter wave reflects most at its own wavelength', () => {
  assert.ok(filmReflectance(550, 5) < 0.002, 'black film');
  const d = 550 / (4 * 1.33), r = l => filmReflectance(l, d);
  assert.ok(r(550) > r(420) && r(550) > r(700), `quarter wave ${r(420)} ${r(550)} ${r(700)}`);
  const c = filmColor(5); assert.ok(Math.max(...c) < 0.01);
});

test('OKLab round trip is exact to 1e-6', () => {
  for (const c of [[0.2, 0.5, 0.9], [1, 1, 1], [0.01, 0.3, 0.02]]) oklabToLin(linToOklab(c)).forEach((v, i) => assert.ok(Math.abs(v - c[i]) < 1e-6));
});

test('grain: unit SD, mono, and a correlation half-width of 1.9 to 3.1 px (QUALITY-SPEC R4)', () => {
  const w = 256, h = 256, G = grain(w, h, { seed: 'g' });
  let s = 0; for (const v of G) s += v * v; assert.ok(Math.abs(Math.sqrt(s / G.length) - 1) < 0.01);
  const ac = lag => { let a = 0, n = 0; for (let y = 0; y < h; y++) for (let x = 0; x + lag < w; x++) { a += G[y * w + x] * G[y * w + x + lag]; n++; } return a / n; };
  let lag = 0; while (ac(lag + 1) > 0.5) lag++; const half = lag + (ac(lag) - 0.5) / (ac(lag) - ac(lag + 1));
  assert.ok(2 * half >= 1.9 && 2 * half <= 3.1, `full width at half correlation ${2 * half}`);
});

test('determinism: every motif renders the same floats twice (S3)', () => {
  for (const motif of MOTIFS) { const a = poster({ motif, w: 96, h: 120, seed: 'det' }), b = poster({ motif, w: 96, h: 120, seed: 'det' }); assert.deepEqual(Buffer.from(a.px.buffer), Buffer.from(b.px.buffer), motif); }
});

test('loops: t = 0.999 sits next to t = 0, far closer than t = 0.5 does', () => {
  for (const motif of MOTIFS) {
    const a = poster({ motif, w: 96, h: 120, seed: 'loop', t: 0 }).px, z = poster({ motif, w: 96, h: 120, seed: 'loop', t: 0.999 }).px, m = poster({ motif, w: 96, h: 120, seed: 'loop', t: 0.5 }).px;
    const near = meanDiff(a, z), far = meanDiff(a, m);
    assert.ok(near < 0.002 && (far === 0 || near < far / 5), `${motif} near ${near} far ${far}`);
  }
});

test('metaballs: two equal balls join at the midpoint exactly when closer than 2 sqrt 2 radii', () => {
  const r = 10, at = D => metaField([{ x: 0, y: 0, r }, { x: D, y: 0, r }], D / 2, 0)[0];
  assert.ok(at(2 * Math.SQRT2 * r * 0.98) > 1 && at(2 * Math.SQRT2 * r * 1.02) < 1);
});

test('subdivide: the leaves tile the sheet with no overlap', () => {
  const w = 300, h = 380, R = raster(w, h), leaves = subdivide(R, { w, h, r: rng('tile'), lut: new Float32Array(30).fill(0.5), unit: 1, span: 0.5, t: 0 }, {});
  const m = 0.07 * Math.min(w, h); let area = 0; for (const [a, b, c, d] of leaves) area += (c - a) * (d - b);
  assert.ok(Math.abs(area - (w - 2 * m) * (h - 2 * m)) < 1e-6 && leaves.length >= 4);
  for (let i = 0; i < leaves.length; i++) for (let j = i + 1; j < leaves.length; j++) { const [a, b, c, d] = leaves[i], [e, f, g, k] = leaves[j]; assert.ok(Math.max(0, Math.min(c, g) - Math.max(a, e)) * Math.max(0, Math.min(d, k) - Math.max(b, f)) < 1e-9); }
});

test('wedges: each cut edge lies on the illusory polygon, ground inside and disc outside', () => {
  const w = 600, h = 600, ground = [0.6, 0.6, 0.6], R = raster(w, h, ground), lut = new Float32Array(3 * 64).fill(0.05);
  const V = wedges(R, { w, h, r: rng('k'), lut, unit: 1, span: 0.5, t: 0, ground: '#808080' }, { n: 5 }), rd = 0.13 * 600;
  for (let i = 0; i < 5; i++) {
    const [ax, ay] = V[i], [bx, by] = V[(i + 1) % 5], L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / L, uy = (by - ay) / L;
    const cx = w / 2 - ax, cy = h / 2 + 12 - ay, side = Math.sign(-uy * cx + ux * cy), px = ax + ux * rd * 0.6, py = ay + uy * rd * 0.6;
    const at = s => R.px[3 * (Math.round(py + s * side * ux) * w + Math.round(px - s * side * uy))];
    assert.ok(at(6) > 0.5, `vertex ${i}: inside the polygon is ground`);
    assert.ok(at(-6) < 0.1, `vertex ${i}: outside the edge is disc`);
  }
});

test('golden images: each motif at 192 x 240 with grain matches its golden (S5: mean SSIM >= 0.995)', () => {
  for (const motif of MOTIFS) {
    const R = poster({ motif, w: 192, h: 240, seed: 'gold' }), px = encode(R, { grainSd: R.grainSd, seed: 'gold' }), g = golden(GOLD, motif, px, 192, 240);
    assert.ok(g.mean >= 0.995 && g.chroma <= 0.02, `${motif} ssim ${g.mean} chroma ${g.chroma}`);
  }
});

test('budget: each motif renders 1024 x 1280 in under 4 s in node (S4)', () => {
  for (const motif of MOTIFS) { const t0 = performance.now(); poster({ motif, w: 1024, h: 1280, seed: 'bench' }); const ms = performance.now() - t0; assert.ok(ms < 4000, `${motif} ${ms} ms`); }
});

test('spheres: the halftone screen pitch is recovered within 8% of the set 9 px (QUALITY-SPEC R7)', () => {
  const w = 1024, R = poster({ motif: 'spheres', w, h: w, seed: 'pitch', spheres: { n: 3, halftone: 1 } }), S = w * 0.86, cell = S / 3, cx = (w - S) / 2 + cell * 1.5, cy = (w - S) / 2 + cell * 1.5;
  const a = 15 * Math.PI / 180, N = 200, line = [];
  const L = (x, y) => { const k = 3 * (y * w + x); return R.px[k] + R.px[k + 1] + R.px[k + 2]; };
  for (let s = 0; s < N; s++) { const x = cx - 90 + s * Math.cos(a), y = cy + 40 + s * Math.sin(a), i = Math.floor(x), j = Math.floor(y), u = x - i, v = y - j; line.push(L(i, j) * (1 - u) * (1 - v) + L(i + 1, j) * u * (1 - v) + L(i, j + 1) * (1 - u) * v + L(i + 1, j + 1) * u * v); }
  const hp = line.map((v, i) => { let m = 0, n = 0; for (let j = Math.max(0, i - 6); j <= Math.min(N - 1, i + 6); j++) { m += line[j]; n++; } return v - m / n; });
  const ac = lag => { let c = 0; for (let i = 0; i + lag < N; i++) c += hp[i] * hp[i + lag]; return c / (N - lag); };
  let at = 5; for (let lag = 5; lag <= 16; lag++) if (ac(lag) > ac(at)) at = lag;
  const y0 = ac(at - 1), y1 = ac(at), y2 = ac(at + 1), peak = at + 0.5 * (y0 - y2) / (y0 - 2 * y1 + y2);
  assert.ok(Math.abs(peak - 9) / 9 <= 0.08, `pitch ${peak}`);
});
