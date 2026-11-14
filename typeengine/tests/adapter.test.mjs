// tests/adapter.test.mjs: the super-framework nodes pass the super framework's own port checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { NODES, familyNode } from '../adapters/superframe.mjs';
import { resolveParams } from '../../superframe/lib/node.mjs';
import { checkValue } from '../../superframe/lib/types.mjs';

test('typeengine.word and a brief node return checked raster, glyphs and audio with the real text kept', async () => {
  const brief = JSON.parse(readFileSync(new URL('../briefs/ledger.json', import.meta.url), 'utf8'));
  for (const n of [NODES[0], familyNode(brief)]) {
    const r = await n.render({ params: resolveParams(n, { text: 'Rope' }), w: 160, h: 64, seedInt: 3 });
    for (const [k, v] of Object.entries(r)) assert.equal(checkValue(n.outputs[k], v), null, `${n.id}.${k}`);
    assert.equal(r.glyphs.text, 'Rope');
  }
});

test('typeengine.living and typeengine.reveal pass the port checks; the real text is kept', async () => {
  const live = NODES.find((n) => n.id === 'typeengine.living'), rev = NODES.find((n) => n.id === 'typeengine.reveal');
  const r = await live.render({ params: resolveParams(live, { text: 'leaf', from: 'ink', to: 'plant', progress: 0.5 }), w: 240, h: 90, seedInt: 1 });
  for (const [k, v] of Object.entries(r)) assert.equal(checkValue(live.outputs[k], v), null, `living.${k}`);
  assert.equal(r.glyphs.text, 'leaf'); assert.ok(r.glyphs.mask.some((v) => v > 0.9));
  assert.ok(!live.params.from.options.includes('divisumma'), 'states that do not read are not offered');
  const flat = (v) => { const d = new Float32Array(120 * 60 * 4).fill(v); for (let k = 3; k < d.length; k += 4) d[k] = 1; return { w: 120, h: 60, data: d }; };
  const out = await rev.render({ inputs: { top: flat(0.2), under: flat(0.8) }, params: resolveParams(rev, { progress: 1 }), w: 120, h: 60, seedInt: 1 });
  assert.equal(checkValue('raster', out.raster), null);
  const mid = out.raster.data[(30 * 120 + 60) * 4]; assert.ok(mid > 0.6, `fully washed shows what is beneath (${mid.toFixed(2)})`);
});
