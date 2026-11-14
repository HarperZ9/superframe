// Origin: the alive workspace tests/nodes.test.js, written 2026-10-23 and left out of the site import; carried on 2026-11-14 with imports repointed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODES } from '../src/nodes.mjs';
import { evaluate } from '../../../superframe/lib/graph.mjs';
import { checkValue } from '../../../superframe/lib/types.mjs';
import * as px from '../../../superframe/lib/pix.mjs';
import { fixture } from './helpers.js';

const reg = new Map(NODES.map((n) => [n.id, n]));
const plate = (() => { const f = fixture('goya-nobody'); return px.fromSRGB8(f.w, f.h, f.data); })();
// A one-node source so recipes can start from a cleared plate.
reg.set('test.plate', { ...NODES[0], id: 'test.plate', inputs: {}, outputs: { raster: 'raster' }, params: {}, render: async () => ({ raster: plate }) });

test('every alive node is a valid superframe node with an id in the alive family', () => {
  assert.equal(NODES.length, 4);
  for (const n of NODES) { assert.match(n.id, /^alive\./); assert.ok(Object.keys(n.outputs).length >= 1); }
});

test('a recipe: plate -> depth -> living still at t = 1.6 type-checks and renders', async () => {
  const r = await evaluate({ seed: 'alive', size: [200, 290], time: { t: 1.6, duration: 6.4, fps: 30 },
    nodes: [{ id: 'p', node: 'test.plate' }, { id: 'd', node: 'alive.depth', in: { image: 'p' } }, { id: 's', node: 'alive.livestill', in: { image: 'p', depth: 'd' }, params: { parallax: 0.02 } }],
    out: { image: 's.raster' } }, reg);
  assert.equal(checkValue('raster', r.outputs.image), null);
});

test('a recipe: the wiggle view changes with time and the mosaic draws a series', async () => {
  const at = async (t) => (await evaluate({ seed: 'w', size: [100, 145], time: { t, duration: 2, fps: 30 }, nodes: [{ id: 'p', node: 'test.plate' }, { id: 'w', node: 'alive.wiggle', in: { image: 'p' }, params: { amp: 0.04 } }], out: { image: 'w' } }, reg)).outputs.image;
  const a = await at(0), b = await at(0.25); let d = 0; for (let i = 0; i < a.data.length; i++) d += Math.abs(a.data[i] - b.data[i]);
  assert.ok(d / a.data.length > 0.002, 'view 0 and view 2 differ');
  const m = await evaluate({ seed: 'm', size: [160, 100], nodes: [{ id: 'm', node: 'alive.mosaic' }], out: { image: 'm' } }, reg);
  assert.equal(checkValue('raster', m.outputs.image), null);
});
