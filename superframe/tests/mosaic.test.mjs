// mosaic.test.mjs: lib/mosaic, the one tile and marks library. The bedrock laws are checked by the two readouts CORE.md
// names: a Gaussian eye returns the source tone within a stated error, and the noise spectrum has the right shape
// (blue for error diffusion and void-and-cluster, a lattice for Bayer, a peak at the screen angle for AM). A white-
// noise threshold is the false-success control: it must fail both.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../lib/mosaic/index.mjs';

const W = 256, H = 256, N = 128;
const ramp = new Float32Array(W * H); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ramp[y * W + x] = 0.05 + 0.9 * (x / W) * (0.6 + 0.4 * Math.sin(y / 40) ** 2);
const flat = t => new Float32Array(N * N).fill(t);
const white = (ink, w, h) => { let s = 7; const o = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; o[i] = ink[i] > s / 4294967296 ? 1 : 0; } return o; };

test('Bayer index matrix is the published one, and the native rank gives the browser runtime 8 x 8 table', () => {
  assert.deepEqual(M.bayerMatrix(4), [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]);
  // HarperZ9.github.io origin/main 3ca65296, media/raw-native/post-0.8.0/web/shaders/reference/retro-dither.mjs BAYER[8]
  assert.deepEqual(M.bayerMatrix(8), [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26], [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22], [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25], [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]]);
});

test('Floyd-Steinberg carries 7/16, 3/16, 5/16, 1/16 (worked by hand on a 2 x 2 at 0.3)', () => {
  assert.deepEqual([...M.floydSteinberg(new Float32Array(4).fill(0.3), 2, 2)], [0, 0, 0, 1]);
});

test('void-and-cluster mask ranks every pixel once, and is the browser runtime mask exactly', async () => {
  const { mask } = M.voidAndCluster(64), s = new Set(mask); assert.equal(s.size, 64 * 64);
  // the site's bluenoise.mjs blueNoise64() hashed the same on 2026-10-26 (4096 of 4096 ranks equal)
  const { createHash } = await import('node:crypto');
  assert.equal(createHash('sha256').update(Buffer.from(Int32Array.from(M.vacRanks(64)).buffer)).digest('hex').slice(0, 16), 'f1758c5b8a45da63');
});

test('the eye returns the source tone (stated errors), and white noise does not', () => {
  const bar = { bayer: [M.ordered, 2, 0.015], fs: [M.floydSteinberg, 2, 0.01], stucki: [M.stucki, 2, 0.01], blue: [M.blueNoise, 2, 0.015], line: [M.lineFill, 3, 0.05] /* line fill quantises tone to 1 / period (6), so its bar is wider */, am: [(i, w, h) => M.amHalftone(i, w, h, { cell: 8, angle: 45 }), 4, 0.015] };
  for (const [k, [f, sig, e]] of Object.entries(bar)) { const r = M.readout(f(ramp, W, H), ramp, W, H, sig); assert.ok(r.mae < e, `${k} mae ${r.mae.toFixed(4)} >= ${e}`); }
  assert.ok(M.readout(white(ramp, W, H), ramp, W, H, 2).mae > 0.03, 'the white-noise control must miss the bar');
  // Atkinson drops a quarter of the error by design (its known highlight and shadow loss): it is not a tone-keeping law
  const at = M.readout(M.atkinson(ramp, W, H), ramp, W, H, 2).mae; assert.ok(at > 0.03 && at < 0.1, `atkinson mae ${at.toFixed(4)}`);
});

test('noise spectra: blue for diffusion and void-and-cluster, a lattice for Bayer, white for the control', () => {
  for (const tone of [0.2, 0.37]) {
    for (const f of [M.floydSteinberg, M.stucki, M.blueNoise]) { const b = M.blueness(M.noiseSpectrum(f(flat(tone), N, N), N, tone)); assert.ok(b < 0.15, `blueness ${b.toFixed(3)} at ${tone}`); }
    assert.ok(M.blueness(M.noiseSpectrum(white(flat(tone), N, N), N, tone)) > 0.5, 'white noise is flat');
    assert.ok(M.latticeShare(M.ordered(flat(tone), N, N), N, 8, tone) > 0.999, 'Bayer power sits on its 8-px lattice');
    for (const f of [M.floydSteinberg, M.blueNoise]) assert.ok(M.latticeShare(f(flat(tone), N, N), N, 8, tone) < 0.2);
  }
});

test('AM halftone: the strongest spectral peak lies at the stated screen angle', () => {
  for (const angle of [45, 15]) {
    const cell = angle === 45 ? 8 * Math.SQRT2 : 8;   // 45: the screen frequency lands on bin (8, 8); 15: near (15, 4)
    const tone = 0.37, P = M.power2(Float64Array.from(M.amHalftone(flat(tone), N, N, { cell, angle }), v => v - tone), N);
    let bi = 1, bv = 0; for (let k = 1; k < N * N; k++) if (P[k] > bv) { bv = P[k]; bi = k; }
    const fx = (bi % N) <= N / 2 ? bi % N : (bi % N) - N, fy = Math.floor(bi / N) <= N / 2 ? Math.floor(bi / N) : Math.floor(bi / N) - N;
    const a = ((Math.atan2(fy, fx) * 180 / Math.PI) % 90 + 90) % 90, d = Math.min(Math.abs(a - angle), 90 - Math.abs(a - angle));
    assert.ok(d < 4, `angle ${angle}: peak at ${a.toFixed(1)}`);
  }
});

test('glyph ramps are measured from the face drawn and from living type, never a stock string', async () => {
  const A = M.atlas(M.ASCII, 10, 16), R = M.rampOf(A);
  assert.equal(R[0].ch, ' '); assert.ok(R.at(-1).coverage > 0.12);
  for (const r of R) { const m = A.masks.get(r.ch); assert.ok(Math.abs(m.reduce((a, b) => a + b, 0) / m.length - r.coverage) < 1e-6); }
  const L = await M.loadRamp('code'); assert.ok(L.length > 30 && L.every((r, i) => !i || r.coverage >= L[i - 1].coverage), 'living ramp, sorted');
});

test('the ASCII field reads as the tone at a distance', () => {
  const A = M.atlas(M.ASCII, 10, 16), R = M.rampOf(A), f = M.asciiField(ramp, W, H, { ramp: R }), cov = M.drawField(f, W, H, A);
  const scaled = Float32Array.from(ramp, v => v * f.scale), r = M.readout(Float32Array.from(cov), scaled, W, H, 8);
  assert.ok(r.mae < 0.02, `mae ${r.mae.toFixed(4)}`); assert.equal(f.lines.length, Math.floor(H / 16));
});

test('the code mosaic sets real lines from our public repos, readable, and reads as the tone far away', async () => {
  const corpus = await M.loadCorpus(), r = M.codeMosaic(ramp, W, H, { corpus });
  const all = corpus.lines.map(l => l.t);
  for (const p of r.provenance) { const seg = r.lines[p.row].slice(p.at, p.at + p.chars); assert.ok(all.some(t => t.startsWith(seg)), `row ${p.row} "${seg}" is a line from ${p.repo}`); assert.match(p.sha, /^[0-9a-f]{40}$/); }
  const scaled = Float32Array.from(ramp, v => v * r.scale), far = M.eye(r.coverage, W, H, 10), src = M.eye(scaled, W, H, 10);
  let sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, n = 0; for (let i = 0; i < W * H; i++) { const a = far[i], b = src[i]; sx += a; sy += b; sxx += a * a; syy += b * b; sxy += a * b; n++; }
  const corr = (sxy - sx * sy / n) / Math.sqrt((sxx - sx * sx / n) * (syy - sy * sy / n)); assert.ok(corr > 0.8, `far correlation ${corr.toFixed(3)}`);
});

test('a marks field changes law as a front where it is driven, and holds where it is not', () => {
  const F = M.marksField({ cols: 32, rows: 16, laws: ['blue', 'bayer'] }), g = new Float32Array(32 * 16); for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) g[r * 32 + c] = 1;
  F.drive(g, 32, 16); let peak = 0; for (let k = 0; k < 40; k++) { F.step(0.1); peak = Math.max(peak, F.measure(1).spread); }
  const w = F.weights(1); let L = 0, R = 0; for (let r = 0; r < 16; r++) for (let c = 0; c < 16; c++) { L += w[r * 32 + c]; R += w[r * 32 + 16 + c]; }
  assert.ok(L / 256 > 0.9 && R / 256 < 0.1, `driven ${(L / 256).toFixed(2)}, undriven ${(R / 256).toFixed(2)}`); assert.ok(peak > 0.25, `front spread ${peak.toFixed(2)}`);
  const ink = Float32Array.from({ length: 64 * 32 }, () => 0.4), out = M.marksField({ cols: 8, rows: 4, laws: ['bayer'] }).render(ink, 64, 32), bay = M.ordered(ink, 64, 32);
  assert.deepEqual([...out], [...bay].map(Number));
});

test('site recipes return finite colour, and the ordered field keeps the tone', () => {
  const tone = Float32Array.from(ramp, v => 1 - v), A = M.atlas('0123456789', 8, 12);
  for (const [k, f] of Object.entries(M.RECIPES)) { const o = f(tone, W, H); assert.equal(o.length, W * H * 3); assert.ok(o.every(v => Number.isFinite(v) && v >= 0 && v <= 1.0001), k); }
  for (const o of [M.faxNoise(M.orderedField(tone, W, H), W, H), M.glyphStamp(M.orderedField(tone, W, H), W, H, { atlas: A })]) assert.ok(o.every(Number.isFinite));
  const o = M.orderedField(tone, W, H, { inks: ['#000000', '#ffffff'] }), lum = Float32Array.from({ length: W * H }, (_, i) => 1 - o[3 * i]);
  assert.ok(M.readout(lum, ramp, W, H, 2).mae < 0.015);
});

test('digit tesserae: the CPU twin draws the shader table', () => {
  const t = new Float32Array(12 * 12).fill(0.85), o = M.digitMosaic(t, 12, 12, { cell: 12 });
  for (let row = 0; row < 5; row++) for (let col = 0; col < 3; col++) assert.equal(o[(row * 2 + 1) * 12 + col * 3 + 1] > 0 ? 1 : 0, M.digitBit(8, row, col));
  assert.match(M.DIGITS_GLSL, /int G\[10\] = int\[10\]\(31599/);
});

test('the merged code cells read the same source in node by either call', async () => {
  assert.equal(await M.loadEngineSource(), M.engineSource()); assert.ok(M.engineSource().length > 5000);
});
