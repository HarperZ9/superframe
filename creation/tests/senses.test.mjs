// senses.test.mjs: per sense, a metamer pair with one readout that a light change splits, an isomer pair, and a
// summary control that sees neither. Taste is a linear model and is reported unverifiable, not passed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { senseChecks, transpileSeries } from '../lib/core/senses.mjs';

const S = senseChecks();
for (const sense of ['sight', 'hearing', 'touch', 'body']) {
  test(`${sense}: metamer readout equal, split by its light change, summary control flat; isomer split`, () => {
    const m = S[sense].metamer, i = S[sense].isomer;
    assert.ok(m.readout < 1e-3, `${sense} readout ${m.readout}`);
    assert.ok(m.split > (sense === 'sight' ? 0.2 : 1e-2), `${sense} split ${m.split}`);
    assert.ok(m.control < 1e-3, `${sense} control ${m.control}`);
    assert.ok(i.split > 1e-2 && i.control < 1e-6, `${sense} isomer ${JSON.stringify(i)}`);
  });
}
test('taste: a linear receptor model cannot split an exact vector metamer, so the verdict is unverifiable', () => {
  assert.equal(S.taste.metamer.verdict, 'unverifiable');
  assert.ok(S.taste.metamer.readout < 1e-9 && S.taste.metamer.split < 1e-9);
});
test('cross-sense transpile states its loss for each sense', () => {
  const t = transpileSeries([1, 3, 2, 5, 4]);
  for (const k of ['sight', 'hearing', 'touch']) assert.ok(t[k].loses.length > 5);
});
