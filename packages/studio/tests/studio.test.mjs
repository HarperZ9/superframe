// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// The studio's own determinism claims, as the README states them: every material validates, and one seed gives
// the same picture bytes and the same sound score twice.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MATERIALS, byId } from '../../../studio/lib/materials.mjs';
import { validate, hashMaterial, SCHEMA, CORE } from '../../../studio/lib/schema.mjs';
import { blend } from '../../../studio/lib/blend.mjs';
import { renderImage, toRGBA } from '../../../studio/lib/lanes/image.mjs';
import { score, hashScore } from '../../../studio/lib/lanes/sound.mjs';
import { STUDIO } from '../src/index.mjs';

const sha = b => createHash('sha256').update(b).digest('hex');
const picture = (m, seed) => toRGBA(renderImage(m, { w: 96, h: 60, seed, marks: false }), m);

test('the library: fourteen materials, every one valid under studio.material/1', () => {
  assert.equal(SCHEMA, 'studio.material/1');
  assert.equal(Object.keys(CORE).length, 25);
  assert.equal(MATERIALS.length, 14);
  for (const m of MATERIALS) assert.deepEqual(validate(m).errors, [], m.id);
  assert.deepEqual(STUDIO.materials, MATERIALS.map(m => m.id));
});

test('image lane: the same material and seed give the same bytes; another seed does not', () => {
  const m = byId('spray');
  assert.equal(sha(picture(m, 3)), sha(picture(m, 3)));
  assert.notEqual(sha(picture(m, 3)), sha(picture(m, 4)));
});

test('sound lane: the same material and seed give the same score hash', () => {
  const m = blend([byId('glass'), byId('rope')], [0.5, 0.5]);
  assert.equal(hashScore(score(m, { seed: 9 })), hashScore(score(m, { seed: 9 })));
  assert.equal(hashMaterial(m), hashMaterial(blend([byId('glass'), byId('rope')], [0.5, 0.5])));
});
