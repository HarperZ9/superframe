import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validate, normalize, CORE, PLATES, VOICES, hashMaterial } from '../lib/schema.mjs';
import { MATERIALS, RAW_MATERIALS, CODE_MATERIAL } from '../lib/materials.mjs';
import { PLATE_FNS } from '../lib/lanes/image.mjs';
import { FACES } from '../lib/lanes/type.mjs';

// The lettering library's technique list, read from its source (importing it needs a DOM).
const LETTER = readFileSync(new URL('../../lettering/lib/letter.mjs', import.meta.url), 'utf8');
const TECHNIQUES = JSON.parse(LETTER.match(/export const TECHNIQUES = (\[[^\]]+\])/)[1].replace(/'/g, '"'));

test('at least eight materials, every one valid as written', () => {
  assert.ok(MATERIALS.length >= 8, `${MATERIALS.length} materials`);
  for (const m of RAW_MATERIALS) assert.deepEqual(validate(m), { ok: true, errors: [] }, m.id);
  assert.equal(new Set(MATERIALS.map(m => m.id)).size, MATERIALS.length, 'ids are unique');
});

test('every material maps to all four lanes with generators that exist', () => {
  for (const m of [...MATERIALS, CODE_MATERIAL]) {
    assert.ok(TECHNIQUES.includes(m.hints.type.technique), `${m.id}: type technique ${m.hints.type.technique}`);
    if (m.hints.type.face) assert.ok(FACES[m.hints.type.face], `${m.id}: face ${m.hints.type.face}`);
    for (const p of m.hints.image.plates) assert.ok(PLATE_FNS[p.kind], `${m.id}: plate ${p.kind}`);
    assert.ok(m.hints.motion.curve, `${m.id}: motion curve`);
    assert.ok(m.hints.sound.voices.length > 0 && m.hints.sound.voices.every(v => VOICES.includes(v.voice)), `${m.id}: voices`);
  }
  assert.deepEqual(Object.keys(PLATE_FNS).sort(), [...PLATES].sort(), 'every schema plate has a renderer');
});

test('validate rejects broken materials with a reason for each fault', () => {
  const bad = { id: 'Bad Id', palette: { ground: 'red', ink: '#000000', accent: '#ffffff' }, core: { relief: 2, nope: 1 }, noiseColour: 'blue',
    hints: { type: {}, image: { plates: [{ kind: 'glitter', mode: 'burn', opacity: 3 }] }, motion: { curve: 'bounce' }, sound: { voices: [{ voice: 'theremin' }] } } };
  const r = validate(bad);
  assert.equal(r.ok, false);
  for (const frag of ['id must', 'palette.ground', 'core.relief', 'core.nope', 'noiseColour', 'hints.type', 'glitter', 'burn', 'opacity', 'bounce', 'theremin']) assert.ok(r.errors.some(e => e.includes(frag)), `missing error for ${frag}: ${r.errors.join(' | ')}`);
});

test('normalize fills defaults and clamps into range, without mutating its input', () => {
  const raw = { id: 'x', core: { relief: 9, fps: 2, on: 2.6 } }, before = JSON.stringify(raw), n = normalize(raw);
  assert.equal(JSON.stringify(raw), before);
  assert.equal(n.core.relief, 1); assert.equal(n.core.fps, 8); assert.equal(n.core.on, 3);
  for (const [k, [lo, hi]] of Object.entries(CORE)) assert.ok(n.core[k] >= lo && n.core[k] <= hi, k);
  assert.equal(hashMaterial(raw), hashMaterial(n), 'normalize is idempotent under the hash');
});
