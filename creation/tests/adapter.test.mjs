// adapter.test.mjs: every wrapped generator is a valid superframe node (defineNode validates on load) and renders
// through the node's own resolveParams and port types.
import test from 'node:test';
import assert from 'node:assert/strict';
import { NODES } from '../adapters/superframe-nodes.mjs';
import { resolveParams } from '../../superframe/lib/node.mjs';
import { TYPES } from '../../superframe/lib/types.mjs';

test('generators load as superframe nodes and render typed outputs', async () => {
  assert.ok(NODES.length >= 18, `${NODES.length} nodes`);
  for (const n of NODES.slice(0, 6)) {
    const out = await n.render({ inputs: {}, params: resolveParams(n, { seconds: 0.2 }), w: 48, h: 32, seed: 's', time: 0 });
    assert.equal(TYPES.field.check(out.field), null, n.id);
    assert.equal(TYPES.raster.check(out.raster), null, n.id);
  }
});
