// The fourier technique's claims, each a number: reconstruction error against the font's own outlines (with a
// shuffled-phase control that must fail), the pixel-error cut and its bound, morph self-intersections, the XY sound
// read back as a drawing, and the 2D band reveal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseTTF } from '../lib/fourier/ttf.mjs';
import { trace, dft, resample, truncate } from '../lib/fourier/kernel.mjs';
import { glyphSeries, wordSeries, pairUp, mix, fastDft, morphTerms, N, K } from '../lib/fourier/shape.mjs';
import { hausdorff, crossings, shuffledPhase } from '../lib/fourier/measure.mjs';
import { xySignal, readXY, pcm16 } from '../lib/fourier/xy.mjs';
import { bandImage, spectrum2d } from '../lib/fourier/band.mjs';

const font = parseTTF(readFileSync(new URL('../fonts/hanken-grotesk-bold.ttf', import.meta.url)));
const CHARS = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const flip = (p) => Float64Array.from(p, (v, i) => (i % 2 ? -v : v));
const outlines = (ch) => font.glyph(ch, 0.25).contours.map((c) => flip(c.pts));

test('the font reader finds every Latin letter and digit, counters kept as their own contours', () => {
  for (const ch of CHARS) assert.ok(font.has(ch) && font.glyph(ch).contours.length > 0, ch);
  assert.equal(font.glyph('o').contours.filter((c) => c.hole).length, 1);
  assert.equal(font.glyph('B').contours.filter((c) => c.hole).length, 2);
  assert.equal(font.glyph('l').contours.filter((c) => c.hole).length, 0);
});

test('reconstruction: error falls as terms are added, all terms stay within 0.005 em, shuffled phases fail', () => {
  const Hs = [5, 17, 65, 2 * K + 1], worst = Hs.map(() => 0), med = Hs.map(() => []);
  let ctrlMin = Infinity, n = 0; const ctrls = [];
  for (const ch of CHARS) {
    const gs = glyphSeries(font, ch), out = outlines(ch); let ctrl = 0;
    gs.contours.forEach((s, i) => {
      Hs.forEach((H, h) => { const e = hausdorff(trace(s.c, H, 600), out[i]); worst[h] = Math.max(worst[h], e); med[h].push(e); });
      ctrl = Math.max(ctrl, hausdorff(trace(shuffledPhase(s.c, 11 + i), 2 * K + 1, 600), out[i])); n++;
    });
    ctrlMin = Math.min(ctrlMin, ctrl); ctrls.push(ctrl); // the control is judged per glyph: its worst contour
  }
  const m = med.map((a) => a.sort((x, y) => x - y)[a.length >> 1]);
  for (let h = 1; h < Hs.length; h++) assert.ok(m[h] < m[h - 1] / 2, `median at ${Hs[h]} terms ${m[h]} vs ${m[h - 1]}`);
  assert.ok(worst.at(-1) < 0.005, `worst at all terms ${worst.at(-1)} em`);
  // a near circle (o, O) carries its shape in two terms, so scrambling the rest moves it least: every glyph must
  // still miss by 1.5 times the worst real error, and all but three by ten times
  const far = ctrls.filter((c) => c > 10 * worst.at(-1)).length;
  assert.ok(ctrlMin > 1.5 * worst.at(-1), `control ${ctrlMin} em is too close to the letter`);
  assert.ok(far >= CHARS.length - 3, `only ${far} glyphs miss by ten times`);
  console.log(`  ${n} contours of ${CHARS.length} glyphs, Hausdorff in em, median / worst: ${Hs.map((H, h) => `${H} terms ${m[h].toFixed(4)} / ${worst[h].toFixed(4)}`).join(', ')}; shuffled phase: every glyph off by at least ${ctrlMin.toFixed(4)}, ${far} of ${CHARS.length} by ten times the worst real error`);
});

test('the pixel-error cut: no point moves more than the bound, and the bound stays under 0.25 px', () => {
  for (const px of [24, 96, 400]) {
    let kept = 0, all = 0, worst = 0;
    for (const ch of 'aegkRS8&') for (const s of glyphSeries(font, ch).contours) {
      const t = truncate(s.c, px, 0.25), c = { ...s.c, re: s.c.re.map((v, j) => (t.keep[j] ? v : 0)), im: s.c.im.map((v, j) => (t.keep[j] ? v : 0)) };
      const a = trace(s.c, Infinity, 512), b = trace(c, Infinity, 512);
      let d = 0; for (let i = 0; i < a.length; i += 2) d = Math.max(d, Math.hypot(a[i] - b[i], a[i + 1] - b[i + 1]) * px);
      assert.ok(d <= t.bound * (1 + 1e-9) + 1e-12 && t.bound < 0.25, `${ch} at ${px} px: moved ${d}, bound ${t.bound}`);
      worst = Math.max(worst, d); kept += t.kept; all += t.keep.length;
    }
    console.log(`  at ${px} px per em: ${kept} of ${all} terms kept (${((100 * kept) / all).toFixed(1)} %), worst move ${worst.toFixed(3)} px`);
  }
});

test('morphs: matched contours are counted for self-intersections mid-morph, against the letters themselves', () => {
  const at = { em: 100 }, cases = [['a', 'b'], ['o', 'l'], ['Low', 'Water'], ['Fourier', 'series'], ['R', '8']];
  let mid = 0, soft = 0, ends = 0, paths = 0;
  const rows = cases.map(([x, y]) => {
    const P = pairUp(wordSeries(font, x, at), wordSeries(font, y, at));
    let m = 0, e = 0, s = 0;
    for (const p of P) {
      for (const t of [0.25, 0.5, 0.75]) { m += crossings(trace(mix(p, t), Infinity, 256)); s += crossings(trace(mix(p, t), morphTerms(t), 256)); }
      for (const t of [0, 1]) e += crossings(trace(mix(p, t), Infinity, 256));
    }
    mid += m; soft += s; ends += e; paths += P.length * 3; return `${x} to ${y}: ${s} as drawn (${m} at all terms), ${e} at the ends`;
  });
  assert.ok(soft <= mid, `softened ${soft} vs all terms ${mid}`);
  console.log(`  self-crossings over ${paths} mid-morph paths (t = 0.25, 0.5, 0.75): ${soft} as drawn with the morph's softening, ${mid} at all terms; at the letters themselves: ${ends}. ${rows.join('; ')}`);
});

test('the fast transform used for morph targets equals the kernel\'s DFT to 1e-14 em', () => {
  let worst = 0;
  for (const ch of 'gQ&') for (const ct of font.glyph(ch).contours) { const r = resample(flip(ct.pts), N), a = dft(r, K), b = fastDft(r, K); for (let j = 0; j < a.re.length; j++) worst = Math.max(worst, Math.hypot(a.re[j] - b.re[j], a.im[j] - b.im[j])); }
  assert.ok(worst < 1e-14, `worst ${worst}`);
  console.log(`  worst difference ${worst.toExponential(1)} em`);
});

test('the XY sound, carried as 16-bit PCM and read back as a drawing, reproduces the glyph within 0.004 em', () => {
  const em = 200, results = [];
  for (const ch of 'aRg8') {
    const S = wordSeries(font, ch, { em }), sig = xySignal(S.map((s) => s.c), { sr: 48000, fps: 40, seconds: 0.25 });
    const L = pcm16(sig.L), R = pcm16(sig.R), last = (sig.frames - 1) * sig.frameLen, out = outlines(ch);
    let o = last, worst = 0;
    sig.counts.forEach((c, i) => { const p = readXY(L, R, sig.map, o, o + c); o += c; worst = Math.max(worst, hausdorff(p, Float64Array.from(out[i], (v) => v * em)) / em); });
    // control: the channels swapped draw the letter mirrored and turned, which must not pass
    let ctrl = 0; o = last;
    sig.counts.forEach((c, i) => { const p = readXY(R, L, sig.map, o, o + c); o += c; ctrl = Math.max(ctrl, hausdorff(p, Float64Array.from(out[i], (v) => v * em)) / em); });
    assert.ok(worst < 0.004, `${ch}: ${worst} em`); assert.ok(ctrl > 0.05, `${ch}: swapped channels ${ctrl} em`);
    results.push(`${ch} ${worst.toFixed(4)} (swapped ${ctrl.toFixed(2)})`);
  }
  console.log(`  read-back Hausdorff in em at 48 kHz, 40 frames a second, 16-bit: ${results.join(', ')}`);
});

test('beyond outlines: a 2D image is rebuilt band by band, and the error falls as bands are added', () => {
  const W = 64, H = 64, img = new Float64Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) img[y * W + x] = Math.hypot(x - 32, y - 32) < 20 && Math.hypot(x - 32, y - 32) > 10 ? 1 : 0;
  const S = spectrum2d(img, W, H), err = (b) => { const r = bandImage(S, b); let e = 0; for (let i = 0; i < img.length; i++) e += (r[i] - img[i]) ** 2; return Math.sqrt(e / img.length); };
  const e = [2, 4, 8, 16, 32, 46].map(err);
  for (let i = 1; i < e.length; i++) assert.ok(e[i] < e[i - 1], `${e}`);
  assert.ok(e.at(-1) < 1e-9, `all bands ${e.at(-1)}`);
  console.log(`  RMS error by radial band 2, 4, 8, 16, 32, all: ${e.map((v) => v.toExponential(1)).join(', ')}`);
});
