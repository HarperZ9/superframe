// Pieces: golden images (QUALITY-SPEC S5) and byte determinism (S3), plus the loop of the animated piece.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NAMES, SIZE, renderSmall, lumaOf, readGolden, compare } from './golden.mjs';
import * as Anim from '../anim.mjs';

for (const name of NAMES) {
  test(`golden: ${name} matches at SSIM mean >= 0.995 and worst 32 px tile >= 0.97`, async () => {
    const f = lumaOf(await renderSmall(name), SIZE * SIZE), r = compare(f, readGolden(name));
    assert.ok(r.mean >= 0.995, `mean ${r.mean}`); assert.ok(r.worst >= 0.97, `worst tile ${r.worst}`);
  });
}

test('determinism: a piece renders to the same bytes twice', async () => {
  assert.deepEqual(await renderSmall('sheet-one'), await renderSmall('sheet-one'));
});

test('a golden fails on a changed picture (the check can say no)', async () => {
  const f = lumaOf(await renderSmall('glyph-field'), SIZE * SIZE), g = readGolden('sheet-one');
  assert.ok(compare(f, g).mean < 0.9);
});

test('the animated field is periodic over one loop', () => {
  const a = Anim.field(0), b = Anim.field(2 * Math.PI);
  for (const [u, v] of [[0.1, 0.2], [0.5, 0.5], [0.77, 0.31]]) assert.ok(Math.abs(a(u, v) - b(u, v)) < 1e-12);
  assert.equal(Anim.UNIQUE, Anim.LOOP_S * Anim.UNIQUE_FPS); assert.equal(Anim.FPS, 2 * Anim.UNIQUE_FPS);
});
