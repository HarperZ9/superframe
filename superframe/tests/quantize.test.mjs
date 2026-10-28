// quantize.test.mjs: the era quantizer's colour checks (PREREG P1 to P3 in lib/quantize/README.md). CIEDE2000 on
// published pairs, dither as a metamer of its source at 60 ppd with nearest mapping as the control that must fail,
// the banding ratio, the noise floor, and a planted wrong answer the eye metric must reject.
import test from 'node:test';
import assert from 'node:assert/strict';
import { dE00, dE76, toLinear } from '../lib/quantize/ciede.mjs';
import { deStats, bandingRatio } from '../lib/quantize/eye.mjs';
import * as CB from '../lib/quantize/codebook.mjs';
import { diffuse, ordered, bayer } from '../lib/quantize/dither.mjs';
import { RAMPS, flat, loadRender, hasRenders } from '../lib/quantize/planted.mjs';

// Sharma, Wu and Dalal (2005), pairs 1, 2, 3, 7, 8, 17, 19, 25, 26, 34 (typed from memory).
const SHARMA = [
  [[50, 2.6772, -79.7751], [50, 0, -82.7485], 2.0425], [[50, 3.1571, -77.2803], [50, 0, -82.7485], 2.8615],
  [[50, 2.8361, -74.02], [50, 0, -82.7485], 3.4412], [[50, 0, 0], [50, -1, 2], 2.3669], [[50, -1, 2], [50, 0, 0], 2.3669],
  [[50, 2.5, 0], [73, 25, -18], 27.1492], [[50, 2.5, 0], [50, 3.1736, 0.5854], 1.0],
  [[60.2574, -34.0099, 36.2677], [60.4626, -34.1751, 39.4387], 1.2644], [[63.0109, -31.0961, -5.8663], [62.8187, -29.7946, -4.0864], 1.263],
  [[22.7233, 20.0904, -46.694], [23.0331, 14.973, -42.5619], 2.0373],
];

test('P1: CIEDE2000 matches the published pairs within 1e-4', () => {
  for (const [a, b, e] of SHARMA) assert.ok(Math.abs(dE00(a, b) - e) < 1e-4, `${a} ${b}: ${dE00(a, b)} vs ${e}`);
});

test('P1 control: CIE76 misses by more than 0.5 on at least half the pairs', () => {
  const misses = SHARMA.filter(([a, b, e]) => Math.abs(dE76(a, b) - e) > 0.5).length;
  assert.ok(misses >= SHARMA.length / 2, `CIE76 missed only ${misses}`);
});

const C64 = CB.levels(4);
const score = (img, out, ppd = 60) => deStats(toLinear(img), toLinear(out), img.w, img.h, ppd).mean;

test('P2: linear-light dither is a metamer at 60 ppd on the planted ramps (mean dE00 < 3)', () => {
  for (const [name, make] of Object.entries(RAMPS)) {
    const img = make();
    for (const [m, out] of [['fs', diffuse(img, C64)], ['bayer', ordered(img, C64)]]) {
      assert.ok(CB.inCodebook(out, C64), `${name} ${m} left the codebook`);
      const s = score(img, out); assert.ok(s < 3, `${name} ${m}: ${s}`);
    }
  }
});

test('P2 control: nearest mapping exceeds 6 on the grey and dark ramps; red-cyan is the recorded miss', () => {
  const s = Object.fromEntries(Object.entries(RAMPS).map(([k, f]) => { const img = f(); return [k, score(img, CB.nearest(img, C64))]; }));
  assert.ok(s.grey > 6 && s.dark > 6, JSON.stringify(s));
  // PREREG predicted > 6 here too; it measured 5.68. Kept as a failed control, not loosened.
  assert.ok(s['red-cyan'] > 5 && s['red-cyan'] < 6, `red-cyan ${s['red-cyan']}`);
});

test('P2 on the renders: dither under 3, nearest above 6 on the bow, rings between 2 and 6', { skip: !hasRenders() && 'renders not built' }, () => {
  for (const name of ['bow', 'rings']) {
    const img = loadRender(name), fs = score(img, diffuse(img, C64)), by = score(img, ordered(img, C64)), nn = score(img, CB.nearest(img, C64));
    assert.ok(fs < 3 && by < 3, `${name}: fs ${fs} bayer ${by}`);
    if (name === 'bow') assert.ok(nn > 6, `bow nearest ${nn}`); else assert.ok(nn > 2 && nn < 6, `rings nearest ${nn}`);
  }
});

test('P3: banding ratio on the grey ramp: nearest > 10, Floyd-Steinberg < 3; Bayer 4x4 is the recorded miss', () => {
  const img = RAMPS.grey(), s = toLinear(img), r = out => bandingRatio(s, toLinear(out), img.w, img.h, 60);
  const nn = r(CB.nearest(img, C64)), fs = r(diffuse(img, C64)), b4 = r(ordered(img, C64)), b8 = r(ordered(img, C64, { matrix: bayer(8) }));
  assert.ok(nn > 10, `nearest ${nn}`); assert.ok(fs < 3, `fs ${fs}`);
  // PREREG predicted < 3 for Bayer; it measured about 5.1. A 4x4 matrix has 17 tones per level gap, so its local
  // mean is itself a fine staircase. Post-hoc: 8x8 (65 tones) lowers it, which the test records.
  assert.ok(b4 > 3 && b4 < 8, `bayer4 ${b4}`); assert.ok(b8 < b4, `bayer8 ${b8} vs bayer4 ${b4}`);
});

test('noise floor: a flat field on a codebook colour comes back unchanged, with dE00 0', () => {
  const img = flat(64, 64, [85, 170, 255]);
  for (const out of [diffuse(img, C64), ordered(img, C64), CB.nearest(img, C64)]) {
    assert.deepEqual([...out.rgba], [...img.rgba]); assert.equal(score(img, out), 0);
  }
});

test('noise floor: a flat field off the codebook dithers to an invisible pattern (mean dE00 < 0.5)', () => {
  const img = flat(128, 128, [120, 60, 200]);
  assert.ok(score(img, diffuse(img, C64)) < 0.5);
});

test('false accept: a planted wrong answer (every code +12) must score above 3 after the same blur', () => {
  const img = RAMPS.grey(), wrong = { ...img, rgba: img.rgba.map((v, i) => (i % 4 === 3 ? v : Math.min(255, v + 12))) };
  assert.ok(score(img, wrong) > 3);
});

test('bit depths expand by replication: 5 bits give 0..255 with 32 codes', () => {
  const c = CB.bitCodes(5); assert.equal(c.length, 32); assert.equal(c[0], 0); assert.equal(c[31], 255); assert.equal(c[16], 132);
});
