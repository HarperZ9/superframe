// metamers.test.mjs: the metamer explorer. Every member matches the target within delta E 0.5 under its light; the
// set comes apart under illuminant A; a single spectrum (and a set pinned at a bound) shows no spread.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spectrumOf, spectrumRGB, toXYZ, BANDS } from '../lib/medium/spectral.mjs';
import { observerRows, read, metamerSet, spread, matchError, reflectanceOf, deltaE } from '../lib/medium/metamers.mjs';
import { rngFrom } from '../lib/seed.mjs';

const TARGETS = ['#7a8a5a', '#3b5bd9', '#808080', '#c23b22'];

test('the standard observer rows reproduce toXYZ', () => {
  const R = spectrumOf('#7a8a5a'), a = read(observerRows(), R), b = toXYZ(R);
  a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-9));
});
test('acceptance: every member of every set matches its target within delta E 0.5 under D65', () => {
  for (const hex of TARGETS) { const T = spectrumOf(hex), set = metamerSet(T, { n: 48, rng: rngFrom(hex) }); assert.ok(matchError(set, T) < 0.5, `${hex}: ${matchError(set, T)}`); for (const R of set) for (const v of R) assert.ok(v >= 0.001 - 1e-12 && v <= 0.999 + 1e-12); }
});
test('control: a step outside the null space fails the delta E check', () => {
  const T = spectrumOf('#7a8a5a'), bad = [T.map((v, i) => Math.min(0.999, v + 0.05 * Math.sin(i)))];
  assert.ok(matchError(bad, T) > 0.5, 'an unprojected change passed as a metamer');
});
test('the sets come apart under illuminant A', () => {
  for (const hex of TARGETS) { const T = spectrumOf(hex), s = spread(metamerSet(T, { n: 48, rng: rngFrom(`a${hex}`) }), 'A').max; assert.ok(s > 2, `${hex} spread ${s}`); }
});
test('control: a single spectrum, and a set pinned at the bound, show no spread', () => {
  const T = spectrumOf('#7a8a5a');
  assert.equal(spread([T, T.slice()], 'A').max, 0);
  const W = new Array(BANDS).fill(0.999); assert.ok(spread(metamerSet(W, { n: 12, rng: rngFrom('w') }), 'A').max < 1e-6);
});
test('a dichromat\'s metamers are visible to the standard observer, and match for the dichromat', () => {
  const T = spectrumOf('#7a8a5a'), set = metamerSet(T, { observer: 'protan', n: 48, rng: rngFrom('p') }), rows = observerRows('protan');
  for (const R of set) read(rows, R).forEach((v, i) => assert.ok(Math.abs(v - read(rows, T)[i]) < 1e-9));
  assert.ok(spread(set, 'D65').max > 5, 'protan metamers should differ to a trichromat');
});
test('the prism: colours go to reflectances that return them through the engine chain (most within delta E 0.5)', () => {
  // compared through spectrumRGB, the chain the upsampler fits; the engine adapts its display to the 16-band white,
  // which sits about 0.8 delta E from the textbook sRGB white, so a textbook-matrix comparison would measure that offset
  const M = [[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]], X = c => M.map(m => m[0] * c[0] + m[1] * c[1] + m[2] * c[2]), W = X([1, 1, 1]), e = [];
  // a 22-level grid; an 8-level grid over-weights channels at 0, where a smooth reflectance cannot reach, and gives 86 percent
  for (let r = 0; r < 64; r += 3) for (let g = 0; g < 64; g += 3) for (let b = 0; b < 64; b += 3) { const q = [r, g, b].map(x => (x / 63) ** 2.2), R = reflectanceOf(q); assert.ok(R.every(v => v > 0 && v < 1)); e.push(deltaE(X(spectrumRGB(R)), X(q), W)); }
  e.sort((a, b) => a - b);
  assert.ok(e[e.length >> 1] < 0.5, `median ${e[e.length >> 1]}`);
  assert.ok(e.filter(x => x <= 0.5).length / e.length > 0.9, `share within 0.5: ${e.filter(x => x <= 0.5).length / e.length}`);
});
