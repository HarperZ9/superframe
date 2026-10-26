// stream.test.mjs: a live graph re-runs only what an edit touches, and agrees with a full evaluation.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../lib/registry.mjs';
import { evaluate } from '../lib/graph.mjs';
import { createStream } from '../lib/stream.mjs';

const R = { seed: 'live', size: [48, 48], nodes: [{ id: 'a', node: 'field.fbm' }, { id: 'b', node: 'chladni.membrane' }, { id: 'm', node: 'field.mix', in: { a: 'a', b: 'b' } }], out: { image: 'm' } };

test('set() re-runs the edited node and what is downstream, nothing else', async () => {
  const s = createStream(R, registry); await s.tick();
  s.set('b', { n: 4 }); const { ran, outputs } = await s.tick();
  assert.ok(!ran.includes('a') && ran.includes('b') && ran.includes('m'), ran.join(' '));
  const full = await evaluate({ ...R, nodes: R.nodes.map(n => (n.id === 'b' ? { ...n, params: { n: 4 } } : n)) }, registry);
  assert.deepEqual(Array.from(outputs.image.data), Array.from(full.outputs.image.data));
});

test('feed() accepts a live value in place of a node', async () => {
  const s = createStream(R, registry); await s.tick();
  s.feed('a', { field: { w: 48, h: 48, channels: 1, data: new Float32Array(48 * 48).fill(1) } });
  const { ran } = await s.tick();
  assert.deepEqual(ran.sort(), ['a', 'm', 'm:field>raster'].sort());
});
