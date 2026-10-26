// language.test.mjs: word-order isomers split under an order-aware readout while the bag-of-words control reads 0;
// Zipf's exponent on real text sits near 1 while a uniform-vocabulary control sits near 0; vowel metamers share a
// formant readout across two pitches.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const CORPUS = fileURLToPath(new URL('./fixtures/corpus.txt', import.meta.url));   // a published essay, CC BY
import { words, zipfExponent, bagDistance, bigramDistance, vowel, formantReadout } from '../lib/ir/language.mjs';

test('word-order isomers: order-aware readout splits, bag-of-words control reads 0', () => {
  for (const [a, b] of [['ink over paper', 'paper over ink'], ['the claim covers the correction and the correction covers the claim', 'the claim covers the correction and the claim covers the correction']]) {
    assert.ok(bigramDistance(a, b) > 0); assert.equal(bagDistance(a, b), 0);
  }
});
test('Zipf on real text against a uniform-vocabulary control', () => {
  const ws = words(readFileSync(CORPUS, 'utf8')), v = [...new Set(ws)]; let s = 3; const r = () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
  const z = zipfExponent(ws), zu = zipfExponent(ws.map(() => v[Math.floor(r() * v.length)]));
  assert.ok(z > 0.7 && z < 1.3, `corpus ${z}`); assert.ok(zu < 0.4, `control ${zu}`);
});
test('vowel metamer: one formant readout at two pitches', () => {
  const a = formantReadout(vowel(110)), b = formantReadout(vowel(220));
  assert.ok(Math.abs(a[0] - b[0]) <= 60 && Math.abs(a[1] - b[1]) <= 120, JSON.stringify([a, b]));
});
