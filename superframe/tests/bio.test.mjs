// bio.test.mjs: the measured packing law holds in the generator, and the random-placement control fails it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { place, clarkR, PHI_TISSUE, TISSUE } from '../lib/bio/nuclei.mjs';

let s = 3; const rng = () => ((s = (s * 16807) % 2147483647) / 2147483647);
const medianR = phi => { const R = []; for (let k = 0; k < 120; k++) { const p = place({ w: 320, h: 320, n: 70, phi, rng }); R.push(clarkR(p.x, p.y, 320, 320)); } return R.sort((a, b) => a - b)[60]; };

test('the hard core at PHI_TISSUE reproduces the tissue median spacing', () => {
  const r = medianR(PHI_TISSUE); assert.ok(Math.abs(r - TISSUE.clarkR) < 0.03, `R ${r} vs tissue ${TISSUE.clarkR}`);
});
test('control: random placement fails the tissue spacing and matches the measured random control', () => {
  const r = medianR(0); assert.ok(Math.abs(r - TISSUE.clarkR) > 0.15, `random R ${r} passed as tissue`); assert.ok(Math.abs(r - TISSUE.poissonR) < 0.03, `random R ${r} vs measured random ${TISSUE.poissonR}`);
});
test('the hard core is never violated', () => {
  const w = 300, h = 300, n = 120, p = place({ w, h, n, phi: PHI_TISSUE, rng }), d = PHI_TISSUE / Math.sqrt(n / (w * h));
  for (let i = 0; i < p.x.length; i++) for (let j = i + 1; j < p.x.length; j++) assert.ok(Math.hypot(p.x[i] - p.x[j], p.y[i] - p.y[j]) >= d - 1e-4);
  assert.equal(p.x.length, n);
});

// ---- vessels: the branching laws measured from ARCADE
import { grow, murraySplit, ARCADE } from '../lib/bio/vessels.mjs';
import { rngFrom } from '../lib/seed.mjs';
const forks = x => { const f = []; for (let k = 0; k < 6; k++) f.push(...grow({ w: 512, h: 512, rng: rngFrom(`v/${k}`), depth: 9, exponent: x, minD: 0.2 }).forks); return f; };
const median = v => { const s = [...v].sort((a, b) => a - b); return s[s.length >> 1]; };

test('every split obeys its exponent exactly', () => {
  for (const x of [ARCADE.exponent, 3]) for (const f of forks(x)) assert.ok(Math.abs(f.d0 ** x - f.d1 ** x - f.d2 ** x) / f.d0 ** x < 1e-12);
});
test('the measured exponent reproduces the measured child size', () => {
  const r = median(forks(ARCADE.exponent).map(f => f.d1 / f.d0));
  assert.ok(Math.abs(r - ARCADE.largeChild) < 0.03, `larger child ${r} vs measured ${ARCADE.largeChild}`);
});
test('control: Murray\'s cube law misses the measured child size', () => {
  const r = median(forks(3).map(f => f.d1 / f.d0));
  assert.ok(Math.abs(r - ARCADE.largeChild) > 0.1, `cube law ${r} passed as measured ${ARCADE.largeChild}`);
});
test('angles follow the measured spread, and the thinner child turns further', () => {
  const f = forks(ARCADE.exponent), a = median(f.map(x => x.angle));
  assert.ok(Math.abs(a - ARCADE.angle[1]) < 5, `median angle ${a} vs ${ARCADE.angle[1]}`);
  for (const x of f) if (x.d2 < x.d1) assert.ok(murraySplit(x.d1, x.d2) < 0.5);
});

// ---- bacteria: rods lengthen at a near-constant width (DeepBacs)
import { shapes, slope as bslope, place as bplace, SPECIES } from '../lib/bio/bacteria.mjs';
const readSlope = (sp, law) => { let v = 0; for (let r = 0; r < 4; r++) v += bslope(shapes(sp, 3000, rngFrom(`b/${sp}/${law}/${r}`), law)) / 4; return v; };

test('generated cells read back the measured width-length slope per species', () => {
  for (const sp of Object.keys(SPECIES)) { const v = readSlope(sp, 'measured'); assert.ok(Math.abs(v - SPECIES[sp].slope) < 0.03, `${sp}: ${v} vs measured ${SPECIES[sp].slope}`); }
});
test('control: isotropic growth reads a slope near 1 and fails the rod law', () => {
  for (const sp of ['e-coli', 'b-subtilis']) { const v = readSlope(sp, 'isotropic'); assert.ok(v > 0.9, `${sp} isotropic ${v}`); assert.ok(Math.abs(v - SPECIES[sp].slope) > 0.5); }
});
test('rods keep their aspect, and placed cells never overlap', () => {
  for (const sp of ['e-coli', 'b-subtilis']) { const s = shapes(sp, 3000, rngFrom(`a/${sp}`)), a = s.map(c => c.L / c.w).sort((x, y) => x - y)[1500]; assert.ok(Math.abs(a - SPECIES[sp].aspect) / SPECIES[sp].aspect < 0.08, `${sp} aspect ${a}`); }
  const c = bplace({ w: 400, h: 400, species: 'e-coli', count: 150, rng: rngFrom('ov'), scale: 0.6, gap: 0 });
  for (let i = 0; i < c.length; i++) for (let j = i + 1; j < c.length; j++) {
    const s = (q) => [q.x - Math.cos(q.a) * (q.L - q.w) / 2, q.y - Math.sin(q.a) * (q.L - q.w) / 2, q.x + Math.cos(q.a) * (q.L - q.w) / 2, q.y + Math.sin(q.a) * (q.L - q.w) / 2];
    const [a, b] = [s(c[i]), s(c[j])]; let m = Infinity;
    for (let t = 0; t <= 20; t++) for (let u = 0; u <= 20; u++) m = Math.min(m, Math.hypot(a[0] + (a[2] - a[0]) * t / 20 - b[0] - (b[2] - b[0]) * u / 20, a[1] + (a[3] - a[1]) * t / 20 - b[1] - (b[3] - b[1]) * u / 20));
    assert.ok(m >= (c[i].w + c[j].w) / 2 - 0.5, `cells ${i} and ${j} overlap`);
  }
});
