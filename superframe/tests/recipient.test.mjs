// recipient.test.mjs: one graph, rendered for every recipient, perceptible to each; language as a medium; and the
// bridge to the type engine's property types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { forRecipient, perceptible, RECIPIENTS } from '../lib/recipient.mjs';
import { fromProp, toProp, PROPS } from '../lib/props.mjs';
import { make, checkValue } from '../lib/types.mjs';

// a picture-only graph: a word set in the house face, drawn as glyph cells
const R = { seed: 'r', size: [96, 64], nodes: [{ id: 'w', node: 'type.forge', params: { text: 'ECHO' } }, { id: 'c', node: 'lettering.glyphcell', in: { glyphs: 'w' } }], out: { image: 'c' } };

test('a picture-only graph renders perceptibly for every recipient', async () => {
  const ev = await evaluate(R, registry);
  for (const r of Object.keys(RECIPIENTS)) {
    const out = await forRecipient(r, ev, R);
    assert.equal(out.check.ok, true, `${r}: ${out.check.why.join('; ')}`);
  }
  const sr = (await forRecipient('screenreader', ev, R)).value;
  assert.deepEqual(sr.words, ['ECHO'], 'the real word survives any technique');
  assert.match(sr.alt, /^ECHO: /);
});

test('perceptibility fails where physics or the instrument says so (controls)', () => {
  assert.equal(perceptible('ear', make.audio(48000, [new Float32Array(48000)])).ok, false, 'silence is not heard');
  assert.equal(perceptible('ear', make.audio(48000, [new Float32Array(48000).fill(1)])).ok, false, 'over the ceiling');
  const flat = make.raster(8, 8); for (let i = 0; i < 64; i++) flat.data.set([0.5, 0.5, 0.5, 1], 4 * i);
  assert.equal(perceptible('eye', flat).ok, false, 'one flat level shows nothing');
  assert.equal(perceptible('reader', '  ').ok, false);
});

test('language is a medium: text from a series is set as letters and read back', async () => {
  const r = { seed: 't', size: [160, 48], nodes: [{ id: 's', node: 'data.series' }, { id: 'f', node: 'type.forge', in: { text: 's' } }], out: { image: 'f' } };
  const ev = await evaluate(r, registry), g = ev.values.get('f').glyphs;
  assert.ok(g.text.startsWith('US CPI inflation'), g.text);
  assert.equal(checkValue('glyphs', g), null);
});

test('type-engine properties cross into ports and back', () => {
  const f = make.field(4, 4, new Float32Array(16).fill(0.25));
  assert.deepEqual(Array.from(fromProp('coverage', toProp('field', f)).data), Array.from(f.data));
  const v = make.vector(10, 10, [{ pts: [[1, 1], [9, 9]], width: 2 }]);
  assert.equal(checkValue('vector', fromProp('structure.strokes', toProp('vector', v))), null);
  assert.throws(() => fromProp('provenance', { source: 'x', licence: 'cc0' }), /data only/);
  assert.ok(Object.keys(PROPS).length >= 20);
});
