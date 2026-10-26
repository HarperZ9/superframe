// graph.test.mjs: recipes compile, converters are inserted, seeds reproduce, and bad recipes fail with the reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { registry } from '../lib/registry.mjs';
import { compile, evaluate, conversionPath } from '../lib/graph.mjs';
import { checkValue } from '../lib/types.mjs';

const h = v => createHash('sha256').update(Buffer.from(v.buffer, v.byteOffset, v.byteLength)).digest('hex');
// the cross-media chain from the brief: a word becomes sound, its spectrogram a field, the field sorts sand, the sand
// is spelled back into the word, and the word is drawn in bit-distance cells
const RIVER = {
  schema: 'superframe.recipe/1', seed: 'river', size: [96, 96],
  nodes: [
    { id: 'word', node: 'type.forge', params: { text: 'TIDE' } },
    { id: 'song', node: 'lettering.sound', in: { glyphs: 'word' } },
    { id: 'spec', node: 'reveal.spectrogram', in: { audio: 'song' } },
    { id: 'sand', node: 'chladni.sand', params: { grains: 3000, steps: 40 }, in: { field: 'spec', glyphs: 'word' } },
    { id: 'cells', node: 'bits.letters', params: { pitch: 4 }, in: { glyphs: 'sand' } },
  ],
  out: { image: 'cells', audio: 'song' },
};

test('converter chains exist between the media types the explorer uses', () => {
  for (const [a, b] of [['field', 'audio'], ['audio', 'field'], ['series', 'raster'], ['particles', 'events'], ['glyphs', 'audio'], ['events', 'raster'], ['material', 'field']]) assert.ok(conversionPath(a, b)?.length >= 1, `${a} -> ${b}`);
  assert.equal(conversionPath('time', 'raster'), null, 'a clock has no picture');
});

test('compile inserts converters where ports differ and names them by the edge', () => {
  const p = compile(RIVER, registry);
  const ins = p.order.filter(i => i.inserted).map(i => i.def.id);
  assert.ok(ins.includes('convert.particles-field') && ins.includes('convert.field-glyphs'), ins.join(' '));
});

test('the same recipe and seed give the same bytes; another seed gives other bytes', async () => {
  const a = await evaluate(RIVER, registry), b = await evaluate(RIVER, registry), c = await evaluate({ ...RIVER, seed: 'other' }, registry);
  assert.equal(h(a.outputs.image.data), h(b.outputs.image.data));
  assert.equal(h(a.outputs.audio.channels[0]), h(b.outputs.audio.channels[0]));
  assert.notEqual(h(a.outputs.image.data), h(c.outputs.image.data));
  assert.equal(checkValue('raster', a.outputs.image), null);
});

test('adding a node does not change the randomness of the nodes already there', async () => {
  const base = { seed: 's', size: [64, 64], nodes: [{ id: 'g', node: 'substrate.grain' }], out: { image: 'g' } };
  const more = { ...base, nodes: [{ id: 'z', node: 'field.fbm' }, ...base.nodes] };
  const a = await evaluate(base, registry), b = await evaluate(more, registry);
  assert.equal(h(a.outputs.image.data), h(b.outputs.image.data));
});

test('distribution parameters are drawn per node, or held', () => {
  const r = { seed: 'd', size: [32, 32], nodes: [{ id: 'm', node: 'chladni.membrane', params: { mix: { dist: 'uniform', min: 0, max: 90 } } }], out: { image: 'm' } };
  const p1 = compile(r, registry).byId.get('m').params.mix, p2 = compile(r, registry).byId.get('m').params.mix;
  assert.equal(p1, p2, 'a seeded draw repeats');
  assert.ok(p1 >= 0 && p1 <= 90);
  assert.equal(compile({ ...r, hold: true }, registry).byId.get('m').params.mix, 45, 'hold gives the mean');
});

test('bad recipes fail with the reason', () => {
  assert.throws(() => compile({ nodes: [{ id: 'a', node: 'no.such' }], out: { image: 'a' } }, registry), /unknown node type/);
  assert.throws(() => compile({ nodes: [{ id: 'a', node: 'chladni.membrane', params: { nn: 1 } }], out: { image: 'a' } }, registry), /unknown parameter/);
  assert.throws(() => compile({ nodes: [{ id: 'a', node: 'burin.engrave' }], out: { image: 'a' } }, registry), /needs input/);
  assert.throws(() => compile({ nodes: [{ id: 'a', node: 'field.mix', in: { a: 'b', b: 'b' } }, { id: 'b', node: 'field.mix', in: { a: 'a', b: 'a' } }], out: { image: 'a' } }, registry), /cycle/);
  assert.throws(() => compile({ nodes: [{ id: 'a', node: 'time.clock' }], out: { image: 'a' } }, registry), /no conversion from time to raster/);
});
