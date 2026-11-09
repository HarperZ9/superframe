// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// The eye port against studio-engine's eye at 328a0ddf (goldens/eye.golden.json, made by
// goldens/eye_from_studio_engine.mjs from the source file, before the port ran). The checks: every hash,
// feature and drift verdict equal to the source's, the same outputs across two runs, and seeded planted
// changes caught, in the picture and in the code.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { perceptualHash, features, hamming, compareDrift, identitySha256, eyeOf } from '../src/eye.mjs';
import { casePixels, mulberry32 } from './inputs.mjs';

const G = JSON.parse(readFileSync(new URL('../goldens/eye.golden.json', import.meta.url), 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const byName = Object.fromEntries(G.cases.map(c => [c.name, c]));

test('goldens come from the studio-engine source commit, not from this package', () => {
  assert.equal(G.source, 'HarperZ9/studio-engine@328a0ddf');
  assert.equal(G.cases.length, 10);
});

for (const c of G.cases) {
  test(`eye ${c.name}: hash and features equal the source's, twice`, () => {
    const { px, w, h, ch } = casePixels(c);
    assert.equal(sha(px), c.input_sha256, 'the input itself changed; fix the input before reading the eye');
    for (let run = 0; run < 2; run++) {
      assert.equal(perceptualHash(px, w, h, ch), c.phash);
      assert.deepEqual(features(px, w, h, ch), c.features);
    }
  });
}

test("drift verdicts and Hamming distances equal the source's", () => {
  for (const d of G.drift) {
    const A = d.a && byName[d.a], B = d.b && byName[d.b];
    if (A && B) {
      assert.equal(hamming(A.phash, B.phash), d.hamming);
      assert.deepEqual(compareDrift(A.input_sha256, B.input_sha256, A.phash, B.phash), d.verdict);
    } else if (A) assert.deepEqual(compareDrift(A.input_sha256, 'x', A.phash, null), d.verdict);
    else assert.deepEqual(compareDrift(null, 'x', null, null), d.verdict);
  }
});

test("identity hash equals the source's", async () => {
  assert.equal(await identitySha256(casePixels(byName[G.identity.input]).px), G.identity.sha256);
});

test('eyeOf reads a studio render the same way', () => {
  const c = byName['raked-concrete-s4'], { px, w, h } = casePixels(c);
  assert.deepEqual(eyeOf(px, w, h), { phash: c.phash, features: c.features });
});

// Fill one of the 9 x 8 hash cells of an RGBA picture with a grey level.
function paintCell(px, w, h, cx, cy, v) {
  for (let y = Math.floor((cy * h) / 8); y < Math.floor(((cy + 1) * h) / 8); y++)
    for (let x = Math.floor((cx * w) / 9); x < Math.floor(((cx + 1) * w) / 9); x++) for (let k = 0; k < 3; k++) px[(y * w + x) * 4 + k] = v;
}

// Planted change in the picture: reverse the brightness order of one seeded pair of neighbouring cells. That is
// the one thing a dHash bit records, so the hash must move off the golden.
test('planted change: reversing one seeded neighbour pair moves the hash off the golden', () => {
  const c = byName['rgba-640x400-s7'];
  for (const seed of [1, 2, 3]) {
    const { px, w, h } = casePixels(c), r = mulberry32(seed);
    const cx = Math.floor(r() * 8), cy = Math.floor(r() * 8), bit = (BigInt('0x' + c.phash) >> BigInt(63 - (cy * 8 + cx))) & 1n;
    paintCell(px, w, h, cx, cy, bit ? 0 : 255);
    paintCell(px, w, h, cx + 1, cy, bit ? 255 : 0);
    const p = perceptualHash(px, w, h, 4);
    assert.notEqual(p, c.phash, `seed ${seed} slipped through`);
    assert.equal(compareDrift(c.input_sha256, sha(px), c.phash, p).verdict, 'DRIFT');
  }
});

// The limit, kept as a test: a change that keeps every neighbour order leaves the dHash where it was. The
// identity hash still catches it, and the verdict says DRIFT at distance 0 rather than MATCH.
test('limit: whitening a cell that is already the brighter of its pairs leaves the dHash unchanged', () => {
  const c = byName['rgba-640x400-s7'], { px, w, h } = casePixels(c), r = mulberry32(2);
  paintCell(px, w, h, Math.floor(r() * 9), Math.floor(r() * 8), 255);
  const p = perceptualHash(px, w, h, 4);
  assert.equal(p, c.phash);
  assert.deepEqual(compareDrift(c.input_sha256, sha(px), c.phash, p), { verdict: 'DRIFT', distance: 0, reason: 'bytes differ; perceptual distance 0/64' });
});

// Planted change in the code: a mutant that rounds float luma where the source floors integer luma.
test('planted change: a luma-rounding mutant fails the golden check', () => {
  const mutantGray = (px, w, h, ch) => Uint8Array.from({ length: w * h }, (_, i) =>
    Math.round(0.299 * px[i * ch] + 0.587 * px[i * ch + 1] + 0.114 * px[i * ch + 2]));
  const caught = G.cases.filter(c => {
    const { px, w, h, ch } = casePixels(c);
    if (ch < 3) return false;
    const g = mutantGray(px, w, h, ch);
    return perceptualHash(g, w, h, 1) !== c.phash || JSON.stringify(features(g, w, h, 1)) !== JSON.stringify({ ...c.features, hue: 0 });
  });
  assert.ok(caught.length > 0, 'no case separated the mutant from the source');
});
