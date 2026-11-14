// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: FSL-1.1-MIT
// The font port against the fonts Flywheel wrote at 681810fe (goldens/font.golden.json, made by
// goldens/font_from_flywheel.py from the source tree, before the port ran). Three checks per writer:
// byte-identical to the source's font, byte-identical across two runs, and a seeded planted change caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { mint, DEFAULTS } from '../../../typeface/forge/lib/forge.mjs';
import { toTtf } from '../src/font/ttf.mjs';
import { mintVariableFamily, toVariableTtf, INSTANCES } from '../src/font/variable.mjs';
import { mulberry32 } from './inputs.mjs';

const G = JSON.parse(readFileSync(new URL('../goldens/font.golden.json', import.meta.url), 'utf8'));
const sha = b => createHash('sha256').update(b).digest('hex');
const face = c => mint({ ...DEFAULTS, ...c.params }, c.seed);
const sameAsGolden = (bytes, c) => bytes.length === c.bytes && sha(bytes) === c.ttf_sha256;

test('goldens come from the Flywheel source commit, not from this package', () => {
  assert.equal(G.source, 'HarperZ9/flywheel@681810fe');
  assert.deepEqual(Object.keys(G.sourceFiles).sort(), ['typeface_family.py', 'typeface_forge.py', 'typeface_skeletons.py', 'typeface_ttf.py', 'typeface_variable.py']);
  assert.equal(G.static.length, 3);
  assert.equal(G.variable.length, 4);
});

for (const c of G.static) {
  test(`static font ${c.name}: byte-identical to Flywheel's, and across two runs`, () => {
    const a = toTtf(face(c), c.family, c.style), b = toTtf(face(c), c.family, c.style);
    assert.ok(sameAsGolden(a, c), `sha ${sha(a)} (${a.length} bytes), want ${c.ttf_sha256} (${c.bytes})`);
    assert.deepEqual(a, b);
  });
}

for (const c of G.variable) {
  test(`variable font ${c.name}: same refusals and the same bytes as Flywheel's`, () => {
    const opts = { seed: c.seed, family: c.family, instances: c.instances ?? INSTANCES };
    const a = mintVariableFamily(c.params, opts), b = mintVariableFamily(c.params, opts);
    assert.equal(a.refused, c.refused);
    assert.deepEqual(a.refusals, c.refusals);
    assert.deepEqual(a.refusedInstances.map(r => r.style), c.refused_styles);
    if (c.refused) return;
    assert.ok(sameAsGolden(a.ttf, c), `sha ${sha(a.ttf)} (${a.ttf.length} bytes), want ${c.ttf_sha256} (${c.bytes})`);
    assert.deepEqual(a.ttf, b.ttf);
  });
}

// A seeded planted change: move one point of one glyph by `by` font units. The parity check must reject it.
function plant(f, seed, by) {
  const r = mulberry32(seed), names = Object.keys(f.glyphs).sort();
  const g = f.glyphs[names[Math.floor(r() * names.length)]], ring = g.contours[Math.floor(r() * g.contours.length)];
  const i = Math.floor(r() * (ring.length - 1));
  ring[i] = [ring[i][0] + by, ring[i][1]];
  if (i === 0) ring[ring.length - 1] = ring[0];
  return f;
}

test('planted change: a one-unit move of one seeded point fails the static parity check', () => {
  const c = G.static[0];
  for (const seed of [1, 2, 3]) assert.ok(!sameAsGolden(toTtf(plant(face(c), seed, 1), c.family, c.style), c), `seed ${seed} slipped through`);
});

test('planted change: the same move in one master fails the variable parity check', () => {
  const c = G.variable[0];
  const masters = INSTANCES.map(([style, weight]) => ({ style, weight, face: mint({ ...DEFAULTS, weight }, c.seed) }));
  assert.ok(sameAsGolden(toVariableTtf(masters, c.family).ttf, c), 'the unplanted masters must match first');
  plant(masters[3].face, 4, 1);
  assert.ok(!sameAsGolden(toVariableTtf(masters, c.family).ttf, c));
});

test('the check works in whole font units: a move far under half a unit rounds away and passes', () => {
  const c = G.static[0];
  assert.ok(sameAsGolden(toTtf(plant(face(c), 1, 0.001), c.family, c.style), c));
});

test('a topology mismatch between masters is refused by name', () => {
  const masters = [['Light', 0.058], ['Bold', 0.145]].map(([style, weight]) => ({ style, weight, face: mint({ ...DEFAULTS, weight }, 58) }));
  masters[1].face.glyphs.o.contours[0].splice(1, 1);
  assert.equal(toVariableTtf(masters).error, "glyph 'o' has a different point count across weights");
});
