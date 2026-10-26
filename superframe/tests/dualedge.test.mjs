// dualedge.test.mjs: a perception trick never ships without its reveal. Includes the false-success control: the
// trick alone must be refused, and so must a reveal that exists but does not reach an output.
import test from 'node:test';
import assert from 'node:assert/strict';
import { registry } from '../lib/registry.mjs';
import { compile } from '../lib/graph.mjs';
import { dualEdge } from '../lib/dualedge.mjs';
import { callTool } from '../lib/tools.mjs';

const trick = { seed: 'x', size: [64, 64], nodes: [{ id: 's', node: 'sound.shepard', params: { seconds: 4 } }], out: { image: 's', audio: 's' } };
test('the Shepard tone alone is refused', () => assert.equal(dualEdge(compile(trick, registry)).pass, false));
test('a reveal that does not reach an output is refused', () => {
  const r = { ...trick, nodes: [...trick.nodes, { id: 'v', node: 'reveal.spectrogram', in: { audio: 's' } }] };
  assert.equal(dualEdge(compile(r, registry)).pass, false);
});
test('trick plus reveal in the same output passes', () => {
  const r = { ...trick, nodes: [...trick.nodes, { id: 'v', node: 'reveal.spectrogram', in: { audio: 's' } }, { id: 'p', node: 'reveal.pair', in: { trick: 's', reveal: 'v' } }], out: { image: 'p', audio: 's' } };
  assert.equal(dualEdge(compile(r, registry)).pass, true);
});
test('render refuses a trick without its reveal', async () => {
  const r = await callTool('superframe_render', { recipe: trick, outBase: 'out/test/refused' });
  assert.equal(r.refused?.length, 1);
});
