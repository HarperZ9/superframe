// tests/render.test.mjs: every material renders the same bytes twice (determinism), matches its stored golden hash,
// and keeps the letter: ink lands where the glyph is. Goldens refresh with UPDATE_GOLDEN=1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { MATERIALS } from '../lib/materials.mjs';
import { renderWord } from '../lib/render.mjs';
import { candidate } from '../lib/generate.mjs';

const GOLD = new URL('./golden/render.json', import.meta.url), gold = existsSync(GOLD) ? JSON.parse(readFileSync(GOLD, 'utf8')) : {}, fresh = {};
const LAYER = { glow: 'edge', offset: 'shadow', drift: 'motion', voice: 'sound' };
const fam = (id) => ({ schema: 'typeengine.family/1', id: `g-${id}`, name: id, skeleton: { source: 'accession', style: 'display', weight: 800 },
  bindings: LAYER[id] ? { fill: { material: 'ink' }, [LAYER[id]]: { material: id } } : { fill: { material: id } },
  inputs: { 'data.series': { values: [3, 6, 2, 8, 5, 9, 4] }, 'sound.pcm': { source: 'phrase', seconds: 1.5 } } });
const hash = (r) => { const q = new Uint16Array(r.raster.data.length); r.raster.data.forEach((v, i) => { q[i] = Math.round(Math.min(4, Math.max(0, v)) * 4096); }); const h = createHash('sha256').update(q); if (r.pcm) h.update(new Uint8Array(r.pcm.channels[0].buffer)); return h.digest('hex').slice(0, 16); };

for (const id of MATERIALS.keys()) {
  test(`${id}: deterministic, golden, and the letter is where the ink is`, () => {
    const opt = { t: id === 'drift' ? 0.7 : 0 }, a = renderWord(fam(id), 'Ra', 160, 64, opt), b = renderWord(fam(id), 'Ra', 160, 64, opt);
    assert.equal(hash(a), hash(b), 'same arguments, same bytes');
    fresh[id] = hash(a);
    if (!process.env.UPDATE_GOLDEN && gold[id]) assert.equal(fresh[id], gold[id], `${id} changed; look at it with tools/try.mjs, then UPDATE_GOLDEN=1`);
    if (id === 'voice') { assert.ok(a.pcm && a.pcm.channels[0].length > 1000, 'voice sounds'); return; }
    const cov = a.glyph.coverage.data, R = a.raster.data, L = (i) => 0.2126 * R[i * 4] + 0.7152 * R[i * 4 + 1] + 0.0722 * R[i * 4 + 2];
    let inside = 0, ni = 0, out = 0, no = 0; for (let i = 0; i < cov.length; i++) if (cov[i] > 0.9) { inside += L(i); ni++; } else if (cov[i] === 0) { out += L(i); no++; }
    assert.ok(Math.abs(inside / ni - out / no) > 0.01, `the letter differs from its ground (${(inside / ni).toFixed(3)} vs ${(out / no).toFixed(3)})`);
  });
}

test('a generated candidate is the same family every time', () => {
  const brief = JSON.parse(readFileSync(new URL('../briefs/pane.json', import.meta.url), 'utf8'));
  assert.deepEqual(candidate(brief, 3), candidate(brief, 3));
  assert.notDeepEqual(candidate(brief, 3), candidate(brief, 4));
  assert.throws(() => candidate({ ...brief, params: { glass: { ior: [1, 2] } } }, 0), /no parameter ior/);
});

test('golden file written when asked', () => {
  if (process.env.UPDATE_GOLDEN) writeFileSync(GOLD, JSON.stringify(fresh, null, 1));
  assert.ok(Object.keys(fresh).length === MATERIALS.size);
});

test('every option of every enum parameter renders (a misspelt option fails here, not in a brief run)', () => {
  for (const m of MATERIALS.values()) for (const [k, p] of Object.entries(m.params)) if (p.options) for (const o of p.options) {
    const f = fam(m.id), slot = LAYER[m.id] ?? 'fill'; f.bindings[slot] = { material: m.id, params: { [k]: o } };
    assert.doesNotThrow(() => renderWord(f, 'a', 48, 32), `${m.id}.${k} = ${o}`);
  }
});
